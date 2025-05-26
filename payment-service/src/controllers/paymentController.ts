import { Request, Response } from 'express';
import { paymentProcessor } from '../services/paymentProcessor';
import { paymentRepository } from '../repositories/paymentRepository';
import { PaymentStatus } from '../models/payment';

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

  async cancelPayment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      
      await paymentProcessor.cancelPayment(id, reason);
      
      res.json({ 
        message: 'Pagamento cancelado com sucesso',
        paymentId: id,
        status: PaymentStatus.CANCELLED
      });
    } catch (error) {
      console.error('Erro ao cancelar pagamento:', error instanceof Error ? error.message : String(error));
      
      let status = 500;
      if (error instanceof Error) {
        if (error.message.includes('não encontrado')) {
          status = 404;
        } else if (error.message.includes('não pode ser cancelado')) {
          status = 400;
        }
      }
      
      res.status(status).json({ 
        error: error instanceof Error ? error.message : 'Erro ao cancelar pagamento' 
      });
    }
  }
}