export class CreateDiscountDto {
  name!: string;
  percentage!: number;
  description?: string;
  isActive!: boolean;
  validFrom!: string; // ISO
  validTo!: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}
