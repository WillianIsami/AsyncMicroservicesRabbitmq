import { Request, Response } from 'express';
import { productRepository } from '../repositories/productRepository';

export class ProductController {
  async createProduct(req: Request, res: Response) {
    try {
      const product = await productRepository.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar produto' });
    }
  }

  async getProduct(req: Request, res: Response) {
    try {
      const product = await productRepository.getProductById(req.params.id);
      product ? res.json(product) : res.status(404).json({ error: 'Produto não encontrado' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar produto' });
    }
  }

  async listProducts(req: Request, res: Response) {
    try {
      const products = await productRepository.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar produtos' });
    }
  }

  async updateStock(req: Request, res: Response) {
    try {
      const [affectedCount] = await productRepository.updateStock(
        req.params.id, 
        req.body.quantity
      );
      affectedCount > 0
        ? res.json({ success: true })
        : res.status(404).json({ error: 'Produto não encontrado' });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao atualizar estoque' });
    }
  }
}