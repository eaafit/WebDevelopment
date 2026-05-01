import { timestampDate } from '@bufbuild/protobuf/wkt';
import { createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  AssessmentStatus as RpcAssessmentStatus,
  type Assessment,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { BehaviorSubject } from 'rxjs';
import {
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
  type PaymentType,
} from '../payments/payments.shared';
import type { Application } from './RequestAssessment';

const PAGE_LIMIT = 100;

@Injectable({ providedIn: 'root' })
export class AdminApplicationsApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));
  private cache: Promise<Application[]> | null = null;
  private readonly applicationsSubject = new BehaviorSubject<Application[] | null>(null);
  readonly applications$ = this.applicationsSubject.asObservable();

  preload(): void {
    if (!this.cache) {
      this.cache = this.fetchAllApplications();
      this.cache.then((data) => this.applicationsSubject.next(data));
    }
  }

  async getAllApplications(): Promise<Application[]> {
    if (!this.cache) {
      this.cache = this.fetchAllApplications();
      this.cache.then((data) => this.applicationsSubject.next(data));
    }
    return this.cache;
  }

  invalidateCache(): void {
    this.cache = null;
  }

  private async fetchAllApplications(): Promise<Application[]> {
    const result: Application[] = [];
    let page = 1;

    while (true) {
      const response = await this.client.listAssessments({
        pagination: { page, limit: PAGE_LIMIT },
      });

      result.push(...response.assessments.map((assessment) => this.toApplication(assessment)));

      const totalPages = response.meta?.totalPages ?? 1;
      if (page >= totalPages || response.assessments.length === 0) {
        break;
      }

      page += 1;
    }

    return result;
  }

  private toApplication(assessment: Assessment): Application {
    const status = fromRpcAssessmentStatus(assessment.status);

    return {
      id: assessment.id,
      date: assessment.createdAt
        ? timestampDate(assessment.createdAt).toISOString().slice(0, 10)
        : '',
      sender: assessment.userId || '—',
      recipient: assessment.realEstateObject?.address || assessment.address || '—',
      type: toApplicationType(assessment),
      amount: Number(assessment.estimatedValue ?? '0'),
      fee: 0,
      status,
      statusText: PAYMENT_STATUS_LABELS[status],
      statementId: assessment.id,
    };
  }
}

function toApplicationType(assessment: Assessment): PaymentType {
  void assessment;
  return 'Assessment';
}

function fromRpcAssessmentStatus(status: RpcAssessmentStatus): PaymentStatus {
  switch (status) {
    case RpcAssessmentStatus.COMPLETED:
      return 'completed';
    case RpcAssessmentStatus.CANCELLED:
      return 'failed';
    case RpcAssessmentStatus.NEW:
    case RpcAssessmentStatus.VERIFIED:
    case RpcAssessmentStatus.IN_PROGRESS:
    case RpcAssessmentStatus.UNSPECIFIED:
    default:
      return 'pending';
  }
}
