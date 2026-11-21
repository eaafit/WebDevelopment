import { Injectable, inject } from '@angular/core';
import { createClient } from '@connectrpc/connect';
import { AssessmentService } from '@notary-portal/api-contracts'; // Возвращаем старое имя
import { RPC_TRANSPORT } from '../rpc/rpc-transport';

@Injectable({ providedIn: 'root' })
export class AssessmentApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async getAppraisalResult(id: string) {
    return (this.client as any)['getAppraisalResult']({ id });
  }

  async addComment(assessmentId: string, text: string) {
    return (this.client as any)['addComment']({ assessmentId, text });
  }

  async generateReport(id: string) {
    return this.client.generateReport({ id });
  }
}
