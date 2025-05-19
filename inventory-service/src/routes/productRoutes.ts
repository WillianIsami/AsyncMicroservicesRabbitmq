import express from 'express';
import { productRepository } from '../repositories/productRepository';

const router = express.Router();

// Criar um novo produto
router.post('/', async (req, res) => {
  try {
    const newProduct = await productRepository.createProduct(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Erro ao criar produto:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

// Obter todos os produtos
router.get('/', async (_req, res) => {
  try {
    const products = await productRepository.getAllProducts();
    res.json(products);
  } catch (error) {
    console.error('Erro ao buscar produtos:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// Obter produto por ID
router.get('/:id', async (req, res) => {
  try {
    const product = await productRepository.getProductById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(product);
  } catch (error) {
    console.error('Erro ao buscar produto:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao buscar produto' });
  }
});

// Atualizar estoque de um produto
router.put('/:id/stock', async (req, res) => {
  const { quantity } = req.body;
  try {
    const [updated] = await productRepository.updateStock(req.params.id, quantity);
    if (updated === 0) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ message: 'Estoque atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao atualizar estoque' });
  }
});

// Reservar itens (usado durante o processo de checkout)
router.post('/reserve', async (req, res) => {
  // Garante que 'items' seja um array (evita erro quando vier como string JSON)
  let items: { productId: string; quantity: number }[] = req.body.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      throw new Error('Formato inválido de items. Não foi possível fazer o parse.');
    }
  }

  try {
    const success = await productRepository.reserveItems(items);
    if (!success) return res.status(400).json({ error: 'Estoque insuficiente para um ou mais produtos' });
    res.json({ message: 'Itens reservados com sucesso' });
  } catch (error) {
    console.error('Erro ao reservar itens:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao reservar itens' });
  }
});

router.post('/release', async (req, res) => {
  let items: { productId: string; quantity: number }[] = req.body.items;

  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch (e) {
      return res.status(400).json({ error: 'Formato inválido de items. Não foi possível fazer o parse.' });
    }
  }

  try {
    await productRepository.releaseItems(items);
    res.json({ message: 'Estoque liberado com sucesso' });
  } catch (error) {
    console.error('Erro ao liberar estoque:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Erro ao liberar estoque' });
  }
});

export default router;
