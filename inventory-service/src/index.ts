import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RabbitMQClient, QUEUES, Message } from '../../common/src/rabbitmq';
import { Product, InventoryCheckResult } from './models/inventory';

// Banco de dados em memória para produtos
const products: Record<string, Product> = {};

// Inicializa com alguns produtos de exemplo
function initializeProducts() {
  const sampleProducts = [
    {
      id: '1',
      name: 'Camiseta',
      description: 'Camiseta de algodão',
      price: 29.99,
      stockQuantity: 100
    },
    {
      id: '2',
      name: 'Calça Jeans',
      description: 'Calça jeans azul',
      price: 89.99,
      stockQuantity: 50
    },
    {
      id: '3',
      name: 'Tênis',
      description: 'Tênis esportivo',
      price: 199.99,
      stockQuantity: 30
    },
    {
      id: '4',
      name: 'Relógio',
      description: 'Relógio de pulso analógico',
      price: 150.00,
      stockQuantity: 10
    }
  ];
  
  const now = new Date();
  sampleProducts.forEach(item => {
    products[item.id] = {
      ...item,
      createdAt: now,
      updatedAt: now
    };
  });
}

// Inicializa o serviço Express
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3003;

// Middleware de logging detalhado
app.use((req: any, res: any, next: Function) => {
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

// Adiciona um produto
app.post('/products', (req: any, res: any) => {
  try {
    const { name, description, price, stockQuantity } = req.body;
    
    if (!name || !description || !price || stockQuantity === undefined) {
      return res.status(400).json({ error: 'Dados do produto inválidos' });
    }
    
    const productId = uuidv4();
    const now = new Date();
    
    const product: Product = {
      id: productId,
      name,
      description,
      price,
      stockQuantity,
      createdAt: now,
      updatedAt: now
    };
    
    products[productId] = product;
    
    res.status(201).json({ 
      message: 'Produto criado com sucesso',
      productId
    });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

// Busca um produto pelo ID
app.get('/products/:id', (req: any, res: any) => {
  const productId = req.params.id;
  const product = products[productId];
  
  if (!product) {
    return res.status(404).json({ error: 'Produto não encontrado' });
  }
  
  res.json(product);
});

// Lista todos os produtos
app.get('/products', (req, res) => {
  res.json(Object.values(products));
});

// Atualiza o estoque de um produto
app.patch('/products/:id/stock', (req: any, res: any) => {
  try {
    const productId = req.params.id;
    const { stockQuantity } = req.body;
    
    if (stockQuantity === undefined) {
      return res.status(400).json({ error: 'Quantidade de estoque não informada' });
    }
    
    const product = products[productId];
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    
    product.stockQuantity = stockQuantity;
    product.updatedAt = new Date();
    
    res.json({ 
      message: 'Estoque atualizado com sucesso',
      product
    });
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
    res.status(500).json({ error: 'Erro ao atualizar estoque' });
  }
});

// Verifica a disponibilidade dos produtos para um pedido
async function checkInventory(orderId: string, items: { productId: string, quantity: number }[]): Promise<void> {
  console.log(`Verificando estoque para pedido ${orderId}`);
  
  const results: InventoryCheckResult[] = [];
  let allAvailable = true;
  
  // Verifica cada item do pedido
  for (const item of items) {
    const product = products[item.productId];
    
    if (!product) {
      results.push({
        productId: item.productId,
        isAvailable: false,
        requestedQuantity: item.quantity,
        availableQuantity: 0
      });
      allAvailable = false;
      console.log(`Produto ${item.productId} não encontrado`);
      continue;
    }
    
    const isAvailable = product.stockQuantity >= item.quantity;
    
    results.push({
      productId: item.productId,
      isAvailable,
      requestedQuantity: item.quantity,
      availableQuantity: product.stockQuantity
    });
    
    if (!isAvailable) {
      allAvailable = false;
      console.log(`Produto ${item.productId} sem estoque suficiente (solicitado: ${item.quantity}, disponível: ${product.stockQuantity})`);
    }
  }
  
  // Se todos os produtos estão disponíveis, atualiza o estoque
  if (allAvailable) {
    for (const item of items) {
      const product = products[item.productId];
      if (product) {
        product.stockQuantity -= item.quantity;
        product.updatedAt = new Date();
        console.log(`Estoque do produto ${item.productId} atualizado: ${product.stockQuantity}`);
      }
    }
  }
  
  // Publica evento de atualização de estoque
  await rabbitMQClient.publishMessage(QUEUES.INVENTORY_UPDATED, {
    id: uuidv4(),
    timestamp: Date.now(),
    data: {
      orderId,
      results,
      success: allAvailable,
      message: allAvailable ? 'Estoque confirmado' : 'Estoque insuficiente'
    }
  });
}

// Função para processar evento de pagamento processado
async function handlePaymentProcessed(message: Message): Promise<void> {
  const { orderId, status, items } = message.data;
  
  // Só verifica o estoque se o pagamento foi bem-sucedido
  if (status === 'COMPLETED' && items) {
    await checkInventory(orderId, items);
  }
}

// Função para inicializar o serviço
async function startService() {
  try {
    // Inicializa produtos de exemplo
    initializeProducts();
    
    // Inicializa conexão com RabbitMQ
    await rabbitMQClient.initialize();
    
    // Registra listener para eventos de pagamento processado
    await rabbitMQClient.subscribeToQueue(QUEUES.PAYMENT_PROCESSED, handlePaymentProcessed);
    
    // Inicia o servidor Express
    app.listen(PORT, () => {
      console.log(`Serviço de Estoque rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao inicializar o serviço de estoque:', error);
    process.exit(1);
  }
}

// Inicia o serviço
startService();

// Gerencia encerramento do processo
process.on('SIGINT', async () => {
  console.log('Encerrando serviço de estoque...');
  await rabbitMQClient.close();
  process.exit(0);
});