export type CurrencyCode = 'EGP' | 'USD' | 'EUR';

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string | null;
  price: string;
  currency: CurrencyCode;
  stockQuantity: number | null;
  images: Array<{ id: string; url: string; alt?: string | null; isPrimary: boolean }>;
  category?: { id: string; name: string; slug: string } | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: Pagination;
}

export type OrderState =
  | 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED'
  | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
