# AsyncMicroservicesRabbitmq

## Bancos de dados necessários (mysql)
- ecommerce_inventory
```sql
CREATE DATABASE IF NOT EXISTS ecommerce_inventory;
```

- ecommerce_orders
```sql
CREATE DATABASE IF NOT EXISTS ecommerce_orders;
```

- ecommerce_payments
```sql
CREATE DATABASE IF NOT EXISTS ecommerce_payments;
```

### Exemplo de produtos para o banco de dados do ecommerce_inventory
```sql
INSERT INTO products (id, name, description, price, stock_quantity, created_at, updated_at) VALUES
('c5d1a620-7e1e-4be9-8f2d-21a6e6c1f123', 'Mouse Gamer X500', 'Mouse com sensor óptico de alta precisão, RGB e 6 botões programáveis.', 159.90, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('1b8f5d09-4e5e-4df3-8efc-b7e383d5a2ac', 'Teclado Mecânico K320', 'Teclado com switches azuis, ideal para digitação e jogos.', 229.90, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('8cf3e919-d2d9-4ab3-8e1e-3c5e0c7bb2f1', 'Monitor Full HD 24"', 'Monitor LED com resolução Full HD e taxa de atualização de 75Hz.', 849.00, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('2d6cbd8b-19b2-41b5-b116-32ff987d6f3c', 'Headset Gamer H700', 'Headset com som estéreo, microfone ajustável e isolamento acústico.', 199.90, 15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('f7d7a3c1-bb58-4ea0-83be-d08e6d22a743', 'Cadeira Gamer Ultra X', 'Cadeira ergonômica com ajuste de altura, encosto reclinável e apoio lombar.', 1299.00, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
```

