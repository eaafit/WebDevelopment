import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { AuditService } from '@internal/audit';
import { getCurrentUser } from '@internal/auth-shared';
import {
  BusinessOperations,
  NotarySpanAttributes,
  SpanKind,
  normalizeSpanActorRole,
  runInSpan,
  setSpanAttributes,
} from '@internal/tracing';
import {
  CreatePaymentResponseSchema,
  PromoValidationStatus,
  PaymentType as RpcPaymentType,
  SubscriptionPlan as RpcSubscriptionPlan,
  ValidateSubscriptionPromoResponseSchema,
  type CreatePaymentRequest,
  type CreatePaymentResponse,
  type ValidateSubscriptionPromoRequest,
  type ValidateSubscriptionPromoResponse,
} from '@notary-portal/api-contracts';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@internal/prisma';
import { MetricsService, type PromoValidationMetricStatus } from '@internal/metrics';
import {
  PaymentReceiptStatus as PrismaPaymentReceiptStatus,
  PaymentStatus as PrismaPaymentStatus,
  SubscriptionPlan as PrismaSubscriptionPlan,
  PaymentType as PrismaPaymentType,
  type Promo,
} from '@internal/prisma-client';
import {
  YooKassaClient,
  YooKassaClientError,
  type YooKassaReceipt,
} from '../yookassa/yookassa.client';
import { RobokassaClient, RobokassaClientError } from '../robokassa/robokassa.client';
import {
  SUBSCRIPTION_CURRENCY,
  getSubscriptionPlanByPrisma,
} from '../subscription/subscription-plan.catalog';
import { PaymentSubscriptionService } from '../subscription/payment-subscription.service';
import { resolveBillingPaymentMetricContext } from '../payment-metrics';
import {
  buildPaymentActionContext,
  buildPaymentAuditSnapshot,
  buildPaymentAuditTarget,
  type PaymentAuditSnapshotInput,
} from '../payment-audit';
import { PaymentNotificationService } from '../payment-notification.service';

const PAYMENT_RETURN_PATH_BY_TYPE: Record<PrismaPaymentType, string> = {
  [PrismaPaymentType.Subscription]: '/notary/subscription/checkout/success',
  [PrismaPaymentType.Assessment]: '/applicant/checkout/success',
  [PrismaPaymentType.DocumentCopy]: '/applicant/checkout/success',
};

interface ResolvedPaymentContext {
  amount: string;
  description: string;
  subscriptionId: string | null;
  assessmentId: string | null;
  promo: Promo | null;
  discountAmount: string | null;
}

interface PromoValidationResult {
  promo: Promo | null;
  promoCode: string;
  status: PromoValidationStatus;
}

type PaymentProvider = 'yookassa' | 'robokassa';

@Injectable()
export class PaymentCreateService {
  private readonly logger = new Logger(PaymentCreateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaClient,
    private readonly robokassa: RobokassaClient,
    private readonly metrics: MetricsService,
    private readonly paymentSubscriptionService: PaymentSubscriptionService,
    private readonly auditService: AuditService,
    private readonly paymentNotificationService: PaymentNotificationService,
  ) {}

