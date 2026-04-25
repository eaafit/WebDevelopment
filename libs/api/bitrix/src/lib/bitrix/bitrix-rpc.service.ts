import { create } from '@bufbuild/protobuf';
import { Injectable } from '@nestjs/common';
import {
  BitrixService,
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
} from '@notary-portal/api-contracts';
import { requireRole, Role } from '@internal/auth-shared';
import { BitrixConfigService } from './bitrix-config.service';
import { BitrixApiService } from './bitrix-api.service';
import { BitrixSyncService } from './bitrix-sync.service';

@Injectable()
export class BitrixRpcService implements BitrixService {
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
  async updateBitrixConfig(request: UpdateBitrixConfigRequest): Promise<UpdateBitrixConfigResponse> {
    requireRole(Role.Admin);

    const config = await this.configService.updateConfig({
      portalUrl: request.portal_url,
      memberId: request.member_id,
      accessToken: request.access_token,
      isActive: request.is_active,
    });

    return create(UpdateBitrixConfigResponseSchema, { config });
  }

  // ─── TestBitrixConnection ─────────────────────────────────────────────────────
  // Admin-only
  async testBitrixConnection(request: TestBitrixConnectionRequest): Promise<TestBitrixConnectionResponse> {
    requireRole(Role.Admin);

    try {
      const result = await this.apiService.testConnection();
      return create(TestBitrixConnectionResponseSchema, {
        success: result.success,
        message: result.message,
        tested_at: result.testedAt,
      });
    } catch (error) {
      return create(TestBitrixConnectionResponseSchema, {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        tested_at: new Date(),
      });
    }
  }

  // ─── SyncUsersWithBitrix ──────────────────────────────────────────────────────
  // Admin-only
  async syncUsersWithBitrix(request: SyncUsersWithBitrixRequest): Promise<SyncUsersWithBitrixResponse> {
    requireRole(Role.Admin);

    const result = await this.syncService.startSync(request.force_resync || false);

    return create(SyncUsersWithBitrixResponseSchema, {
      job_id: result.jobId,
      status: result.status,
      message: result.message,
    });
  }

  // ─── GetSyncStatus ────────────────────────────────────────────────────────────
  // Admin-only
  async getSyncStatus(request: GetSyncStatusRequest): Promise<GetSyncStatusResponse> {
    requireRole(Role.Admin);

    const status = await this.syncService.getStatus(request.job_id);
    return create(GetSyncStatusResponseSchema, { status });
  }

  // ─── GetSyncLogs ──────────────────────────────────────────────────────────────
  // Admin-only
  async getSyncLogs(request: GetSyncLogsRequest): Promise<GetSyncLogsResponse> {
    requireRole(Role.Admin);

    const result = await this.syncService.getLogs({
      page: request.pagination?.page || 1,
      limit: request.pagination?.limit || 20,
      jobId: request.job_id,
      userId: request.user_id,
    });

    return create(GetSyncLogsResponseSchema, {
      logs: result.logs,
      meta: result.meta,
    });
  }
}
