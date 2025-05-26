import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET'
}

interface PaymentAttributes {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
  transactionId?: string;
}

class Payment extends Model<PaymentAttributes> implements PaymentAttributes {
  public id!: string;
  public orderId!: string;
  public amount!: number;
  public status!: PaymentStatus;
  public method!: PaymentMethod;
  public transactionId?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Payment.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  orderId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'order_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM(...Object.values(PaymentStatus)),
    allowNull: false,
    defaultValue: PaymentStatus.PENDING
  },
  method: {
    type: DataTypes.ENUM(...Object.values(PaymentMethod)),
    allowNull: false
  },
  transactionId: {
    type: DataTypes.STRING,
    field: 'transaction_id'
  }
}, {
  sequelize,
  tableName: 'payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export { Payment, PaymentAttributes };