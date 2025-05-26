import { paymentRepository } from '../repositories/paymentRepository';
import { RabbitMQClient, QUEUES } from '../config/rabbitmq';
import { PaymentStatus } from '../models/payment';
import { v4 as uuidv4 } from 'uuid';

class PaymentProcessor {
  async processPayment(paymentId: string): Promise<void> {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) throw new Error('Pagamento não encontrado');

      // Atualiza status para PROCESSING
      await paymentRepository.updatePaymentStatus(paymentId, PaymentStatus.PROCESSING);

      // Simula resultado (90% sucesso)
      const isSuccessful = Math.random() < 0.9;
      const status = isSuccessful ? PaymentStatus.COMPLETED : PaymentStatus.FAILED;
      const transactionId = isSuccessful ? `tx_${Date.now()}` : undefined;

      // Atualiza status final
      await paymentRepository.updatePaymentStatus(
        paymentId, 
        status,
        transactionId
      );

      // Publica evento conforme status
      await this.publishPaymentResult(
        payment.orderId,
        paymentId,
        status,
        payment.amount,
        transactionId
      );

    } catch (error) {
      console.error(`Erro ao processar pagamento ${paymentId}:`, error instanceof Error ? error.message : String(error));
      
      // Marca como falha e publica evento
      await paymentRepository.updatePaymentStatus(paymentId, PaymentStatus.FAILED);
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (payment) {
        await this.publishPaymentResult(
          payment.orderId,
          paymentId,
          PaymentStatus.FAILED,
          payment.amount
        );
      }
    }
  }

  async cancelPayment(paymentId: string, reason?: string): Promise<void> {
    try {
      const payment = await paymentRepository.getPaymentById(paymentId);
      if (!payment) throw new Error('Pagamento não encontrado');

      // Atualiza status para CANCELLED
      const [affectedRows] = await paymentRepository.cancelPayment(paymentId, reason);
      
      if (affectedRows === 0) {
        throw new Error('Nenhum pagamento foi cancelado - verifique o status atual');
      }
    } catch (error) {
      console.error(`Erro ao cancelar pagamento ${paymentId}:`, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  private async publishPaymentResult(
    orderId: string,
    paymentId: string,
    status: PaymentStatus,
    amount: number,
    transactionId?: string,
    reason?: string
  ): Promise<void> {
    const eventData = {
      paymentId,
      orderId,
      status,
      amount,
      transactionId,
      reason,
      timestamp: new Date().toISOString()
    };

    const rabbitMQClient = new RabbitMQClient();
    await rabbitMQClient.initialize();
    
    // Publica em fila específica por status
    if (status === PaymentStatus.COMPLETED) {
      await rabbitMQClient.publishMessage(QUEUES.PAYMENT_PROCESSED, {
        id: uuidv4(),
        timestamp: Date.now(),
        data: eventData,
      });
    } else if (status === PaymentStatus.CANCELLED) {
      await rabbitMQClient.publishMessage(QUEUES.PAYMENT_FAILED, {
        id: uuidv4(),
        timestamp: Date.now(),
        data: eventData,
      });
    } else {
      await rabbitMQClient.publishMessage(QUEUES.PAYMENT_FAILED, {
        id: uuidv4(),
        timestamp: Date.now(),
        data: eventData,
      });
    }
    console.log(`Evento de pagamento publicado: ${status}`);
  }
}

export const paymentProcessor = new PaymentProcessor();