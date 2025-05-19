import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQClient, QUEUES } from './config/rabbitmq';
import { OrderStatus } from './models/order';
import { orderRepository } from './repositories/orderRepository';
import { sequelize, testConnection } from './config/database';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3001;

// Middleware de logging
app.use((req: Request, res: Response, next: Function) => {
  const start = Date.now();
  const { method, originalUrl, body, params, query } = req;
  
  console.log('↘️ Recebida requisição:', {
    method,
    url: originalUrl,
    body: method === 'GET' ? undefined : body,
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
    console.log('---');
  });

  next();
});

const rabbitMQClient = new RabbitMQClient();

// Criação de pedidos (atualizado)
app.post('/orders', async (req, res) => {
  try {
    const { customerId, items } = req.body;
    
    if (!customerId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Dados de pedido inválidos' });
    }
    
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Cria o pedido com Sequelize
    const order = await orderRepository.createOrder({
      customerId,
      items,
      total
    });
    
    // Atualiza status
    await orderRepository.updateOrderStatus(order.id, OrderStatus.PAYMENT_PENDING);
    
    // Publica evento
    const orderCreatedEvent = {
      orderId: order.id,
      customerId: order.customerId,
      items: order.items,
      total: order.total
    };
    
    await rabbitMQClient.publishMessage(QUEUES.ORDER_CREATED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: orderCreatedEvent
    });
    
    res.status(201).json({ 
      message: 'Pedido criado com sucesso',
      orderId: order.id,
      status: OrderStatus.PAYMENT_PENDING
    });
  } catch (error) {
    console.error('Erro ao criar pedido:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao processar pedido' });
  }
});

// Atualizar status do pagamento (atualizado)
app.patch('/orders/:id/payment', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const { status, paymentId } = req.body;

    const [affectedCount] = await orderRepository.updatePaymentStatus(
      orderId, 
      status as OrderStatus,
      paymentId
    );

    if (affectedCount === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json({ 
      message: `Status de pagamento para o pedido ${orderId} atualizado com sucesso` 
    });
  } catch (error) {
    console.error('Erro ao atualizar o status do pagamento:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao atualizar o status do pagamento' });
  }
});

app.patch('/orders/:id/status', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const { status } = req.body;
    
    const [affectedCount] = await orderRepository.updateOrderStatus(
      orderId,
      status as OrderStatus,
    );

    if (affectedCount === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json({ 
      message: `Status de pagamento para o pedido ${orderId} atualizado com sucesso` 
    });
  } catch (error) {
    console.error('Erro ao atualizar o status do pagamento:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao atualizar o status do pagamento' });
  }
});

// Busca um pedido pelo ID (atualizado)
app.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const order = await orderRepository.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json(order);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

// Inicialização do serviço (atualizada)
async function startService() {
  try {
    // Testa conexão com MySQL
    await testConnection();
    
    // Sincroniza modelos (cria tabelas se não existirem)
    await sequelize.sync({ alter: true });
    console.log('Modelos sincronizados com o banco de dados');
    
    // Inicializa RabbitMQ
    await rabbitMQClient.initialize();
    
    app.listen(PORT, () => {
      console.log(`Order API rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar Order API:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();