  async createPayment(request: CreatePaymentRequest): Promise<CreatePaymentResponse> {
    return runInSpan(
      'PaymentCreateService.createPayment',
      {
        [NotarySpanAttributes.operation]: BusinessOperations.paymentCreate,
        [NotarySpanAttributes.entity]: 'Payment',
        [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
        'payment.type': formatRpcPaymentType(request.type),
        'payment.has_promo': Boolean(request.promoCode?.trim()),
      },
      async (span) => {
        const requestAmount = parseAmountToCents(request.amount, 'amount');
        const prismaType = this.toPrismaType(request.type);
        const metricContext = resolveBillingPaymentMetricContext(prismaType);
        const provider = resolvePaymentProvider(request.paymentProvider);
        const resolved = await runInSpan(
          'PaymentCreateService.resolvePaymentContext',
          {
            'notary.operation': 'payment.resolve_context',
            'notary.entity': 'Payment',
            'payment.type': formatPrismaPaymentType(prismaType),
            'payment.has_promo': Boolean(request.promoCode?.trim()),
          },
          () => this.resolvePaymentContext(request, prismaType, requestAmount),
        );
        setSpanAttributes(span, {
          'payment.type': formatPrismaPaymentType(prismaType),
          'payment.provider': provider,
          'payment.has_promo': Boolean(resolved.promo),
        });

        this.assertReturnUrlConfigured();
        if (provider === 'yookassa') {
          resolveReceiptVatCode();
        }

        const payment = await runInSpan(
          'Prisma.payment.create',
          {
            'notary.operation': 'payment.db.create',
            'notary.entity': 'Payment',
            'db.operation': 'insert',
            'payment.type': formatPrismaPaymentType(prismaType),
            'payment.status.to': PrismaPaymentStatus.Pending,
            'payment.provider': provider,
            'payment.has_promo': Boolean(resolved.promo),
          },
          () =>
            this.prisma.payment.create({
              data: {
                userId: request.userId,
                type: prismaType,
                amount: resolved.amount,
                discountAmount: resolved.discountAmount,
                promoId: resolved.promo?.id ?? null,
                status: PrismaPaymentStatus.Pending,
                subscriptionId: resolved.subscriptionId,
                assessmentId: resolved.assessmentId,
                paymentMethod: provider === 'robokassa' ? 'robokassa_redirect' : 'yookassa_widget',
                receiptStatus:
                  provider === 'robokassa'
                    ? PrismaPaymentReceiptStatus.Available
                    : PrismaPaymentReceiptStatus.Pending,
              },
            }),
        );

        this.metrics.recordPayment('pending');
        this.metrics.recordBillingPayment('pending', metricContext);

        try {
          if (provider === 'robokassa') {
            const result = await runInSpan(
              'RobokassaClient.createPayment',
              {
                [NotarySpanAttributes.operation]: BusinessOperations.paymentProviderCreate,
                'notary.entity': 'Payment',
                'payment.provider': 'robokassa',
                'payment.type': formatPrismaPaymentType(prismaType),
                'payment.status.to': PrismaPaymentStatus.Pending,
              },
              () =>
                this.robokassa.createPayment({
                  invoiceId: payment.id,
                  amount: resolved.amount,
                  description: resolved.description,
                }),
              { kind: SpanKind.CLIENT },
            );

            await runInSpan(
              'Prisma.payment.update transactionId',
              {
                'notary.operation': 'payment.db.update',
                'notary.entity': 'Payment',
                'db.operation': 'update',
                'payment.provider': 'robokassa',
                'payment.status.from': PrismaPaymentStatus.Pending,
                'payment.status.to': PrismaPaymentStatus.Pending,
              },
              () =>
                this.prisma.payment.update({
                  where: { id: payment.id },
                  data: { transactionId: payment.id },
                }),
            );

            await this.recordPaymentCreatedAudit(
              request.userId,
              {
                id: payment.id,
                type: prismaType,
                amount: resolved.amount,
                discountAmount: resolved.discountAmount,
                status: PrismaPaymentStatus.Pending,
                transactionId: payment.id,
                paymentMethod: 'robokassa_redirect',
                subscriptionId: resolved.subscriptionId,
                assessmentId: resolved.assessmentId,
                promoId: resolved.promo?.id ?? null,
              },
              'Robokassa',
            );

            this.logger.log(
              `Payment provider create succeeded; operation=payment.provider.create; provider=robokassa; payment.type=${formatPrismaPaymentType(prismaType)}; result=success; hasReceipt=true`,
            );

            return create(CreatePaymentResponseSchema, {
              paymentId: payment.id,
              paymentUrl: result.paymentUrl,
              amount: {
                amount: resolved.amount,
                currency: SUBSCRIPTION_CURRENCY,
              },
            });
          }

          const receipt = await runInSpan(
            'PaymentCreateService.buildPaymentReceipt',
            {
              'notary.operation': 'payment.receipt.build',
              'notary.entity': 'PaymentReceipt',
              'payment.provider': 'yookassa',
              'payment.receipt.status': PrismaPaymentReceiptStatus.Pending,
            },
            () => this.buildPaymentReceipt(request.userId, resolved),
          );
          const returnUrl = this.buildReturnUrl(prismaType, payment.id);

          const result = await runInSpan(
            'YooKassaClient.createPayment',
            {
              [NotarySpanAttributes.operation]: BusinessOperations.paymentProviderCreate,
              'notary.entity': 'Payment',
              'payment.provider': 'yookassa',
              'payment.type': formatPrismaPaymentType(prismaType),
              'payment.status.to': PrismaPaymentStatus.Pending,
              'payment.has_promo': Boolean(resolved.promo),
            },
            () =>
              this.yookassa.createPayment({
                amount: resolved.amount,
                currency: SUBSCRIPTION_CURRENCY,
                returnUrl,
                description: resolved.description,
                idempotenceKey: payment.id,
                confirmationType: 'embedded',
                metadata: {
                  payment_id: payment.id,
                  user_id: request.userId,
                  type: String(request.type),
                  target_id: request.targetId,
                  ...(resolved.promo ? { promo_code: resolved.promo.code } : {}),
                },
                ...(receipt ? { receipt } : {}),
              }),
            { kind: SpanKind.CLIENT },
          );

          await runInSpan(
            'Prisma.payment.update transactionId',
            {
              'notary.operation': 'payment.db.update',
              'notary.entity': 'Payment',
              'db.operation': 'update',
              'payment.provider': 'yookassa',
              'payment.status.from': PrismaPaymentStatus.Pending,
              'payment.status.to': PrismaPaymentStatus.Pending,
            },
            () =>
              this.prisma.payment.update({
                where: { id: payment.id },
                data: { transactionId: result.id },
              }),
          );

          await this.recordPaymentCreatedAudit(
            request.userId,
            {
              id: payment.id,
              type: prismaType,
              amount: resolved.amount,
              discountAmount: resolved.discountAmount,
              status: PrismaPaymentStatus.Pending,
              transactionId: result.id,
              paymentMethod: 'yookassa_widget',
              subscriptionId: resolved.subscriptionId,
              assessmentId: resolved.assessmentId,
              promoId: resolved.promo?.id ?? null,
            },
            'YooKassa',
          );
          await runInSpan(
            'PaymentNotificationService.notifyPaymentCreated',
            {
              [NotarySpanAttributes.operation]: BusinessOperations.notificationCreatePayment,
              'notary.entity': 'Notification',
              'notification.category': 'payment',
              'payment.provider': 'yookassa',
            },
            () =>
              this.paymentNotificationService.notifyPaymentCreated({
                id: payment.id,
                userId: request.userId,
                type: prismaType,
                amount: resolved.amount,
                status: PrismaPaymentStatus.Pending,
                transactionId: result.id,
                paymentMethod: 'yookassa_widget',
                subscriptionId: resolved.subscriptionId,
                assessmentId: resolved.assessmentId,
              }),
          );

          this.logger.log(
            `Payment provider create succeeded; operation=payment.provider.create; provider=yookassa; payment.type=${formatPrismaPaymentType(prismaType)}; result=success; hasReceipt=${Boolean(receipt)}`,
          );

          return create(CreatePaymentResponseSchema, {
            paymentId: payment.id,
            paymentUrl: result.confirmationUrl || undefined,
            widget: {
              provider: 'yookassa',
              confirmationToken: result.confirmationToken,
              returnUrl,
            },
            amount: {
              amount: resolved.amount,
              currency: SUBSCRIPTION_CURRENCY,
            },
          });
        } catch (err) {
          if (err instanceof YooKassaClientError || err instanceof RobokassaClientError) {
            this.metrics.recordPayment('failed');
            this.metrics.recordBillingPayment('failed', metricContext);

            const paymentProvider = provider === 'robokassa' ? 'Robokassa' : 'YooKassa';

            await runInSpan(
              'Prisma.payment.update failed',
              {
                'notary.operation': 'payment.db.update',
                'notary.entity': 'Payment',
                'db.operation': 'update',
                'payment.provider': provider,
                'payment.status.from': PrismaPaymentStatus.Pending,
                'payment.status.to': PrismaPaymentStatus.Failed,
              },
              () =>
                this.prisma.payment.update({
                  where: { id: payment.id },
                  data: { status: PrismaPaymentStatus.Failed },
                }),
            );

            const failedPaymentMethod =
              provider === 'robokassa' ? 'robokassa_redirect' : 'yookassa_widget';

            await this.recordPaymentCreationFailedAudit(
              request.userId,
              {
                id: payment.id,
                type: prismaType,
                amount: resolved.amount,
                discountAmount: resolved.discountAmount,
                status: PrismaPaymentStatus.Failed,
                paymentMethod: failedPaymentMethod,
                subscriptionId: resolved.subscriptionId,
                assessmentId: resolved.assessmentId,
                promoId: resolved.promo?.id ?? null,
                errorMessage: err.message || 'Payment provider error',
                providerStatusCode: 'statusCode' in err ? (err.statusCode ?? null) : null,
              },
              paymentProvider,
            );
            await runInSpan(
              'PaymentNotificationService.notifyPaymentCreationFailed',
              {
                [NotarySpanAttributes.operation]:
                  BusinessOperations.notificationCreatePaymentFailed,
                'notary.entity': 'Notification',
                'notification.category': 'payment',
                'payment.provider': provider,
                'payment.status.to': PrismaPaymentStatus.Failed,
              },
              () =>
                this.paymentNotificationService.notifyPaymentCreationFailed(
                  {
                    id: payment.id,
                    userId: request.userId,
                    type: prismaType,
                    amount: resolved.amount,
                    status: PrismaPaymentStatus.Failed,
                    paymentMethod: failedPaymentMethod,
                    subscriptionId: resolved.subscriptionId,
                    assessmentId: resolved.assessmentId,
                  },
                  err.message || 'Payment provider error',
                ),
            );

            throw new ConnectError(err.message || 'Payment provider error', Code.Internal);
          }

          // Fallback: create payment directly without external payment provider
          this.metrics.recordPayment('failed');
          this.metrics.recordBillingPayment('failed', metricContext);

          this.logger.warn(
            `Payment provider unavailable; operation=payment.provider.create; provider=${provider}; result=fallback; error=${safeErrorName(err)}`,
          );

          await runInSpan(
            'PaymentCreateService.directFallback',
            {
              'notary.operation': 'payment.direct_fallback',
              'notary.entity': 'Payment',
              'payment.provider': 'direct',
              'payment.status.from': PrismaPaymentStatus.Pending,
              'payment.status.to': PrismaPaymentStatus.Pending,
              'payment.receipt.status': PrismaPaymentReceiptStatus.Available,
            },
            async () => {
              await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                  paymentMethod: 'direct',
                  receiptStatus: PrismaPaymentReceiptStatus.Available,
                },
              });
            },
          );

          await this.recordPaymentCreatedAudit(
            request.userId,
            {
              id: payment.id,
              type: prismaType,
              amount: resolved.amount,
              discountAmount: resolved.discountAmount,
              status: PrismaPaymentStatus.Pending,
              paymentMethod: 'direct',
              subscriptionId: resolved.subscriptionId,
              assessmentId: resolved.assessmentId,
              promoId: resolved.promo?.id ?? null,
            },
            'Direct',
          );
          await runInSpan(
            'PaymentNotificationService.notifyPaymentCreated direct',
            {
              [NotarySpanAttributes.operation]: BusinessOperations.notificationCreatePayment,
              'notary.entity': 'Notification',
              'notification.category': 'payment',
              'payment.provider': 'direct',
            },
            () =>
              this.paymentNotificationService.notifyPaymentCreated({
                id: payment.id,
                userId: request.userId,
                type: prismaType,
                amount: resolved.amount,
                status: PrismaPaymentStatus.Pending,
                paymentMethod: 'direct',
                subscriptionId: resolved.subscriptionId,
                assessmentId: resolved.assessmentId,
              }),
          );

          return create(CreatePaymentResponseSchema, {
            paymentId: payment.id,
            amount: {
              amount: resolved.amount,
              currency: SUBSCRIPTION_CURRENCY,
            },
          });
        }
      },
    );
  }

  async validateSubscriptionPromo(
    request: ValidateSubscriptionPromoRequest,
  ): Promise<ValidateSubscriptionPromoResponse> {
    return runInSpan(
      'PaymentCreateService.validateSubscriptionPromo',
      {
        'notary.operation': 'payment.promo.validate',
        'notary.entity': 'Promo',
        'payment.type': PrismaPaymentType.Subscription,
        'payment.has_promo': Boolean(request.promoCode?.trim()),
      },
      async (span) => {
        const plan = getSubscriptionPlanByPrisma(this.toPrismaPlan(request.plan));
        const baseAmountCents = parseAmountToCents(plan.price, 'plan.price');
        const promoValidation = await this.validatePromoCode(request.promoCode);
        setSpanAttributes(span, {
          'payment.promo.status': formatPromoStatus(promoValidation.status),
        });
        this.metrics.recordPromoValidation(
          'preview',
          toPromoValidationMetricStatus(promoValidation.status),
        );

        if (promoValidation.status !== PromoValidationStatus.VALID || !promoValidation.promo) {
          return create(ValidateSubscriptionPromoResponseSchema, {
            status: promoValidation.status,
            promoCode: promoValidation.promoCode,
            baseAmount: {
              amount: plan.price,
              currency: SUBSCRIPTION_CURRENCY,
            },
            finalAmount: {
              amount: plan.price,
              currency: SUBSCRIPTION_CURRENCY,
            },
            discountAmount: {
              amount: centsToAmount(0),
              currency: SUBSCRIPTION_CURRENCY,
            },
            discountPercent: '0.00',
          });
        }

        const discountAmount = calculateDiscountAmount(
          baseAmountCents,
          promoValidation.promo.discountPercent.toString(),
        );
        const finalAmount = Math.max(0, baseAmountCents - discountAmount);

        return create(ValidateSubscriptionPromoResponseSchema, {
          status: PromoValidationStatus.VALID,
          promoCode: promoValidation.promo.code,
          baseAmount: {
            amount: plan.price,
            currency: SUBSCRIPTION_CURRENCY,
          },
          finalAmount: {
            amount: centsToAmount(finalAmount),
            currency: SUBSCRIPTION_CURRENCY,
          },
          discountAmount: {
            amount: centsToAmount(discountAmount),
            currency: SUBSCRIPTION_CURRENCY,
          },
          discountPercent: promoValidation.promo.discountPercent.toString(),
        });
      },
    );
  }

  private async loadReceiptCustomer(userId: string): Promise<{ email: string }> {
    const user = await runInSpan(
      'Prisma.user.findUnique receipt customer',
      {
        'notary.operation': 'payment.receipt.customer_lookup',
        'notary.entity': 'User',
        'db.operation': 'select',
      },
      () =>
        this.prisma.user.findUnique({
          where: { id: userId },
          select: {
            email: true,
          },
        }),
    );

    if (!user?.email?.trim()) {
      throw new ConnectError(
        'User email is required to create receipt data',
        Code.FailedPrecondition,
      );
    }

    return {
      email: user.email.trim(),
    };
  }

  private async buildPaymentReceipt(
    userId: string,
    resolved: Pick<ResolvedPaymentContext, 'amount' | 'description'>,
  ): Promise<YooKassaReceipt> {
    const receiptCustomer = await this.loadReceiptCustomer(userId);

    return {
      customer: {
        email: receiptCustomer.email,
      },
      items: [
        {
          description: resolved.description,
          quantity: '1.000',
          amount: {
            value: resolved.amount,
            currency: SUBSCRIPTION_CURRENCY,
          },
          vatCode: resolveReceiptVatCode(),
          paymentMode: 'full_prepayment',
          paymentSubject: 'service',
        },
      ],
      internet: true,
    };
  }

  private async resolvePaymentContext(
    request: CreatePaymentRequest,
    prismaType: PrismaPaymentType,
    requestAmountCents: number,
  ): Promise<ResolvedPaymentContext> {
    const promo = await this.findPromo(request.promoCode);

    switch (prismaType) {
      case PrismaPaymentType.Subscription: {
        const subscription = await this.paymentSubscriptionService.resolveSubscriptionForPayment(
          request.targetId,
          request.userId,
        );
        const plan = getSubscriptionPlanByPrisma(subscription.plan);
        const baseAmount = parseAmountToCents(
          subscription.basePrice?.toString() ?? plan.price,
          'subscription.basePrice',
        );
        const discountAmount = promo
          ? calculateDiscountAmount(baseAmount, promo.discountPercent.toString())
          : 0;
        const finalAmount = Math.max(0, baseAmount - discountAmount);

        if (requestAmountCents < 1) {
          throw new ConnectError('amount must be a positive number', Code.InvalidArgument);
        }

        return {
          amount: centsToAmount(finalAmount),
          description: `Подписка ${plan.title}`,
          subscriptionId: subscription.id,
          assessmentId: null,
          promo,
          discountAmount: discountAmount > 0 ? centsToAmount(discountAmount) : null,
        };
      }

      case PrismaPaymentType.Assessment: {
        const isApplicantBalanceTopUp = request.targetId === request.userId;

        return {
          amount: centsToAmount(requestAmountCents),
          description: isApplicantBalanceTopUp ? 'Пополнение баланса' : 'Оплата оценки имущества',
          subscriptionId: null,
          assessmentId: isApplicantBalanceTopUp ? null : request.targetId,
          promo: null,
          discountAmount: null,
        };
      }

      case PrismaPaymentType.DocumentCopy:
        return {
          amount: centsToAmount(requestAmountCents),
          description: 'Оплата копии нотариального документа',
          subscriptionId: null,
          assessmentId: null,
          promo: null,
          discountAmount: null,
        };
    }
  }

  private async findPromo(rawPromoCode: string): Promise<Promo | null> {
    const promoCode = rawPromoCode.trim();
    if (!promoCode) {
      return null;
    }

    const validation = await this.validatePromoCode(rawPromoCode);
    this.metrics.recordPromoValidation(
      'payment_create',
      toPromoValidationMetricStatus(validation.status),
    );

    if (validation.status === PromoValidationStatus.VALID) {
      return validation.promo;
    }

    switch (validation.status) {
      case PromoValidationStatus.NOT_FOUND:
        throw new ConnectError('Promo code was not found', Code.InvalidArgument);
      case PromoValidationStatus.EXPIRED:
        throw new ConnectError('Promo code has expired', Code.InvalidArgument);
      case PromoValidationStatus.USAGE_LIMIT_REACHED:
        throw new ConnectError('Promo code usage limit has been reached', Code.InvalidArgument);
      case PromoValidationStatus.UNSPECIFIED:
      default:
        throw new ConnectError('Promo code is invalid', Code.InvalidArgument);
    }
  }

  private async recordPaymentCreatedAudit(
    actorUserId: string,
    payment: PaymentAuditSnapshotInput,
    paymentProvider: string,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);

    await this.auditService.record({
      actorUserId: getCurrentUser()?.sub ?? actorUserId,
      eventType: 'payment.created',
      ...target,
      actionTitle: 'Создан платёж',
      actionContext: buildPaymentActionContext(payment),
      after: buildPaymentAuditSnapshot(payment, {
        paymentProvider,
      }),
    });
  }

  private async recordPaymentCreationFailedAudit(
    actorUserId: string,
    payment: PaymentAuditSnapshotInput & {
      errorMessage: string;
      providerStatusCode?: number | null;
    },
    paymentProvider: string,
  ): Promise<void> {
    const target = buildPaymentAuditTarget(payment);

    await this.auditService.record({
      actorUserId: getCurrentUser()?.sub ?? actorUserId,
      eventType: 'payment.failed',
      ...target,
      actionTitle: 'Платёж отклонён',
      actionContext: `Ошибка при создании платежа в ${paymentProvider}`,
      after: buildPaymentAuditSnapshot(payment, {
        paymentProvider,
        errorMessage: payment.errorMessage,
        providerStatusCode: payment.providerStatusCode,
      }),
    });
  }

  private async validatePromoCode(rawPromoCode: string): Promise<PromoValidationResult> {
    return runInSpan(
      'PaymentCreateService.validatePromoCode',
      {
        'notary.operation': 'payment.promo.validate',
        'notary.entity': 'Promo',
        'payment.has_promo': Boolean(rawPromoCode?.trim()),
      },
      async (span) => {
        const promoCode = rawPromoCode.trim();
        if (!promoCode) {
          const result = {
            promo: null,
            promoCode,
            status: PromoValidationStatus.UNSPECIFIED,
          };
          setSpanAttributes(span, { 'payment.promo.status': formatPromoStatus(result.status) });
          return result;
        }

        const promo = await this.prisma.promo.findFirst({
          where: {
            code: {
              equals: promoCode,
              mode: 'insensitive',
            },
          },
        });

        if (!promo) {
          const result = {
            promo: null,
            promoCode,
            status: PromoValidationStatus.NOT_FOUND,
          };
          setSpanAttributes(span, { 'payment.promo.status': formatPromoStatus(result.status) });
          return result;
        }

        if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
          const result = {
            promo: null,
            promoCode,
            status: PromoValidationStatus.EXPIRED,
          };
          setSpanAttributes(span, { 'payment.promo.status': formatPromoStatus(result.status) });
          return result;
        }

        if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
          const result = {
            promo: null,
            promoCode,
            status: PromoValidationStatus.USAGE_LIMIT_REACHED,
          };
          setSpanAttributes(span, { 'payment.promo.status': formatPromoStatus(result.status) });
          return result;
        }

        const result = {
          promo,
          promoCode: promo.code,
          status: PromoValidationStatus.VALID,
        };
        setSpanAttributes(span, { 'payment.promo.status': formatPromoStatus(result.status) });
        return result;
      },
    );
  }

  private buildReturnUrl(type: PrismaPaymentType, paymentId: string): string {
    const path = PAYMENT_RETURN_PATH_BY_TYPE[type];
    const returnUrl = new URL(path, getPaymentReturnUrlBase());
    returnUrl.searchParams.set('paymentId', paymentId);
    return returnUrl.toString();
  }

  private assertReturnUrlConfigured(): void {
    if (getPaymentReturnUrlBase()) {
      return;
    }

    throw new ConnectError(
      'Payment return URL is not configured: set PAYMENT_RETURN_URL_BASE or FRONTEND_URL',
      Code.Internal,
    );
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

  private toPrismaPlan(plan: RpcSubscriptionPlan): PrismaSubscriptionPlan {
    switch (plan) {
      case RpcSubscriptionPlan.BASIC:
        return PrismaSubscriptionPlan.Basic;
      case RpcSubscriptionPlan.PREMIUM:
        return PrismaSubscriptionPlan.Premium;
      case RpcSubscriptionPlan.ENTERPRISE:
        return PrismaSubscriptionPlan.Enterprise;
      default:
        throw new ConnectError('subscription plan is required', Code.InvalidArgument);
    }
  }
}

