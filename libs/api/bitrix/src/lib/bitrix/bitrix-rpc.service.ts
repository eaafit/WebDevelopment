import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Injectable } from '@nestjs/common';
import {
  type GetBitrixConfigRequest,
  type GetBitrixConfigResponse,
  type UpdateBitrixConfigRequest,
  type UpdateBitrixConfigResponse,
  type TestBitrixConnectionRequest,
  type TestBitrixConnectionResponse,
  type SyncUsersWithBitrixRequest,
  type SyncUsersWithBitrixResponse,
  type GetSyncStatusRequest,
  type GetSyncStatusResponse,
  type GetSyncLogsRequest,
  type GetSyncLogsResponse,
  GetBitrixConfigResponseSchema,
  UpdateBitrixConfigResponseSchema,
  TestBitrixConnectionResponseSchema,
  SyncUsersWithBitrixResponseSchema,
  GetSyncStatusResponseSchema,
  GetSyncLogsResponseSchema,
  PaginationMetaSchema,
  SyncLogEntrySchema,
  SyncStatusSchema,
} from '@notary-portal/api-contracts';
import { requireRole, Role } from '@internal/auth-shared';
import { BitrixConfigService } from './bitrix-config.service';
import { BitrixApiService } from './bitrix-api.service';
import { BitrixSyncService } from './bitrix-sync.service';

@Injectable()
export class BitrixRpcService {
  constructor(
    private readonly configService: BitrixConfigService,
    private readonly apiService: BitrixApiService,
    private readonly syncService: BitrixSyncService,
  ) {}

  // ─── GetBitrixConfig ──────────────────────────────────────────────────────────
  // Admin-only
  async getBitrixConfig(request: GetBitrixConfigRequest): Promise<GetBitrixConfigResponse> {
    requireRole(Role.Admin);

    const config = await this.configService.getConfig();
    return create(GetBitrixConfigResponseSchema, { config });
  }

  // ─── UpdateBitrixConfig ───────────────────────────────────────────────────────
  // Admin-only
  async updateBitrixConfig(
    request: UpdateBitrixConfigRequest,
  ): Promise<UpdateBitrixConfigResponse> {
    requireRole(Role.Admin);

    const config = await this.configService.updateConfig({
      portalUrl: request.portalUrl,
      memberId: request.memberId,
      accessToken: request.accessToken,
      isActive: request.isActive,
    });

    return create(UpdateBitrixConfigResponseSchema, { config });
  }

  // ─── TestBitrixConnection ─────────────────────────────────────────────────────
  // Admin-only
  async testBitrixConnection(
    request: TestBitrixConnectionRequest,
  ): Promise<TestBitrixConnectionResponse> {
    requireRole(Role.Admin);

    try {
      const result = await this.apiService.testConnection();
      return create(TestBitrixConnectionResponseSchema, {
        success: result.success,
        message: result.message,
        testedAt: timestampFromDate(result.testedAt),
      });
    } catch (error) {
      return create(TestBitrixConnectionResponseSchema, {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        testedAt: timestampFromDate(new Date()),
      });
    }
  }

  // ─── SyncUsersWithBitrix ──────────────────────────────────────────────────────
  // Admin-only
  async syncUsersWithBitrix(
    request: SyncUsersWithBitrixRequest,
  ): Promise<SyncUsersWithBitrixResponse> {
    requireRole(Role.Admin);

    const result = await this.syncService.startSync(request.forceResync ?? false);

    return create(SyncUsersWithBitrixResponseSchema, {
      jobId: result.jobId,
      status: result.status,
      message: result.message,
    });
  }

  // ─── GetSyncStatus ────────────────────────────────────────────────────────────
  // Admin-only
  async getSyncStatus(request: GetSyncStatusRequest): Promise<GetSyncStatusResponse> {
    requireRole(Role.Admin);

    const s = await this.syncService.getStatus(request.jobId);
    return create(GetSyncStatusResponseSchema, {
      status: create(SyncStatusSchema, {
        jobId: s.jobId,
        status: s.status,
        totalUsers: s.totalUsers,
        processedUsers: s.processedUsers,
        successfulSyncs: s.successfulSyncs,
        failedSyncs: s.failedSyncs,
        startedAt: timestampFromDate(s.startedAt),
        completedAt: s.completedAt ? timestampFromDate(s.completedAt) : undefined,
        errorMessage: s.errorMessage ?? '',
      }),
    });
  }

  // ─── GetSyncLogs ──────────────────────────────────────────────────────────────
  // Admin-only
  async getSyncLogs(request: GetSyncLogsRequest): Promise<GetSyncLogsResponse> {
    requireRole(Role.Admin);

    const result = await this.syncService.getLogs({
      page: request.pagination?.page || 1,
      limit: request.pagination?.limit || 20,
      jobId: request.jobId,
      userId: request.userId,
    });

    const { total, page, limit } = result.meta;
    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 0;

    return create(GetSyncLogsResponseSchema, {
      logs: result.logs.map((log) =>
        create(SyncLogEntrySchema, {
          userId: log.userId,
          bitrixContactId: log.bitrixContactId ?? '',
          action: log.action,
          status: log.status,
          message: log.message ?? '',
          timestamp: timestampFromDate(log.timestamp),
        }),
      ),
      meta: create(PaginationMetaSchema, {
        totalItems: total,
        totalPages,
        currentPage: page,
        perPage: limit,
      }),
    });
  }
}
