import { Request, Response } from 'express';
import { paymentProcessor } from '../services/paymentProcessor';
import { paymentRepository } from '../repositories/paymentRepository';

export class PaymentController {
  async createPayment(req: Request, res: Response) {
    try {
      const { orderId, amount, method } = req.body;
      
      if (!orderId || !amount || !method) {
        return res.status(400).json({ error: 'Dados de pagamento inválidos' });
      }
      
      const payment = await paymentRepository.createPayment({
        orderId,
        amount,
        method
      });
      
      res.status(201).json({
        message: 'Pagamento criado com sucesso',
        paymentId: payment.id,
        status: payment.status
      });
    } catch (error) {
      console.error('Erro ao criar pagamento:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Erro ao processar pagamento' });
    }
  }

  async getPayment(req: Request, res: Response) {
    try {
      const payment = await paymentRepository.getPaymentById(req.params.id);
      
      if (!payment) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }
      
      res.json(payment);
    } catch (error) {
      console.error('Erro ao buscar pagamento:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Erro ao buscar pagamento' });
    }
  }

  async getPaymentsByOrder(req: Request, res: Response) {
    try {
      const payments = await paymentRepository.getPaymentsByOrderId(req.params.orderId);
      res.json(payments);
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ error: 'Erro ao buscar pagamentos' });
    }
  }

  async processPayment(req: Request, res: Response) {
    try {
      await paymentProcessor.processPayment(req.params.id);
      res.json({ message: 'Pagamento processado com sucesso' });
    } catch (error) {
      console.error('Erro ao processar pagamento:', error instanceof Error ? error.message : String(error));
      res.status(500).json({ 
        error: 'Erro ao processar pagamento',
      });
    }
  }
}