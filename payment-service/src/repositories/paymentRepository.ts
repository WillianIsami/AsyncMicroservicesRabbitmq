import { Payment, PaymentStatus } from '../models/payment';
import { v4 as uuidv4 } from 'uuid';

class PaymentRepository {
  async createPayment(paymentData: {
    orderId: string;
    amount: number;
    method: string;
  }): Promise<Payment> {
    return Payment.create({
      id: uuidv4(),
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      method: paymentData.method as any,
      status: PaymentStatus.PENDING
    });
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, transactionId?: string): Promise<[number]> {
    return Payment.update({ status, transactionId }, { where: { id } });
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    return Payment.findByPk(id);
  }

  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    return Payment.findAll({ where: { orderId } });
  }

  async cancelPayment(id: string, reason?: string): Promise<[number]> {
    return Payment.update({ 
      status: PaymentStatus.CANCELLED,
      transactionId: `cancel_${Date.now()}_${reason ? reason.substring(0, 20) : ''}`
    }, { 
      where: { 
        id,
      } 
    });
  }
}

export const paymentRepository = new PaymentRepository();