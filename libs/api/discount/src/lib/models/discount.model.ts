export interface Discount {
  id: number;
  name: string;
  percentage: number;
  description?: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  createdAt: string;
  updatedAt: string;
}
