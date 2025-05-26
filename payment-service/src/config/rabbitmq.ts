import amqp from 'amqplib/callback_api';
import { Connection, Channel } from 'amqplib/callback_api';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

// Constantes para configuração do RabbitMQ
export const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqps://vnxatifg:@leopard.lmq.cloudamqp.com/vnxatifg';

// Nomes das filas
export const QUEUES = {
  NEW_ORDER_REQUEST: 'new-order-request',
  ORDER_CREATED: 'order-created',
  PAYMENT_PROCESSED: 'payment-processed',
  PAYMENT_FAILED: 'payment-failed',
  INVENTORY_CHECK: 'inventory-check',
  INVENTORY_UPDATED: 'inventory-updated',
  INVENTORY_FAILED: 'inventory-failed',
  INVENTORY_FAILED_PAYMENT: 'inventory-failed-payment',
  ORDER_COMPLETED: 'order-completed',
  ORDER_FAILED: 'order-failed'
};

// Interface básica para mensagens
export interface Message {
  id: string;
  timestamp: number;
  data: any;
}

// Classe para abstrair conexão com RabbitMQ
export class RabbitMQClient {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  
  // Conecta ao RabbitMQ e retorna uma promise com a conexão
  private connectAsync(url: string): Promise<Connection> {
    return new Promise((resolve, reject) => {
      amqp.connect(url, (error, connection) => {
        if (error) {
          reject(error);
        } else {
          resolve(connection);
        }
      });
    });
  }
  
  // Cria um canal e retorna uma promise
  private createChannelAsync(connection: Connection): Promise<Channel> {
    return new Promise((resolve, reject) => {
      connection.createChannel((error, channel) => {
        if (error) {
          reject(error);
        } else {
          resolve(channel);
        }
      });
    });
  }
  
  // Declara uma fila e retorna uma promise
  private assertQueueAsync(channel: Channel, queue: string, options: amqp.Options.AssertQueue): Promise<amqp.Replies.AssertQueue> {
    return new Promise((resolve, reject) => {
      channel.assertQueue(queue, options, (error, ok) => {
        if (error) {
          reject(error);
        } else {
          resolve(ok);
        }
      });
    });
  }

  // Inicializa a conexão com o RabbitMQ
  async initialize(): Promise<void> {
    try {
      this.connection = await this.connectAsync(RABBITMQ_URL);
      
      if (this.connection) {
        this.channel = await this.createChannelAsync(this.connection);
      
        // Declarar todas as filas que serão usadas
        for (const queue of Object.values(QUEUES)) {
          if (this.channel) {
            await this.assertQueueAsync(this.channel, queue, { durable: true });
          }
        }
      
        console.log('Conexão com RabbitMQ estabelecida com sucesso');
      }
    } catch (error) {
      console.error('Erro ao conectar com RabbitMQ:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Publica uma mensagem em uma fila
  async publishMessage(queue: string, message: Message): Promise<boolean> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }

    try {
      return new Promise((resolve, reject) => {
        const success = this.channel!.sendToQueue(
          queue,
          Buffer.from(JSON.stringify(message)),
          { persistent: true }
        );
        
        console.log(`Mensagem enviada para ${queue}:`, message);
        resolve(success);
      });
    } catch (error) {
      console.error(`Erro ao publicar mensagem na fila ${queue}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // Subscreve para receber mensagens de uma fila
  async subscribeToQueue(
    queue: string,
    callback: (message: Message) => Promise<void>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Canal RabbitMQ não inicializado');
    }

    this.channel.consume(queue, async (msg) => {
      if (msg) {
        try {
          const content = msg.content.toString();
          const message: Message = JSON.parse(content);
          
          console.log(`Mensagem recebida da fila ${queue}:`, message);
          
          // Processa a mensagem
          await callback(message);
          
          // Confirma o processamento da mensagem
          if (this.channel) {
            this.channel.ack(msg);
          }
        } catch (error) {
          console.error(`Erro ao processar mensagem da fila ${queue}:`, error instanceof Error ? error.message : String(error));
          // Rejeita a mensagem em caso de erro
          if (this.channel) {
            this.channel.nack(msg, false, false);
          }
        }
      }
    });
    
    console.log(`Inscrito para receber mensagens da fila ${queue}`);
  }

  // Fecha a conexão com o RabbitMQ
  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.channel) {
          this.channel.close(err => {
            if (err) {
              console.error('Erro ao fechar canal RabbitMQ:', err);
            }
            
            if (this.connection) {
              this.connection.close(err => {
                if (err) {
                  console.error('Erro ao fechar conexão RabbitMQ:', err);
                  reject(err);
                } else {
                  console.log('Conexão com RabbitMQ fechada');
                  resolve();
                }
              });
            } else {
              resolve();
            }
          });
        } else if (this.connection) {
          this.connection.close(err => {
            if (err) {
              console.error('Erro ao fechar conexão RabbitMQ:', err);
              reject(err);
            } else {
              console.log('Conexão com RabbitMQ fechada');
              resolve();
            }
          });
        } else {
          resolve();
        }
      } catch (error) {
        console.error('Erro ao fechar conexão com RabbitMQ:', error instanceof Error ? error.message : String(error));
        reject(error);
      }
    });
  }
}
