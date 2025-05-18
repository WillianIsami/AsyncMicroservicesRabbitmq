// Define os modelos de dados para o serviço de estoque

// Representa um produto no estoque
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  createdAt: Date;
  updatedAt: Date;
}

// Resultado da verificação de estoque
export interface InventoryCheckResult {
  productId: string;
  isAvailable: boolean;
  requestedQuantity: number;
  availableQuantity: number;
}

// Evento emitido quando o estoque é atualizado
export interface InventoryUpdatedEvent {
  orderId: string;
  results: InventoryCheckResult[];
  success: boolean;
  message?: string;
}