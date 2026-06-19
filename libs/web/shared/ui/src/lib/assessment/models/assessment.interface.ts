export interface Assessment {
  id: string;
  finalEstimatedValue: number;
  address: string;
  propertyType: string;
  area: number;
  assessmentDate: Date;
  propertyCondition?: string;
  floor?: string;
  totalFloors?: number;
  buildYear?: number;
}

export interface Report {
  id: string;
  assessmentId: string;
  name: string;
  status: 'Signed' | 'Draft';
  createdAt: Date;
  downloadUrl?: string;
}

export interface CalculationFactor {
  factor: string;
  value: string | number;
  weight: number;
  contribution: number;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
  isAdmin?: boolean;
}
