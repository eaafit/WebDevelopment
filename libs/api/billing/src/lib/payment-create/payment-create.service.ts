import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  CreatePaymentResponseSchema,
  PaymentType as RpcPaymentType,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
} from '@notary-portal/api-contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { MetricsService } from '@internal/metrics';
import {
  PaymentStatus as PrismaPaymentStatus,
  PaymentType as PrismaPaymentType,
} from '@internal/prisma-client';
import { YooKassaClient, YooKassaClientError } from '../yookassa/yookassa.client';

const PAYMENT_RETURN_URL_BASE =
  process.env['PAYMENT_RETURN_URL_BASE'] ?? process.env['FRONTEND_URL'] ?? '';
const PAYMENT_RETURN_PATH_SUCCESS = '/notary/subscription/checkout/success';

@Injectable()
export class PaymentCreateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaClient,
    private readonly metrics: MetricsService,
  ) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    const amount = parseFloat(request.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      throw new ConnectError('amount must be a positive number', Code.InvalidArgument);
    }

    const returnUrlBase = PAYMENT_RETURN_URL_BASE.trim();
    if (!returnUrlBase) {
      throw new ConnectError(
        'Payment return URL is not configured: set PAYMENT_RETURN_URL_BASE or FRONTEND_URL',
        Code.Internal,
      );
    }

    const returnUrl = new URL(PAYMENT_RETURN_PATH_SUCCESS, returnUrlBase).toString();
    const prismaType = this.toPrismaType(request.type);

    const subscriptionId = prismaType === PrismaPaymentType.Subscription ? request.targetId : null;
    const assessmentId = prismaType === PrismaPaymentType.Assessment ? request.targetId : null;

    const payment = await this.prisma.payment.create({
      data: {
        userId: request.userId,
        type: prismaType,
        status: PrismaPaymentStatus.Pending,
        amount,
        subscriptionId,
        assessmentId,
        paymentMethod: 'yookassa',
      },
    });

    this.metrics.recordPayment('pending');

    try {
      const result = await this.yookassa.createPayment({
        amount: request.amount,
        currency: 'RUB',
        returnUrl,
        description: `Payment ${payment.id}`,
        idempotenceKey: payment.id,
        metadata: {
          payment_id: payment.id,
          user_id: request.userId,
          type: String(request.type),
        },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { transactionId: result.id },
      });

      return create(CreatePaymentResponseSchema, {
        paymentUrl: result.confirmationUrl,
        paymentId: payment.id,
      });
    } catch (err) {
      if (err instanceof YooKassaClientError) {
        this.metrics.recordPayment('failed');
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PrismaPaymentStatus.Failed },
        });
        throw new ConnectError(err.message || 'Payment provider error', Code.Internal);
      }
      throw err;
    }
  }

  private toPrismaType(type: RpcPaymentType): PrismaPaymentType {
    switch (type) {
      case RpcPaymentType.SUBSCRIPTION:
        return PrismaPaymentType.Subscription;
      case RpcPaymentType.ASSESSMENT:
        return PrismaPaymentType.Assessment;
      case RpcPaymentType.DOCUMENT_COPY:
        return PrismaPaymentType.DocumentCopy;
      case RpcPaymentType.UNSPECIFIED:
        throw new ConnectError('payment type is required', Code.InvalidArgument);
    }
    throw new ConnectError(`Unsupported payment type: ${type}`, Code.InvalidArgument);
  }
}
