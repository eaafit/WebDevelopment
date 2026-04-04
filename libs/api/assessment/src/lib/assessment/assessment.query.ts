import type { AssessmentStatus as RpcAssessmentStatus } from '@notary-portal/api-contracts';

export interface AssessmentQuery {
  page: number;
  limit: number;
  userId?: string;
  notaryId?: string;
  status?: RpcAssessmentStatus;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  sortField?: 'createdAt' | 'estimatedValue' | 'updatedAt';
  sortDesc?: boolean;
}
