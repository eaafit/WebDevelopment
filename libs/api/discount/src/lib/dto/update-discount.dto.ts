import { CreateDiscountDto } from './create-discount.dto';

export class UpdateDiscountDto implements Partial<CreateDiscountDto> {
  name?: string;
  percentage?: number;
  description?: string;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}
