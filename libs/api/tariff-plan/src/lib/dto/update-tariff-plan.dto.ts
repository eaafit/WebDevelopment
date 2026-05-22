import { PartialType } from '@nestjs/swagger';
import { CreateTariffPlanDto } from './create-tariff-plan.dto';

export class UpdateTariffPlanDto extends PartialType(CreateTariffPlanDto) {}