function parseAmountToCents(value: string, fieldName: string): number {
  const normalized = value.trim();
  const amount = Number(normalized);
  if (!normalized || Number.isNaN(amount) || amount <= 0) {
    throw new ConnectError(`${fieldName} must be a positive number`, Code.InvalidArgument);
  }
  return Math.round(amount * 100);
}

function centsToAmount(value: number): string {
  return (value / 100).toFixed(2);
}

function calculateDiscountAmount(baseAmountCents: number, percent: string): number {
  const discountPercent = Number(percent);
  if (Number.isNaN(discountPercent) || discountPercent <= 0) {
    return 0;
  }

  return Math.round(baseAmountCents * (discountPercent / 100));
}

function getPaymentReturnUrlBase(): string {
  return (process.env['PAYMENT_RETURN_URL_BASE'] ?? process.env['FRONTEND_URL'] ?? '').trim();
}

function resolvePaymentProvider(requestProvider?: string): PaymentProvider {
  const explicit = requestProvider?.trim().toLowerCase();
  if (explicit === 'robokassa' || explicit === 'yookassa') {
    return explicit;
  }

  const provider = (process.env['PAYMENT_PROVIDER'] ?? 'yookassa').trim().toLowerCase();
  if (provider === 'robokassa') {
    return 'robokassa';
  }

  return 'yookassa';
}

