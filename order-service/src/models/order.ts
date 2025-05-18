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

// Representa um item no pedido
export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

// Representa um pedido completo
export interface Order {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  createdAt: Date;
  updatedAt: Date;
}

// Evento emitido quando um pedido é criado
export interface OrderCreatedEvent {
  orderId: string;
  customerId: string;
  items: OrderItem[];
  total: number;
}

// Evento emitido quando um pedido é finalizado
export interface OrderCompletedEvent {
  orderId: string;
  customerId: string;
  status: OrderStatus;
}

// Evento emitido quando ocorre falha em um pedido
export interface OrderFailedEvent {
  orderId: string;
  reason: string;
  status: OrderStatus;
}