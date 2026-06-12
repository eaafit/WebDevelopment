export interface Promocode {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  description?: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
}
