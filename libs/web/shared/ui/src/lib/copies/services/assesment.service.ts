import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { Assessment, AssessmentStatus, AssessmentService as RPCAssessmentService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '../../rpc/rpc-transport';
import { TokenStore } from '../../rpc/token-store';
import { PageInfo } from './document.service';

@Injectable({ providedIn: 'root' })
export class AssessmentService {
  private readonly tokenStore = inject(TokenStore);
  private readonly transport = inject(RPC_TRANSPORT);

  private readonly client = createClient(RPCAssessmentService, this.transport);

  readonly role = this.tokenStore.role;

  async getAssessment(id: string): Promise<Assessment> {
    const res = await this.client.getAssessment({ id });
    if (!res.assessment) throw new Error('Несуществующая заявка');
    return res.assessment
  }

  async completeAssessment(id: string): Promise<Assessment> {
    const res = await this.client.completeAssessment({ id });
    if (!res.assessment) throw new Error('Несуществующий документ');
    return res.assessment
  }

  async listAssessments(statusFilter: AssessmentStatus, pagination?: { page: number, limit: number }): Promise<{
    assesments: Assessment[],
    meta?: PageInfo
  }> {
    const res = await this.client.listAssessments({ statusFilter, pagination });
    return {
      assesments: res.assessments,
      meta: res.meta
    }
  }
}
