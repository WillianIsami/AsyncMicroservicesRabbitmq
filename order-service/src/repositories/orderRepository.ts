import { Order, OrderStatus } from '../models/order';
import { v4 as uuidv4 } from 'uuid';

class OrderRepository {
  async createOrder(orderData: {
    customerId: string;
    items: any[];
    total: number;
  }): Promise<Order> {
    return Order.create({
      id: uuidv4(),
      customerId: orderData.customerId,
      items: orderData.items,
      total: orderData.total,
      status: OrderStatus.CREATED,
    });
  }

  async updateOrderStatus(id: string, status: OrderStatus): Promise<[number]> {
    return Order.update({ status }, { where: { id } });
  }

  async updatePaymentStatus(id: string, status: OrderStatus, paymentId?: string): Promise<[number]> {
    return Order.update({ status, paymentId }, { where: { id } });
  }

  async getOrderById(id: string): Promise<Order | null> {
    return Order.findByPk(id);
  }

  async getAllOrders(): Promise<Order[]> {
    return Order.findAll();
  }
}

export const orderRepository = new OrderRepository();