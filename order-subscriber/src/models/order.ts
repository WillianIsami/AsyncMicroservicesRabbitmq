export enum OrderStatus {
  CREATED = 'CREATED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVENTORY_CHECKING = 'INVENTORY_CHECKING',
  INVENTORY_CONFIRMED = 'INVENTORY_CONFIRMED',
  INVENTORY_FAILED = 'INVENTORY_FAILED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}