function resolveReceiptVatCode(): number {
  const rawValue = process.env['YOOKASSA_RECEIPT_VAT_CODE']?.trim();
  if (!rawValue) {
    throw new ConnectError(
      'YOOKASSA_RECEIPT_VAT_CODE must be configured for subscription receipts',
      Code.FailedPrecondition,
    );
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 12) {
    throw new ConnectError(
      'YOOKASSA_RECEIPT_VAT_CODE must be an integer from 1 to 12',
      Code.FailedPrecondition,
    );
  }

  return value;
}

function toPromoValidationMetricStatus(status: PromoValidationStatus): PromoValidationMetricStatus {
  switch (status) {
    case PromoValidationStatus.VALID:
      return 'valid';
    case PromoValidationStatus.NOT_FOUND:
      return 'not_found';
    case PromoValidationStatus.EXPIRED:
      return 'expired';
    case PromoValidationStatus.USAGE_LIMIT_REACHED:
      return 'usage_limit_reached';
    case PromoValidationStatus.UNSPECIFIED:
    default:
      return 'unspecified';
  }
}

function formatRpcPaymentType(type: RpcPaymentType): string {
  switch (type) {
    case RpcPaymentType.SUBSCRIPTION:
      return 'subscription';
    case RpcPaymentType.DOCUMENT_COPY:
      return 'document_copy';
    case RpcPaymentType.ASSESSMENT:
      return 'assessment';
    case RpcPaymentType.UNSPECIFIED:
    default:
      return 'unspecified';
  }
}

function formatPrismaPaymentType(type: PrismaPaymentType): string {
  switch (type) {
    case PrismaPaymentType.Subscription:
      return 'subscription';
    case PrismaPaymentType.DocumentCopy:
      return 'document_copy';
    case PrismaPaymentType.Assessment:
      return 'assessment';
    default:
      return 'unknown';
  }
}

function formatPromoStatus(status: PromoValidationStatus): string {
  switch (status) {
    case PromoValidationStatus.VALID:
      return 'valid';
    case PromoValidationStatus.NOT_FOUND:
      return 'not_found';
    case PromoValidationStatus.EXPIRED:
      return 'expired';
    case PromoValidationStatus.USAGE_LIMIT_REACHED:
      return 'usage_limit_reached';
    case PromoValidationStatus.UNSPECIFIED:
    default:
      return 'unspecified';
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error && error.name.trim() ? error.name : 'UnknownError';
}
