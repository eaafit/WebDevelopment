export class CreateTariffPlanDto {
  name!: string;
  price!: number;
  description?: string;
  isActive!: boolean;
  validFrom!: string; // ISO format
  validTo!: string;
}
