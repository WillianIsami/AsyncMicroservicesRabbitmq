import { RabbitMQClient, QUEUES } from './config/rabbitmq';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuração da API do Inventory-Service
const INVENTORY_API_URL = process.env.INVENTORY_API_URL || 'http://localhost:3003';

// Inicializa RabbitMQ para consumo
const rabbitMQClient = new RabbitMQClient();

// Handler para verificação de estoque
async function handleInventoryCheck(message: any) {
  try {
    let { orderId, items } = message.data;

    console.log(`Verificando estoque para o pedido ${orderId}`);

    // Garante que 'items' seja um array (evita erro quando vier como string JSON)
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        throw new Error('Formato inválido de items. Não foi possível fazer o parse.');
      }
    }
    
    // 1. Verifica disponibilidade
    console.log(`Verificando disponibilidade dos itens: ${items}`);
    console.log(`TYPE DO ITEMS: ${typeof(items)}`);
    const stockResults = await Promise.all(
      items.map(async (item: any) => {
        try {
          const response = await axios.get(`${INVENTORY_API_URL}/products/${item.productId}`);
          const product = response.data;
          console.log("DEBUGGING: PRODUCT", product.stockQuantity >= item.quantity)
          
          return {
            productId: item.productId,
            isAvailable: product.stockQuantity >= item.quantity,
            requestedQuantity: item.quantity,
            availableQuantity: product.stockQuantity
          };
        } catch (error) {
          console.log("DEBUGGING: ERROR")
          return {
            productId: item.productId,
            isAvailable: false,
            requestedQuantity: item.quantity,
            availableQuantity: 0,
            error: 'Produto não encontrado'
          };
        }
      })
    );

    const allAvailable = stockResults.every(result => result.isAvailable);

    // 2. Se disponível, reserva itens
    if (allAvailable) {
      try {
        await axios.post(`${INVENTORY_API_URL}/products/reserve`, { orderId, items });
        
        console.log(`Estoque reservado para pedido ${orderId}`);
        await rabbitMQClient.publishMessage(QUEUES.INVENTORY_UPDATED, {
          id: uuidv4(),
          timestamp: Date.now(),
          data: {
            orderId,
            success: true,
            results: stockResults
          }
        });
      } catch (reserveError) {
        console.error(`Falha ao reservar estoque para pedido ${orderId}:`, reserveError);
        throw new Error('Falha na reserva de estoque');
      }
    } else {
      console.log(`Estoque insuficiente para pedido ${orderId}`);
      await rabbitMQClient.publishMessage(QUEUES.INVENTORY_FAILED, {
        id: uuidv4(),
        timestamp: Date.now(),
        data: {
          orderId,
          success: false,
          results: stockResults,
          message: 'Estoque insuficiente'
        }
      });
    }
  } catch (error) {
    console.error(`Erro ao processar verificação de estoque:`, error instanceof Error ? error.message : String(error));
    await rabbitMQClient.publishMessage(QUEUES.INVENTORY_FAILED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId: message?.data?.orderId,
        originalMessage: message.data,
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

// Handler para liberação de estoque (em caso de falha no pedido)
async function handleOrderFailed(message: any) {
  const { orderId, items } = message.data;
  try {
    if (items && items.length > 0) {
      console.log(`Liberando estoque para pedido falho ${orderId}`);
      await axios.post(`${INVENTORY_API_URL}/products/release`, { orderId, items });
    }
  } catch (error) {
    console.error(`Erro ao liberar estoque para pedido ${orderId}:`, error instanceof Error ? error.message : String(error));
  }
}

async function startService() {
  try {
    // Inicializa RabbitMQ
    await rabbitMQClient.initialize();
    
    // Registra handlers
    await rabbitMQClient.subscribeToQueue(
      QUEUES.INVENTORY_CHECK, 
      handleInventoryCheck
    );
    
    await rabbitMQClient.subscribeToQueue(
      QUEUES.ORDER_FAILED,
      handleOrderFailed
    );
    
    console.log('Inventory Subscriber iniciado e ouvindo mensagens...');
  } catch (error) {
    console.error('Erro ao iniciar Inventory Subscriber:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();