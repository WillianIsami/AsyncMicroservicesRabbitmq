// Define os modelos de dados para o serviço de pagamentos

// Status possíveis para um pagamento
export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

// Métodos de pagamento suportados
export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET'
}

// Representa um pagamento
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Evento emitido quando um pagamento é processado
export interface PaymentProcessedEvent {
  paymentId: string;
  orderId: string;
  status: PaymentStatus;
  amount: number;
  transactionId?: string;
}