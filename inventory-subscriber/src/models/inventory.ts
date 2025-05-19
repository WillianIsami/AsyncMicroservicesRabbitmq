export interface InventoryCheckResult {
  productId: string;
  isAvailable: boolean;
  requestedQuantity: number;
  availableQuantity: number;
  error?: string;
}

export interface InventoryReservationRequest {
  orderId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}