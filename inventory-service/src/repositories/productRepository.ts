import { sequelize } from '../config/database';
import { Product } from '../models/product';
import { v4 as uuidv4 } from 'uuid';

class ProductRepository {
  async createProduct(productData: {
    name: string;
    description: string;
    price: number;
    stockQuantity: number;
  }): Promise<Product> {
    return Product.create({
      id: uuidv4(),
      name: productData.name,
      description: productData.description,
      price: productData.price,
      stockQuantity: productData.stockQuantity
    });
  }

  async getProductById(id: string): Promise<Product | null> {
    return Product.findByPk(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Product.findAll();
  }

  async updateStock(id: string, quantity: number): Promise<[number]> {
    return Product.update(
      { stockQuantity: quantity },
      { where: { id } }
    );
  }

  async reserveItems(rawItems: any): Promise<boolean> {
    const transaction = await sequelize.transaction();
    
    try {
      console.log("=-=-=-=-=-=rawItems=-=-=-=-=-=", rawItems);
      let items: { productId: string; quantity: number }[];
      if (typeof rawItems === 'string') {
        try {
          items = JSON.parse(rawItems);
        } catch (e) {
          throw new Error('Formato inválido de items. Não foi possível fazer o parse.');
        }
      } else {
        items = rawItems;
      }

      if (!Array.isArray(items) || !items.every(item => item.productId && typeof item.quantity === 'number')) {
        throw new Error('Items em formato inválido.');
      }

      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction });
        
        if (!product || product.stockQuantity < item.quantity) {
          await transaction.rollback();
          return false;
        }
        
        await product.update(
          { stockQuantity: product.stockQuantity - item.quantity },
          { transaction }
        );
      }
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async releaseItems(items: { productId: string; quantity: number }[]): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      for (const item of items) {
        const product = await Product.findByPk(item.productId, { transaction });

        if (!product) {
          console.warn(`Produto ${item.productId} não encontrado durante liberação de estoque.`);
          continue;
        }

        await product.update(
          { stockQuantity: product.stockQuantity + item.quantity },
          { transaction }
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const productRepository = new ProductRepository();