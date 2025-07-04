import { Request } from 'express';

// Kullanıcı tipleri
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'admin' | 'super_admin';
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Restoran tipleri
export interface Restaurant {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  banner_url?: string;
  subdomain?: string;
  is_active: boolean;
  subscription_plan: 'basic' | 'premium' | 'enterprise';
  subscription_expires_at?: Date;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface CreateRestaurantRequest {
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  subdomain?: string;
}

// Kategori tipleri
export interface Category {
  id: number;
  restaurant_id: number;
  name: string;
  description?: string;
  image_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  image_url?: string;
  sort_order?: number;
}

// Ürün tipleri
export interface Product {
  id: number;
  restaurant_id: number;
  category_id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  is_featured: boolean;
  allergens: string[];
  nutritional_info: Record<string, any>;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProductRequest {
  category_id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available?: boolean;
  is_featured?: boolean;
  allergens?: string[];
  nutritional_info?: Record<string, any>;
  sort_order?: number;
}

// Masa tipleri
export interface Table {
  id: number;
  restaurant_id: number;
  name: string;
  qr_code: string;
  qr_url: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateTableRequest {
  name: string;
}

// Sipariş tipleri
export interface Order {
  id: number;
  restaurant_id: number;
  table_id?: number;
  order_number: string;
  customer_name?: string;
  customer_phone?: string;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  total_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_status: 'pending' | 'paid' | 'failed';
  payment_method: 'cash' | 'card' | 'online';
  notes?: string;
  estimated_preparation_time?: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number;
  product_name: string;
  product_price: number;
  quantity: number;
  total_price: number;
  notes?: string;
  created_at: Date;
}

export interface CreateOrderRequest {
  table_id?: number;
  customer_name?: string;
  customer_phone?: string;
  items: Array<{
    product_id: number;
    quantity: number;
    notes?: string;
  }>;
  notes?: string;
  payment_method?: 'cash' | 'card' | 'online';
}

// Personel tipleri
export interface Staff {
  id: number;
  restaurant_id: number;
  user_id: number;
  role: 'manager' | 'waiter' | 'chef' | 'cashier';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateStaffRequest {
  user_id: number;
  role: 'manager' | 'waiter' | 'chef' | 'cashier';
}

// Ödeme tipleri
export interface Payment {
  id: number;
  restaurant_id: number;
  order_id?: number;
  amount: number;
  currency: string;
  payment_method: string;
  payment_provider?: string;
  transaction_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata: Record<string, any>;
  created_at: Date;
}

// API Response tipleri
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Socket.IO event tipleri
export interface SocketEvents {
  'order:created': (order: Order) => void;
  'order:updated': (order: Order) => void;
  'order:status_changed': (data: { orderId: number; status: string }) => void;
  'join:restaurant': (restaurantId: number) => void;
  'leave:restaurant': (restaurantId: number) => void;
}

// JWT Payload
export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  restaurantId?: number;
}

// Request tipleri
export interface AuthenticatedRequest extends Request {
  user?: User;
  restaurant?: Restaurant;
}

// Filtre tipleri
export interface OrderFilters {
  status?: string;
  date_from?: string;
  date_to?: string;
  table_id?: number;
}

export interface ProductFilters {
  category_id?: number;
  is_available?: boolean;
  is_featured?: boolean;
  search?: string;
} 