export class DiscountResponseDto {
  id!: number;
  name!: string;
  percentage!: number;
  description?: string;
  isActive!: boolean;
  validFrom!: Date;
  validTo!: Date;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  createdAt!: Date;
  updatedAt!: Date;
}
