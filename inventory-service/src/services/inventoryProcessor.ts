import { productRepository } from '../repositories/productRepository';
import { RabbitMQClient, QUEUES } from "../config/rabbitmq";
import { v4 as uuidv4 } from 'uuid';

class InventoryProcessor {
  async processInventoryRequest(orderId: string, items: { productId: string; quantity: number }[]) {
    try {
      const results = await this.checkInventory(items);
      const allAvailable = results.every(r => r.isAvailable);

      if (allAvailable) {
        const reserved = await productRepository.reserveItems(items);
        if (!reserved) throw new Error('Falha ao reservar itens');
      }

      await this.publishInventoryResult(orderId, results, allAvailable);
      return results;
    } catch (error) {
      console.error(`Erro ao processar pedido ${orderId}:`, error instanceof Error ? error.message : String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.publishInventoryFailure(orderId, items, errorMessage);
      throw error;
    }
  }

  private async checkInventory(items: { productId: string; quantity: number }[]) {
    const results = [];
    
    for (const item of items) {
      const product = await productRepository.getProductById(item.productId);
      const isAvailable = product ? product.stockQuantity >= item.quantity : false;
      
      results.push({
        productId: item.productId,
        isAvailable,
        requestedQuantity: item.quantity,
        availableQuantity: product?.stockQuantity || 0
      });
    }
    
    return results;
  }

  private async publishInventoryResult(orderId: string, results: any[], success: boolean) {
    const rabbitMQClient = new RabbitMQClient();
    await rabbitMQClient.initialize();
    await rabbitMQClient.publishMessage(success ? QUEUES.INVENTORY_UPDATED : QUEUES.INVENTORY_FAILED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        results,
        success,
        timestamp: new Date().toISOString()
      }
    });
  }

  private async publishInventoryFailure(orderId: string, items: any[], error: string) {
    const rabbitMQClient = new RabbitMQClient();
    await rabbitMQClient.initialize();
    await rabbitMQClient.publishMessage(QUEUES.INVENTORY_FAILED, {
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        orderId,
        items,
        error,
        timestamp: new Date().toISOString()
      }
    });
  }
}

export const inventoryProcessor = new InventoryProcessor();