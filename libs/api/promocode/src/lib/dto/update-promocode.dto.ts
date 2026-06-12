import { CreatePromocodeDto } from './create-promocode.dto';

export class UpdatePromocodeDto implements Partial<CreatePromocodeDto> {
  code?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  description?: string;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
  maxUses?: number;
}
