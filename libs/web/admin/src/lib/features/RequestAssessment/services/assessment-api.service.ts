/**
 * Admin-side client for AssessmentService (connect-rpc).
 *
 * Scope of this commit (issue-05 / lab #6):
 *  - listAssessments / getAssessment / verifyAssessment / completeAssessment / cancelAssessment
 *  - 1:1 mapping with proto contract (no client-side state extensions yet).
 *
 * Known proto-contract gaps deferred to UI-wiring commits:
 *  - Verified → InProgress transition: no dedicated RPC. UI workaround later.
 *  - Assessment.notary_id / applicant_name: not present in proto.
 *    UI workaround / UserService join later.
 */
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { ConnectError, createClient } from '@connectrpc/connect';
import {
  AssessmentService,
  AssessmentStatus as RpcAssessmentStatus,
  type Assessment as RpcAssessment,
} from '@notary-portal/api-contracts';
import { Injectable, inject } from '@angular/core';
import { RPC_TRANSPORT } from '@notary-portal/ui';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 100;

export type AdminAssessmentStatus =
  | 'New'
  | 'Verified'
  | 'InProgress'
  | 'Completed'
  | 'Cancelled';

export interface AdminAssessmentRow {
  id: string;
  userId: string;
  status: AdminAssessmentStatus;
  address: string;
  description: string;
  estimatedValue: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAssessmentListQuery {
  page?: number;
  limit?: number;
  status?: AdminAssessmentStatus;
  userId?: string;
}

export interface AdminAssessmentListPage {
  items: AdminAssessmentRow[];
  meta: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminAssessmentApiService {
  private readonly client = createClient(AssessmentService, inject(RPC_TRANSPORT));

  async listAssessments(query: AdminAssessmentListQuery = {}): Promise<AdminAssessmentListPage> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;

    try {
      const response = await this.client.listAssessments({
        pagination: { page, limit },
        statusFilter: query.status ? toRpcStatus(query.status) : RpcAssessmentStatus.UNSPECIFIED,
        userId: query.userId ?? '',
      });

      return {
        items: response.assessments.map(toAdminAssessmentRow),
        meta: {
          page: response.meta?.currentPage ?? page,
          limit: response.meta?.perPage ?? limit,
          totalItems: response.meta?.totalItems ?? response.assessments.length,
          totalPages: response.meta?.totalPages ?? 1,
        },
      };
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось загрузить список заявок');
    }
  }

  async getAssessment(id: string): Promise<AdminAssessmentRow> {
    try {
      const response = await this.client.getAssessment({ id });
      return toAdminAssessmentRow(requireAssessment(response.assessment, 'getAssessment'));
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось загрузить заявку');
    }
  }

  async verifyAssessment(id: string): Promise<AdminAssessmentRow> {
    try {
      const response = await this.client.verifyAssessment({ id });
      return toAdminAssessmentRow(requireAssessment(response.assessment, 'verifyAssessment'));
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось перевести заявку в статус «Подтверждена»');
    }
  }

  async completeAssessment(
    id: string,
    finalEstimatedValue: string,
  ): Promise<AdminAssessmentRow> {
    try {
      const response = await this.client.completeAssessment({
        id,
        finalEstimatedValue: finalEstimatedValue.trim(),
      });
      return toAdminAssessmentRow(requireAssessment(response.assessment, 'completeAssessment'));
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось завершить заявку');
    }
  }

  async cancelAssessment(id: string, reason: string): Promise<AdminAssessmentRow> {
    try {
      const response = await this.client.cancelAssessment({ id, reason: reason.trim() });
      return toAdminAssessmentRow(requireAssessment(response.assessment, 'cancelAssessment'));
    } catch (error) {
      throw mapAssessmentError(error, 'Не удалось отменить заявку');
    }
  }
}

export function toAdminAssessmentRow(rpc: RpcAssessment): AdminAssessmentRow {
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

export function fromRpcStatus(status: RpcAssessmentStatus): AdminAssessmentStatus {
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

export function toRpcStatus(status: AdminAssessmentStatus): RpcAssessmentStatus {
  switch (status) {
    case 'New':
      return RpcAssessmentStatus.NEW;
    case 'Verified':
      return RpcAssessmentStatus.VERIFIED;
    case 'InProgress':
      return RpcAssessmentStatus.IN_PROGRESS;
    case 'Completed':
      return RpcAssessmentStatus.COMPLETED;
    case 'Cancelled':
      return RpcAssessmentStatus.CANCELLED;
  }
}

function requireAssessment(value: RpcAssessment | undefined, operation: string): RpcAssessment {
  if (!value) {
    throw new Error(`Сервер не вернул объект заявки после операции "${operation}"`);
  }
  return value;
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
