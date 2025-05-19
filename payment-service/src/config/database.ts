import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ecommerce_payments',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('Conexão com MySQL estabelecida via Sequelize');
  } catch (error) {
    console.error('Erro ao conectar ao MySQL:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export { sequelize, testConnection };