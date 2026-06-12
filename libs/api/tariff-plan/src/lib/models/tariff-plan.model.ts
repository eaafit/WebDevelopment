export interface TariffPlan {
  id: number;
  name: string;
  price: number;
  description?: string;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  createdAt: string;
  updatedAt: string;
}
