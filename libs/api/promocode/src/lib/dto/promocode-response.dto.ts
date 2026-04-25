export class PromocodeResponseDto {
  id!: number;
  code!: string;
  discountType!: string;
  discountValue!: number;
  description?: string;
  isActive!: boolean;
  validFrom!: Date;
  validTo!: Date;
  maxUses!: number;
  usedCount!: number;
  createdAt!: Date;
  updatedAt!: Date;
}
