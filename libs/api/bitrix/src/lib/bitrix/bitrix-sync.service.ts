import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { BitrixApiService } from './bitrix-api.service';
import { BitrixConfigService } from './bitrix-config.service';
import { createHash } from 'crypto';
import { getCurrentUser } from '@internal/auth-shared';
import {
  BusinessOperations,
  NotarySpanAttributes,
  markSpanFailure,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';

interface SyncOptions {
  forceResync?: boolean;
  batchSize?: number;
}

interface SyncResult {
  jobId: string;
  status: 'started' | 'already_running' | 'error';
  message: string;
}

interface SyncStatus {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalUsers: number;
  processedUsers: number;
  successfulSyncs: number;
  failedSyncs: number;
  startedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

interface SyncLogEntry {
  userId: string;
  bitrixContactId?: string;
  action: 'created' | 'updated' | 'skipped' | 'error';
  status: 'success' | 'error';
  message?: string;
  timestamp: Date;
}

@Injectable()
export class BitrixSyncService {
  private readonly logger = new Logger(BitrixSyncService.name);
  private isSyncRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiService: BitrixApiService,
    private readonly configService: BitrixConfigService,
  ) {}

  async startSync(forceResync = false): Promise<SyncResult> {
    return runInSpan(
      'BitrixSyncService.startSync',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixUsersSyncStart,
        [NotarySpanAttributes.entity]: 'BitrixSync',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'bitrix.force_resync': forceResync,
      },
      async (span) => {
        if (this.isSyncRunning) {
          setSpanAttributes(span, { 'bitrix.sync.status': 'already_running' });
          return {
            jobId: 'already_running',
            status: 'already_running',
            message: 'Sync is already running',
          };
        }

        const jobId = `sync_${Date.now()}`;

        this.runSyncInBackground(jobId, forceResync).catch((error) => {
          this.logger.error(
            `Bitrix sync background failed; operation=bitrix.sync.background; result=error; error=${safeErrorName(error)}`,
          );
        });

        setSpanAttributes(span, { 'bitrix.sync.status': 'started' });
        return {
          jobId,
          status: 'started',
          message: 'Sync started successfully',
        };
      },
    );
  }

  async getStatus(jobId: string): Promise<SyncStatus> {
    const sync = await this.prisma.bitrixSync.findFirst({
      where: { jobId },
    });

    if (!sync) {
      throw new Error(`Sync job ${jobId} not found`);
    }

    return {
      jobId: sync.jobId,
      status: sync.status as any,
      totalUsers: sync.totalUsers,
      processedUsers: sync.processedUsers,
      successfulSyncs: sync.successfulSyncs,
      failedSyncs: sync.failedSyncs,
      startedAt: sync.startedAt,
      completedAt: sync.completedAt || undefined,
      errorMessage: sync.errorMessage || undefined,
    };
  }

  async getLogs(options: {
    page: number;
    limit: number;
    jobId?: string;
    userId?: string;
  }): Promise<{ logs: SyncLogEntry[]; meta: { total: number; page: number; limit: number } }> {
    const where: any = {};
    if (options.jobId) {
      const sync = await this.prisma.bitrixSync.findFirst({
        where: { jobId: options.jobId },
      });
      if (sync) {
        where.syncId = sync.id;
      }
    }
    if (options.userId) {
      where.userId = options.userId;
    }

    const [logs, total] = await Promise.all([
      this.prisma.bitrixSyncLog.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { email: true, fullName: true },
          },
        },
      }),
      this.prisma.bitrixSyncLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        userId: log.userId,
        bitrixContactId: log.bitrixContactId || undefined,
        action: log.action as any,
        status: log.status as any,
        message: log.message || undefined,
        timestamp: log.timestamp,
      })),
      meta: {
        total,
        page: options.page,
        limit: options.limit,
      },
    };
  }

  private async runSyncInBackground(jobId: string, forceResync: boolean): Promise<void> {
    return runInSpan(
      'BitrixSyncService.runSyncInBackground',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.bitrixUsersSync,
        [NotarySpanAttributes.entity]: 'BitrixSync',
        'bitrix.sync.status': 'running',
        'bitrix.force_resync': forceResync,
      },
      async (span) => {
        this.isSyncRunning = true;

        try {
          const sync = await this.prisma.bitrixSync.create({
            data: {
              jobId,
              status: 'running',
              totalUsers: 0,
              processedUsers: 0,
              successfulSyncs: 0,
              failedSyncs: 0,
              startedAt: new Date(),
            },
          });

          const users = await this.prisma.user.findMany({
            where: { isActive: true },
            select: {
              id: true,
              email: true,
              fullName: true,
              phoneNumber: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          });
          setSpanAttributes(span, { 'bitrix.sync.total_users': users.length });

          await this.prisma.bitrixSync.update({
            where: { id: sync.id },
            data: { totalUsers: users.length },
          });

          let successfulSyncs = 0;
          let failedSyncs = 0;
          for (let i = 0; i < users.length; i++) {
            const user = users[i];
            try {
              await this.syncUser(user, forceResync, sync.id);

              await this.prisma.bitrixSync.update({
                where: { id: sync.id },
                data: {
                  processedUsers: i + 1,
                  successfulSyncs: { increment: 1 },
                },
              });
              successfulSyncs += 1;
            } catch (error) {
              this.logger.warn(
                `Bitrix user sync failed; operation=bitrix.sync.user; result=error; error=${safeErrorName(error)}`,
              );

              await this.prisma.bitrixSyncLog.create({
                data: {
                  syncId: sync.id,
                  userId: user.id,
                  action: 'error',
                  status: 'error',
                  message: error instanceof Error ? error.message : 'Unknown error',
                  timestamp: new Date(),
                },
              });

              await this.prisma.bitrixSync.update({
                where: { id: sync.id },
                data: {
                  processedUsers: i + 1,
                  failedSyncs: { increment: 1 },
                },
              });
              failedSyncs += 1;
            }
          }

          await this.prisma.bitrixSync.update({
            where: { id: sync.id },
            data: {
              status: 'completed',
              completedAt: new Date(),
            },
          });
          setSpanAttributes(span, {
            'bitrix.sync.status': 'completed',
            'bitrix.sync.successful_count': successfulSyncs,
            'bitrix.sync.failed_count': failedSyncs,
          });
          if (failedSyncs > 0) {
            markSpanFailure(span, new Error('BitrixUserSyncFailed'));
          }
        } catch (error) {
          markSpanFailure(span, error);
          this.logger.error(
            `Bitrix sync job failed; operation=bitrix.sync.job; result=error; error=${safeErrorName(error)}`,
          );

          await this.prisma.bitrixSync.updateMany({
            where: { jobId, status: 'running' },
            data: {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : 'Unknown error',
              completedAt: new Date(),
            },
          });
          setSpanAttributes(span, { 'bitrix.sync.status': 'failed' });
        } finally {
          this.isSyncRunning = false;
        }
      },
      { root: true },
    );
  }

  private async syncUser(user: any, forceResync: boolean, syncId: string): Promise<void> {
    // Проверяем, есть ли уже синхронизация для этого пользователя
    const clientSync = await this.prisma.clientSync.findUnique({
      where: { userId: user.id },
    });

    // Вычисляем хэш данных пользователя
    const userHash = this.calculateUserHash(user);

    // Если синхронизация уже есть и хэш не изменился, и не принудительная пересинхронизация
    if (clientSync && clientSync.lastNotaryHash === userHash && !forceResync) {
      await this.prisma.bitrixSyncLog.create({
        data: {
          syncId,
          userId: user.id,
          bitrixContactId: clientSync.bitrixContactId || undefined,
          action: 'skipped',
          status: 'success',
          message: 'User data unchanged',
          timestamp: new Date(),
        },
      });
      return;
    }

    // Ищем существующий контакт в Bitrix
    let bitrixContactId: string | null = null;

    if (user.phoneNumber) {
      bitrixContactId = await this.apiService.findContactByPhone(user.phoneNumber);
    }

    if (!bitrixContactId && user.email) {
      bitrixContactId = await this.apiService.findContactByEmail(user.email);
    }

    // Подготавливаем данные контакта
    const contactData = this.prepareContactData(user);

    try {
      if (bitrixContactId) {
        // Обновляем существующий контакт
        await this.apiService.updateContact(bitrixContactId, contactData);

        await this.prisma.clientSync.upsert({
          where: { userId: user.id },
          update: {
            bitrixContactId,
            lastSyncedAt: new Date(),
            lastNotaryHash: userHash,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            bitrixContactId,
            lastSyncedAt: new Date(),
            lastNotaryHash: userHash,
          },
        });

        await this.prisma.bitrixSyncLog.create({
          data: {
            syncId,
            userId: user.id,
            bitrixContactId,
            action: 'updated',
            status: 'success',
            message: 'Contact updated in Bitrix',
            timestamp: new Date(),
          },
        });
      } else {
        // Создаем новый контакт
        const newContactId = await this.apiService.createContact(contactData);

        await this.prisma.clientSync.upsert({
          where: { userId: user.id },
          update: {
            bitrixContactId: newContactId,
            lastSyncedAt: new Date(),
            lastNotaryHash: userHash,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            bitrixContactId: newContactId,
            lastSyncedAt: new Date(),
            lastNotaryHash: userHash,
          },
        });

        await this.prisma.bitrixSyncLog.create({
          data: {
            syncId,
            userId: user.id,
            bitrixContactId: newContactId,
            action: 'created',
            status: 'success',
            message: 'Contact created in Bitrix',
            timestamp: new Date(),
          },
        });
      }
    } catch (error) {
      await this.prisma.bitrixSyncLog.create({
        data: {
          syncId,
          userId: user.id,
          action: 'error',
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        },
      });
      throw error;
    }
  }

  private prepareContactData(user: any): any {
    // Разбиваем полное имя на части
    const nameParts = user.fullName.split(' ');
    const lastName = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    const middleName = nameParts[2] || '';

    const contact: any = {
      NAME: firstName,
      LAST_NAME: lastName,
      SECOND_NAME: middleName,
      TYPE_ID: 'PERSON',
      SOURCE_ID: 'NOTARY_SYSTEM',
      UF_CRM_NOTARY_ID: user.id,
    };

    if (user.phoneNumber) {
      contact.PHONE = [
        {
          VALUE: user.phoneNumber,
          VALUE_TYPE: 'WORK',
        },
      ];
    }

    if (user.email) {
      contact.EMAIL = [
        {
          VALUE: user.email,
          VALUE_TYPE: 'WORK',
        },
      ];
    }

    return contact;
  }

  private calculateUserHash(user: any): string {
    const data = {
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      updatedAt: user.updatedAt.toISOString(),
    };

    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}
