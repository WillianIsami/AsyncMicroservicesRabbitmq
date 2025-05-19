import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

enum OrderStatus {
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

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface OrderAttributes {
  id: string;
  customerId: string;
  items: OrderItem[];
  status: OrderStatus;
  total: number;
  paymentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class Order extends Model<OrderAttributes> implements OrderAttributes {
  public id!: string;
  public customerId!: string;
  public items!: OrderItem[];
  public status!: OrderStatus;
  public total!: number;
  public paymentId?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Order.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  customerId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'customer_id'
  },
  items: {
    type: DataTypes.JSON,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(OrderStatus)),
    allowNull: false,
    defaultValue: OrderStatus.CREATED
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentId: {
    type: DataTypes.STRING,
    field: 'payment_id'
  }
}, {
  sequelize,
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export { Order, OrderAttributes, OrderItem, OrderStatus };