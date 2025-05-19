import { RabbitMQClient, QUEUES } from './config/rabbitmq';
import axios from 'axios';

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

async function startService() {
  try {
    await rabbitMQClient.initialize();
    
    await rabbitMQClient.subscribeToQueue(
      QUEUES.ORDER_CREATED,
      handleOrderCreated
    );
    
    console.log('Payment Subscriber iniciado e ouvindo mensagens...');
  } catch (error) {
    console.error('Erro ao iniciar Payment Subscriber:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();