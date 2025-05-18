import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQClient, QUEUES, Message } from '../../common/src/rabbitmq';
import { Order, OrderCreatedEvent, OrderStatus } from './models/order';

// Banco de dados em memória para armazenar pedidos
const orders: Record<string, Order> = {};

// Inicializa o serviço Express
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Middleware de logging detalhado
app.use((req: Request, res: Response, next: Function) => {
  const start = Date.now();
  const { method, originalUrl, body, params, query } = req;
  
  // Log da requisição recebida
  console.log('↘️ Recebida requisição:', {
    method,
    url: originalUrl,
    body: method === 'GET' ? undefined : body, // Não loga body para GET
    params,
    query,
    timestamp: new Date().toISOString()
  });

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('↗️ Resposta enviada:', {
      status: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    console.log('---'); // Separador visual
  });

  next();
});

// Inicializa o cliente RabbitMQ
const rabbitMQClient = new RabbitMQClient();

// Manipula a criação de novos pedidos
app.post('/orders', async (req: Request, res: Response): Promise<any> => {
  try {
    const { customerId, items } = req.body;
    
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Dados de pedido inválidos' });
    }
    
    // Calcula o total do pedido
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Cria um novo pedido
    const orderId = uuidv4();
    const order: Order = {
      id: orderId,
      customerId,
      items,
      status: OrderStatus.CREATED,
      total,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Armazena o pedido
    orders[orderId] = order;
    
    // Atualiza o status do pedido
    order.status = OrderStatus.PAYMENT_PENDING;
    order.updatedAt = new Date();
    
    // Cria o evento de pedido criado
    const orderCreatedEvent: OrderCreatedEvent = {
      orderId,
      customerId,
      items,
      total
    };
    
    // Publica o evento no RabbitMQ
    await rabbitMQClient.publishMessage(QUEUES.ORDER_CREATED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: orderCreatedEvent
    });
    
    res.status(201).json({ 
      message: 'Pedido criado com sucesso',
      orderId,
      status: order.status
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao processar pedido' });
  }
});

// Busca um pedido pelo ID
app.get('/orders/:id', (req: Request, res: Response): any => {
  const orderId = req.params.id;
  const order = orders[orderId];
  
  if (!order) {
    return res.status(404).json({ error: 'Pedido não encontrado' });
  }
  
  res.json(order);
});

// Lista todos os pedidos
app.get('/orders', (req, res) => {
  res.json(Object.values(orders));
});

// Função para processar evento de pagamento processado
async function handlePaymentProcessed(message: Message): Promise<void> {
  const { paymentId, orderId, status } = message.data;
  
  const order = orders[orderId];
  if (!order) {
    console.error(`Pedido ${orderId} não encontrado para atualização de pagamento`);
    return;
  }
  
  if (status === 'COMPLETED') {
    // Pagamento bem-sucedido
    order.status = OrderStatus.PAID;
    order.updatedAt = new Date();
    console.log(`Pagamento ${paymentId} confirmado para o pedido ${orderId}`);
    
    // Inicia verificação de estoque
    order.status = OrderStatus.INVENTORY_CHECKING;
    order.updatedAt = new Date();
    
    // Solicita verificação de estoque
    await rabbitMQClient.publishMessage(QUEUES.PAYMENT_PROCESSED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        items: order.items
      }
    });
  } else {
    // Pagamento falhou
    order.status = OrderStatus.PAYMENT_FAILED;
    order.updatedAt = new Date();
    console.log(`Pagamento ${paymentId} falhou para o pedido ${orderId}`);
    
    // Publica evento de falha no pedido
    await rabbitMQClient.publishMessage(QUEUES.ORDER_FAILED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        reason: 'Falha no processamento do pagamento',
        status: order.status
      }
    });
  }
}

// Função para processar evento de estoque atualizado
async function handleInventoryUpdated(message: Message): Promise<void> {
  const { orderId, success } = message.data;
  
  const order = orders[orderId];
  if (!order) {
    console.error(`Pedido ${orderId} não encontrado para atualização de estoque`);
    return;
  }
  
  if (success) {
    // Estoque confirmado
    order.status = OrderStatus.INVENTORY_CONFIRMED;
    order.updatedAt = new Date();
    console.log(`Estoque confirmado para o pedido ${orderId}`);
    
    // Finaliza o pedido
    order.status = OrderStatus.COMPLETED;
    order.updatedAt = new Date();
    
    // Publica evento de pedido completado
    await rabbitMQClient.publishMessage(QUEUES.ORDER_COMPLETED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        customerId: order.customerId,
        status: order.status
      }
    });
  } else {
    // Estoque insuficiente
    order.status = OrderStatus.INVENTORY_FAILED;
    order.updatedAt = new Date();
    console.log(`Estoque insuficiente para o pedido ${orderId}`);
    
    // Cancela o pedido
    order.status = OrderStatus.CANCELLED;
    order.updatedAt = new Date();
    
    // Publica evento de falha no pedido
    await rabbitMQClient.publishMessage(QUEUES.ORDER_FAILED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        reason: 'Estoque insuficiente',
        status: order.status
      }
    });
  }
}

// Função para inicializar o serviço
async function startService() {
  try {
    // Inicializa conexão com RabbitMQ
    await rabbitMQClient.initialize();
    
    // Registra listeners para as filas relevantes
    await rabbitMQClient.subscribeToQueue(QUEUES.PAYMENT_PROCESSED, handlePaymentProcessed);
    await rabbitMQClient.subscribeToQueue(QUEUES.INVENTORY_UPDATED, handleInventoryUpdated);
    
    // Inicia o servidor Express
    app.listen(PORT, () => {
      console.log(`Serviço de Pedidos rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao inicializar o serviço de pedidos:', error);
    process.exit(1);
  }
}

// Inicia o serviço
startService();

// Gerencia encerramento do processo
process.on('SIGINT', async () => {
  console.log('Encerrando serviço de pedidos...');
  await rabbitMQClient.close();
  process.exit(0);
});