import { RabbitMQClient, QUEUES } from './config/rabbitmq';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE_URL = process.env.PAYMENT_API_URL || 'http://localhost:3002';

const rabbitMQClient = new RabbitMQClient();

async function handleOrderCreated(message: any) {
  try {
    const { orderId, total } = message.data;
    
    console.log(`Processando pagamento para pedido ${orderId}`);
    
    // Cria o pagamento via API
    const response = await axios.post(`${API_BASE_URL}/payments`, {
      orderId,
      amount: total,
      method: 'CREDIT_CARD' // Método padrão
    });
    
    console.log(`Pagamento criado: ${response.data.paymentId}`);
    
    await axios.post(`${API_BASE_URL}/payments/${response.data.paymentId}/process`);
  } catch (error) {
    console.error('Erro ao processar pedido:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function handleInventoryFailed(message: any) {
  try {
    const { orderId, results, message: failMessage } = message.data;
    
    console.log(`Falha no estoque detectada para pedido ${orderId}: ${failMessage}`);
    
    // Primeiro, precisamos obter o paymentId associado a este orderId
    const paymentResponse = await axios.get(`${API_BASE_URL}/orders/${orderId}/payments`);
    
    if (paymentResponse.data && paymentResponse.data.length > 0) {
      const payment = paymentResponse.data[0];
      
      console.log(`Cancelando pagamento ${payment.id} devido a falha no estoque`);
      
      await axios.post(`${API_BASE_URL}/payments/${payment.id}/cancel`, {
        reason: `Falha no estoque: ${failMessage || 'Item indisponível'}`
      });
      
      console.log(`Pagamento ${payment.id} cancelado com sucesso devido a falha no estoque`);
    } else {
      console.log(`Nenhum pagamento encontrado para cancelar no pedido ${orderId}`);
    }
  } catch (error) {
    console.error('Erro ao processar falha de estoque:', error instanceof Error ? error.message : String(error));
  }
}

async function startService() {
  try {
    await rabbitMQClient.initialize();
    
    await rabbitMQClient.subscribeToQueue(
      QUEUES.ORDER_CREATED,
      handleOrderCreated
    );

    await rabbitMQClient.subscribeToQueue(
      QUEUES.INVENTORY_FAILED_PAYMENT,
      handleInventoryFailed
    );
    
    console.log('Payment Subscriber iniciado e ouvindo mensagens...');
  } catch (error) {
    console.error('Erro ao iniciar Payment Subscriber:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();