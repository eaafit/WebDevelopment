import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { BitrixOrdersApiService } from './bitrix-orders-api.service';
import { BitrixOrdersConfigService } from './bitrix-orders-config.service';
import { buildOrderFields } from './bitrix-order.mapper';
import {
  BitrixApiError,
  BitrixRateLimitError,
  BitrixUnavailableError,
} from './bitrix-orders.errors';
import { retryWithBackoff } from './bitrix-orders-retry.helper';

@Injectable()
export class BitrixOrderPublisherService {
  private readonly logger = new Logger(BitrixOrderPublisherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: BitrixOrdersApiService,
    private readonly config: BitrixOrdersConfigService,
  ) {}

  async publishOrder(orderId: string): Promise<void> {
    if (!this.config.isConfigured()) {
      this.logger.log(`Bitrix not configured, skipping order ${orderId}`);
      return;
    }

    const lead = await this.prisma.lead.findUnique({
      where: { id: orderId },
      include: {
        assessment: true,
        applicant: true,
      },
    });

    if (!lead) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (lead.bitrixOrderId) {
      this.logger.log(`Order ${orderId} already published as ${lead.bitrixOrderId}`);
      return;
    }

    // Подготовка данных для маппера
    const leadForMapper = {
      id: lead.id,
      totalAmount: lead.assessment?.estimatedValue?.toString() ?? null,
      assessment: {
        id: lead.assessmentId,
        address: lead.assessment?.address ?? '',
        description: lead.assessment?.description,
      },
      applicant: {
        id: lead.applicant.id,
        fullName: lead.applicant.fullName,
        email: lead.applicant.email,
        phoneNumber: lead.applicant.phoneNumber,
      },
    };

    const fields = buildOrderFields(leadForMapper);

    const orderIdBitrix = await retryWithBackoff(() => this.api.createOrder(fields), {
      isRetriable: (error) =>
        error instanceof BitrixUnavailableError || error instanceof BitrixRateLimitError,
      onRetry: (attempt, error) => {
        const code = error instanceof BitrixApiError ? error.code : 'unknown';
        this.logger.warn(`Bitrix retry ${attempt}/3 for order ${orderId}: ${code}`);
      },
    });

    await this.prisma.lead.update({
      where: { id: orderId },
      data: { bitrixOrderId: String(orderIdBitrix) },
    });

    this.logger.log(`Bitrix order published: orderId=${orderId}, bitrixOrderId=${orderIdBitrix}`);
  }
}