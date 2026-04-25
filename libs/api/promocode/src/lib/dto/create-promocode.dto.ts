export class CreatePromocodeDto {
  code!: string;
  discountType!: 'percentage' | 'fixed';
  discountValue!: number;
  description?: string;
  isActive!: boolean;
  validFrom!: string;
  validTo!: string;
  maxUses!: number;
}
