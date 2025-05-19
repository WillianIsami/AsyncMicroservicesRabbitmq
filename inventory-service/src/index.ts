import express, { Request, Response } from 'express';
import { testConnection, sequelize } from './config/database';
import productRoutes from './routes/productRoutes';

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3003;

// Middleware de logging detalhado
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

// Rotas
app.use('/products', productRoutes);

async function startService() {
  try {
    await testConnection();
    await sequelize.sync({ alter: true });
    
    app.listen(PORT, () => {
      console.log(`Inventory Service rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Falha ao iniciar o serviço:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();