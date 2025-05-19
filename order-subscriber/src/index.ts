import { RabbitMQClient, QUEUES } from './config/rabbitmq';
import { OrderStatus } from './models/order';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Configuração da API
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Inicializa RabbitMQ para consumo
const rabbitMQClient = new RabbitMQClient();


async function handleOrderCreated(message: any) {
  try {
    const { customerId, items } = message.data;
    
    console.log(`Criando pedido para cliente ${customerId}`);
    
    // Envia para a API de pedidos
    const response = await axios.post(`${API_BASE_URL}/orders`, {
      customerId,
      items
    });

    const orderId = response.data.orderId;
    console.log(`Pedido ${orderId} criado com sucesso`);

    // Publica evento de pedido criado para o payment-subscriber
    await rabbitMQClient.publishMessage(QUEUES.ORDER_CREATED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        customerId,
        items,
        total: response.data.total,
        status: OrderStatus.CREATED
      }
    });

  } catch (error) {
    console.error('Erro ao criar pedido:', error instanceof Error ? error.message : String(error));
    await rabbitMQClient.publishMessage(QUEUES.ORDER_FAILED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        error: error instanceof Error ? error.message : String(error),
        originalMessage: message.data
      }
    });
  }
}

// Handler para pagamento processado
async function handlePaymentProcessed(message: any) {
  try {
    const { paymentId, orderId, status } = message.data;

    console.log(`Processando status do pagamento ${paymentId} para o pedido ${orderId}`);
    console.log(`Atualizando status do pedido ${orderId} para ${status}`);
    
    // Atualiza status via API
    const newStatus = status === 'COMPLETED' 
      ? OrderStatus.PAID 
      : OrderStatus.PAYMENT_FAILED;
    
    await axios.patch(`${API_BASE_URL}/orders/${orderId}/payment`, {
      paymentId,
      status: newStatus
    });

    if (status === 'COMPLETED') {
      const response = await axios.get(`${API_BASE_URL}/orders/${orderId}`);
      const order = response.data;
      
      if (order) {
        console.log(`Pagamento aprovado - Verificando estoque para pedido ${orderId}`);
        await rabbitMQClient.publishMessage(QUEUES.INVENTORY_CHECK, {
          id: uuidv4(),
          timestamp: Date.now(),
          data: {
            orderId,
            items: order.items
          }
        });
      } else {
        throw new Error(`Pedido ${orderId} não encontrado após pagamento`);
      }
      
    } else {
      // Tratamento explícito para falha no pagamento
      console.log(`Pagamento falhou - Cancelando pedido ${orderId}`);
      await rabbitMQClient.publishMessage(QUEUES.ORDER_FAILED, {
        id: uuidv4(),
        timestamp: Date.now(),
        data: {
          orderId,
          paymentId,
          status,
        }
      });
    }
  } catch (error) {
    console.error('Erro ao processar pagamento:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Handler para atualização de estoque
async function handleInventoryUpdated(message: any) {
  try {
    const { orderId, success } = message.data;
    
    const newStatus = success 
      ? OrderStatus.COMPLETED 
      : OrderStatus.CANCELLED;
    
    await axios.patch(`${API_BASE_URL}/orders/${orderId}/status`, {
      status: newStatus,
      reason: success ? undefined : 'Estoque insuficiente'
    });
  } catch (error) {
    console.error('Erro ao processar atualização de estoque:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function startService() {
  try {
    // Inicializa RabbitMQ
    await rabbitMQClient.initialize();
    
    // Registra handlers
    await rabbitMQClient.subscribeToQueue(
      QUEUES.NEW_ORDER_REQUEST, 
      handleOrderCreated
    );

    await rabbitMQClient.subscribeToQueue(
      QUEUES.PAYMENT_PROCESSED, 
      handlePaymentProcessed
    );

    await rabbitMQClient.subscribeToQueue(
      QUEUES.PAYMENT_FAILED, 
      handlePaymentProcessed
    );
    
    await rabbitMQClient.subscribeToQueue(
      QUEUES.INVENTORY_UPDATED, 
      handleInventoryUpdated
    );

    await rabbitMQClient.subscribeToQueue(
      QUEUES.INVENTORY_FAILED, 
      handleInventoryUpdated
    );
    
    console.log('Order Subscriber iniciado e ouvindo mensagens...');
  } catch (error) {
    console.error('Erro ao iniciar Order Subscriber:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();