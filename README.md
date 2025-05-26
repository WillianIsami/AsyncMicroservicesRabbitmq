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


# Arquitetura Geral

O sistema consiste em:

- Client-App: Publica pedidos iniciais (Publisher)
- Order-Subscriber: Consome pedidos e coordena o processo
- Order-Service: API para gerenciamento de pedidos
- Payment-Subscriber: Processa pagamentos
- Payment-Service: API para gerenciamento de pagamentos
- Inventory-Subscriber: Gerencia estoque
- Inventory-Service: API para gerenciamento de estoque

# Fluxo Principal (Happy Path)
Início do Processo:

- O client-app publica uma mensagem na fila NEW_ORDER_REQUEST com os dados do pedido

Exemplo de payload:

```json
{
  "id": "uuid-gerado",
  "timestamp": 1234567890,
  "data": {
    "customerId": "cust-123",
    "items": [
      {"productId": "prod-1", "quantity": 3, "price": 159.90},
      {"productId": "prod-2", "quantity": 4, "price": 229.90}
    ]
  }
}
```

Order-Subscriber:

- Recebe a mensagem da fila NEW_ORDER_REQUEST
- Faz uma requisição POST para o order-service (/orders) para criar o pedido
- Se bem-sucedido, publica uma mensagem na fila ORDER_CREATED com os detalhes do pedido criado

Payment-Subscriber:

- Recebe a mensagem da fila ORDER_CREATED
- Faz uma requisição para o payment-service para criar e processar o pagamento
- Se o pagamento for aprovado, publica uma mensagem na fila PAYMENT_PROCESSED
- Se o pagamento falhar, publica uma mensagem na fila PAYMENT_FAILED

Order-Subscriber (novamente):

- Recebe a mensagem da fila PAYMENT_PROCESSED
- Atualiza o status do pedido para "PAID" via order-service
- Publica uma mensagem na fila INVENTORY_CHECK para verificar/reservar estoque

Inventory-Subscriber:

- Recebe a mensagem da fila INVENTORY_CHECK
- Verifica disponibilidade de estoque via inventory-service
- Se todos os itens estiverem disponíveis:
- Reserva os itens
- Publica mensagem na fila INVENTORY_UPDATED
- Se algum item não estiver disponível:
    - Publica mensagem na fila INVENTORY_FAILED

Payment-Subscriber:

- Recebe a mensagem da fila INVENTORY_FAILED_PAYMENT
- Busca e cancela pagamentos associados aos pedidos afetados

Order-Subscriber (finalização):

- Recebe mensagem de INVENTORY_UPDATED ou INVENTORY_FAILED
- Atualiza o status do pedido para "COMPLETED" ou "CANCELLED" conforme o caso

# Fluxos de Erro e Compensação

Falha na Criação do Pedido:
- Se o order-service falhar ao criar o pedido, o order-subscriber publica na fila ORDER_FAILED

Falha no Pagamento:

- O payment-service pode falhar ou rejeitar o pagamento
- O payment-subscriber publica na fila PAYMENT_FAILED
- O order-subscriber recebe esta mensagem e:
- Atualiza o status do pedido para "PAYMENT_FAILED"
- Publica na fila ORDER_FAILED para que outros serviços possam realizar ações de compensação

Falha no Estoque:

- Se o inventory-service reportar falta de estoque:
- O inventory-subscriber publica na fila INVENTORY_FAILED
- O order-subscriber recebe esta mensagem e:
- Atualiza o status do pedido para "CANCELLED"
- Publica na fila ORDER_FAILED para compensação

Tratamento de ORDER_FAILED:

- O inventory-subscriber também escuta a fila ORDER_FAILED
- Se receber uma mensagem desta fila, verifica se precisa liberar itens reservados:
- Faz uma requisição para o inventory-service liberando qualquer reserva feita anteriormente