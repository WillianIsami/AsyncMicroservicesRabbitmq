import express from 'express';
import { PaymentController } from '../controllers/paymentController';

const router = express.Router();
const paymentController = new PaymentController();

router.post('/payments', paymentController.createPayment);
router.get('/payments/:id', paymentController.getPayment);
router.get('/orders/:orderId/payments', paymentController.getPaymentsByOrder);
router.post('/payments/:id/process', paymentController.processPayment);
router.post('/payments/:id/cancel', paymentController.cancelPayment);

export default router;