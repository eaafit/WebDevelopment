import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  AssessmentStatus as RpcAssessmentStatus,
  type Assessment as RpcAssessment,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';

export type Status = 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';

export interface NotaryAssessmentRow {
  id: string;
  userId: string;
  status: Status;
  address: string;
  description: string;
  estimatedValue: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_LIMIT = 200;

@Injectable({ providedIn: 'root' })
export class NotaryAssessmentApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async listAssessments(): Promise<NotaryAssessmentRow[]> {
    try {
      const response = await this.client.listAssessments({
        pagination: { page: 1, limit: DEFAULT_LIMIT },
      });
      return response.assessments.map(toNotaryAssessmentRow);
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось загрузить список заявок');
    }
  }

  async getAssessment(id: string): Promise<NotaryAssessmentRow> {
    try {
      const response = await this.client.getAssessment({ id });
      if (!response.assessment) {
        throw new Error('Сервер не вернул объект заявки');
      }
      return toNotaryAssessmentRow(response.assessment);
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось загрузить заявку');
    }
  }

  async verifyAssessment(id: string): Promise<NotaryAssessmentRow> {
    try {
      const response = await this.client.verifyAssessment({ id });
      if (!response.assessment) {
        throw new Error('Сервер не вернул объект заявки после взятия в работу');
      }
      return toNotaryAssessmentRow(response.assessment);
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось взять заявку в работу');
    }
  }

  async completeAssessment(id: string, finalEstimatedValue: string): Promise<NotaryAssessmentRow> {
    try {
      const response = await this.client.completeAssessment({
        id,
        finalEstimatedValue: finalEstimatedValue.trim(),
      });
      if (!response.assessment) {
        throw new Error('Сервер не вернул объект заявки после завершения');
      }
      return toNotaryAssessmentRow(response.assessment);
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось завершить заявку');
    }
  }

  async cancelAssessment(id: string, reason: string): Promise<NotaryAssessmentRow> {
    try {
      const response = await this.client.cancelAssessment({ id, reason: reason.trim() });
      if (!response.assessment) {
        throw new Error('Сервер не вернул объект заявки после отмены');
      }
      return toNotaryAssessmentRow(response.assessment);
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось отменить заявку');
    }
  }
}

function toNotaryAssessmentRow(rpc: RpcAssessment): NotaryAssessmentRow {
  return {
    id: rpc.id,
    userId: rpc.userId,
    status: fromRpcStatus(rpc.status),
    address: rpc.address,
    description: rpc.description,
    estimatedValue: rpc.estimatedValue,
    createdAt: rpc.createdAt ? timestampDate(rpc.createdAt).toISOString() : '',
    updatedAt: rpc.updatedAt ? timestampDate(rpc.updatedAt).toISOString() : '',
  };
}

function fromRpcStatus(status: RpcAssessmentStatus): Status {
  switch (status) {
    case RpcAssessmentStatus.NEW:
      return 'New';
    case RpcAssessmentStatus.VERIFIED:
      return 'Verified';
    case RpcAssessmentStatus.IN_PROGRESS:
      return 'InProgress';
    case RpcAssessmentStatus.COMPLETED:
      return 'Completed';
    case RpcAssessmentStatus.CANCELLED:
      return 'Cancelled';
    case RpcAssessmentStatus.UNSPECIFIED:
    default:
      return 'New';
  }
}

function mapAssessmentError(error: unknown, fallback: string): Error {
  if (error instanceof ConnectError) {
    return new Error(error.rawMessage || error.message || fallback);
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
}
