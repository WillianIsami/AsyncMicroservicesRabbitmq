import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database';

interface ProductAttributes {
  id: string;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
}

class Product extends Model<ProductAttributes> implements ProductAttributes {
  public id!: string;
  public name!: string;
  public description!: string;
  public price!: number;
  public stockQuantity!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Product.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  stockQuantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'stock_quantity'
  }
}, {
  sequelize,
  tableName: 'products',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

export { Product, ProductAttributes };