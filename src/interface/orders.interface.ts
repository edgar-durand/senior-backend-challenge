import { OrderStatus } from '../orders/order.entity';

/**
 * Response DTO for GET /orders/:id/full endpoint
 * Follows Interface Segregation Principle - only exposes necessary data
 */
export interface OrderFullDetailsResponse {
  id: number;
  status: OrderStatus;
  total: number;
  userId: number;
  createdAt: Date;
  user: UserSummary;
  items: OrderItemDetails[];
}

export interface UserSummary {
  id: number;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  latestOrder: OrderSummary;
}

/**
 * Flattened order summary - breaks circular reference by not including user
 */
export interface OrderSummary {
  id: number;
  status: OrderStatus;
  total: number;
  createdAt: Date;
}

export interface OrderItemDetails {
  id: number;
  productId: number;
  quantity: number;
  price: number;
  product: ProductSummary;
}

export interface ProductSummary {
  id: number;
  name: string;
  price: number;
  category: CategorySummary | null;
}

export interface CategorySummary {
  id: number;
  name: string;
}
