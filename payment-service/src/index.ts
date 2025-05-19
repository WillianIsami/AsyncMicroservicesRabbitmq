import express, { Request, Response } from 'express';
import { testConnection, sequelize } from './config/database';
import paymentRoutes from './routes/paymentRoutes';

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

// Rotas
app.use('/', paymentRoutes);

// Inicialização do serviço
async function startService() {
  try {
    await testConnection();
    await sequelize.sync({ alter: true });
    
    app.listen(PORT, () => {
      console.log(`Payment Service rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar Payment Service:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

startService();