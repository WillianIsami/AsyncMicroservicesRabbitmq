import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQClient, QUEUES, Message } from '../../common/src/rabbitmq';
import { Payment, PaymentMethod, PaymentStatus } from './models/payment';

// Banco de dados em memória para armazenar pagamentos
const payments: Record<string, Payment> = {};

// Inicializa o serviço Express
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3002;

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

// Endpoint para processar pagamentos manualmente
app.post('/payments', async (req: Request, res: Response): Promise<any> =>  {
  try {
    const { orderId, amount, method } = req.body;
    
    if (!orderId || !amount || !method) {
      return res.status(400).json({ error: 'Dados de pagamento inválidos' });
    }
    
    // Criar um novo pagamento
    const paymentId = uuidv4();
    const payment: Payment = {
      id: paymentId,
      orderId,
      amount,
      status: PaymentStatus.PENDING,
      method: method as PaymentMethod,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Armazenar o pagamento
    payments[paymentId] = payment;
    
    // Simular processamento de pagamento
    await processPayment(payment);
    
    res.status(201).json({ 
      message: 'Pagamento iniciado',
      paymentId,
      status: payment.status 
    });
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
    res.status(500).json({ error: 'Erro ao processar pagamento' });
  }
});

// Busca um pagamento pelo ID
app.get('/payments/:id', async (req: Request, res: Response): Promise<any> => {
  const paymentId = req.params.id;
  const payment = payments[paymentId];
  
  if (!payment) {
    return res.status(404).json({ error: 'Pagamento não encontrado' });
  }
  
  res.json(payment);
});

// Lista todos os pagamentos
app.get('/payments', (req, res) => {
  res.json(Object.values(payments));
});

// Simula o processamento de um pagamento
async function processPayment(payment: Payment): Promise<void> {
  try {
    // Atualiza status para processando
    payment.status = PaymentStatus.PROCESSING;
    payment.updatedAt = new Date();
    
    // Simula processamento com delay de 2 segundos
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simula resultado aleatório do pagamento (90% de sucesso)
    const isSuccessful = Math.random() < 0.9;
    
    if (isSuccessful) {
      // Pagamento bem-sucedido
      payment.status = PaymentStatus.COMPLETED;
      payment.transactionId = uuidv4();
    } else {
      // Pagamento falhou
      payment.status = PaymentStatus.FAILED;
    }
    
    payment.updatedAt = new Date();
    
    // Publica evento de pagamento processado
    await rabbitMQClient.publishMessage(QUEUES.PAYMENT_PROCESSED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
        amount: payment.amount,
        transactionId: payment.transactionId
      }
    });
    
    console.log(`Pagamento ${payment.id} processado: ${payment.status}`);
  } catch (error) {
    console.error(`Erro ao processar pagamento ${payment.id}:`, error);
    
    // Marca o pagamento como falho
    payment.status = PaymentStatus.FAILED;
    payment.updatedAt = new Date();
    
    // Publica evento de pagamento falho
    await rabbitMQClient.publishMessage(QUEUES.PAYMENT_PROCESSED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        paymentId: payment.id,
        orderId: payment.orderId,
        status: payment.status,
        amount: payment.amount
      }
    });
  }
}

// Função para processar evento de pedido criado
async function handleOrderCreated(message: Message): Promise<void> {
  const { orderId, total } = message.data;
  
  console.log(`Processando pagamento para pedido ${orderId} no valor de ${total}`);
  
  // Criar um novo pagamento
  const paymentId = uuidv4();
  const payment: Payment = {
    id: paymentId,
    orderId,
    amount: total,
    status: PaymentStatus.PENDING,
    method: PaymentMethod.CREDIT_CARD, // Método padrão
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Armazenar o pagamento
  payments[paymentId] = payment;
  
  // Processar o pagamento
  await processPayment(payment);
}

// Função para inicializar o serviço
async function startService() {
  try {
    // Inicializa conexão com RabbitMQ
    await rabbitMQClient.initialize();
    
    // Registra listener para eventos de pedido criado
    await rabbitMQClient.subscribeToQueue(QUEUES.ORDER_CREATED, handleOrderCreated);
    
    // Inicia o servidor Express
    app.listen(PORT, () => {
      console.log(`Serviço de Pagamentos rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao inicializar o serviço de pagamentos:', error);
    process.exit(1);
  }
}

// Inicia o serviço
startService();

// Gerencia encerramento do processo
process.on('SIGINT', async () => {
  console.log('Encerrando serviço de pagamentos...');
  await rabbitMQClient.close();
  process.exit(0);
});