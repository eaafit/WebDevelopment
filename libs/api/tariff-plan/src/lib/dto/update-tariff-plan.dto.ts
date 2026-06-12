import { CreateTariffPlanDto } from './create-tariff-plan.dto';

export class UpdateTariffPlanDto implements Partial<CreateTariffPlanDto> {
  name?: string;
  price?: number;
  description?: string;
  isActive?: boolean;
  validFrom?: string;
  validTo?: string;
}
