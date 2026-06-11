import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { AssessmentService } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';

@Injectable({ providedIn: 'root' })
export class AssessmentApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async listAssessments() {
    const response = await this.client.listAssessments({
      pagination: { page: 1, limit: 100 },
    });
    return response;
  }

  async getAssessment(id: string) {
    const response = await this.client.getAssessment({ id });
    return response.assessment;
  }

  async verifyAssessment(id: string) {
    const response = await this.client.verifyAssessment({ id });
    return response.assessment;
  }

  async completeAssessment(id: string, finalEstimatedValue: string) {
    const response = await this.client.completeAssessment({ id, finalEstimatedValue });
    return response.assessment;
  }

  async cancelAssessment(id: string, reason: string) {
    const response = await this.client.cancelAssessment({ id, reason });
    return response.assessment;
  }
}