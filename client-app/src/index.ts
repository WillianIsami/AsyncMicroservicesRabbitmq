import { RabbitMQClient, QUEUES } from './config/rabbitmq';
import { v4 as uuidv4 } from 'uuid';

// Dados de exemplo para o pedido
const sampleOrder = {
  customerId: 'cust-' + uuidv4(),
  items: [
    { productId: 'c5d1a620-7e1e-4be9-8f2d-21a6e6c1f123', quantity: 3, price: 159.90 },
    { productId: '1b8f5d09-4e5e-4df3-8efc-b7e383d5a2ac', quantity: 4, price: 229.90 }
  ]
};

async function publishOrder() {
  const rabbitMQClient = new RabbitMQClient();
  
  try {
    await rabbitMQClient.initialize();
    
    const orderData = {
      id: uuidv4(),
      timestamp: Date.now(),
      data: sampleOrder
    };

    await rabbitMQClient.publishMessage(QUEUES.NEW_ORDER_REQUEST, orderData);
    console.log('Pedido publicado com sucesso:', orderData);
    
  } catch (error) {
    console.error('Erro ao publicar pedido:', error instanceof Error ? error.message : String(error));
  } finally {
    await rabbitMQClient.close();
  }
}

publishOrder();