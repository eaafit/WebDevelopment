import { Injectable } from '@nestjs/common';
import {
  Counter,
  collectDefaultMetrics,
  register as defaultRegister,
  type Registry,
} from 'prom-client';

const PREFIX = 'notary_';

export type BillingPaymentActor = 'notary' | 'applicant';
export type BillingPaymentScenario =
  | 'subscription'
  | 'assessment_service'
  | 'document_copy_service';
export type BillingPaymentStatus = 'pending' | 'completed' | 'failed';
export type PromoValidationMetricStatus =
  | 'valid'
  | 'not_found'
  | 'expired'
  | 'usage_limit_reached'
  | 'unspecified';
export type PromoValidationFlow = 'preview' | 'payment_create';
export type PromoDiscountType = 'percent';
export type PaymentHistoryScope = 'user' | 'all';
export type MetricsResult = 'success' | 'failed';

export interface BillingPaymentMetricContext {
  actor: BillingPaymentActor;
  scenario: BillingPaymentScenario;
}

@Injectable()
export class MetricsService {
  private readonly register: Registry = defaultRegister;

  private readonly assessmentsCreated: Counter<string>;
  private readonly paymentsTotal: Counter<string>;
  private readonly paymentsAmountTotal: Counter<string>;
  private readonly billingPaymentEventsTotal: Counter<'actor' | 'scenario' | 'status'>;
  private readonly billingPaymentAmountTotal: Counter<'actor' | 'scenario'>;
  private readonly promoValidationTotal: Counter<'flow' | 'status'>;
  private readonly promoAppliedTotal: Counter<'scenario' | 'discount_type'>;
  private readonly promoDiscountAmountTotal: Counter<'scenario' | 'discount_type'>;
  private readonly paymentHistoryRequestsTotal: Counter<'scope' | 'result'>;
  private readonly usersRegistered: Counter<string>;
  private readonly auditEventsTotal: Counter<string>;
  private readonly reportsGenerated: Counter<string>;

  constructor() {
    collectDefaultMetrics({ register: this.register, prefix: PREFIX });

    this.assessmentsCreated = new Counter({
      name: `${PREFIX}assessments_created_total`,
      help: 'Total number of assessments created',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.paymentsTotal = new Counter({
      name: `${PREFIX}payments_total`,
      help: 'Total number of payment attempts',
      labelNames: ['status'],
      registers: [this.register],
    });

    this.paymentsAmountTotal = new Counter({
      name: `${PREFIX}payments_amount_total`,
      help: 'Total amount of completed payments in base currency units',
      registers: [this.register],
    });

    this.billingPaymentEventsTotal = new Counter({
      name: `${PREFIX}billing_payment_events_total`,
      help: 'Total number of billing payment lifecycle events by actor, scenario, and status',
      labelNames: ['actor', 'scenario', 'status'],
      registers: [this.register],
    });

    this.billingPaymentAmountTotal = new Counter({
      name: `${PREFIX}billing_payment_amount_total`,
      help: 'Total amount of completed billing payments in base currency units by actor and scenario',
      labelNames: ['actor', 'scenario'],
      registers: [this.register],
    });

    this.promoValidationTotal = new Counter({
      name: `${PREFIX}billing_promo_validation_total`,
      help: 'Total number of promo code validation attempts by flow and result status',
      labelNames: ['flow', 'status'],
      registers: [this.register],
    });

    this.promoAppliedTotal = new Counter({
      name: `${PREFIX}billing_promo_applied_total`,
      help: 'Total number of promo codes applied to completed payments',
      labelNames: ['scenario', 'discount_type'],
      registers: [this.register],
    });

    this.promoDiscountAmountTotal = new Counter({
      name: `${PREFIX}billing_promo_discount_amount_total`,
      help: 'Total discount amount from promo codes applied to completed payments in base currency units',
      labelNames: ['scenario', 'discount_type'],
      registers: [this.register],
    });

    this.paymentHistoryRequestsTotal = new Counter({
      name: `${PREFIX}billing_payment_history_requests_total`,
      help: 'Total number of payment history requests by scope and result',
      labelNames: ['scope', 'result'],
      registers: [this.register],
    });

    this.usersRegistered = new Counter({
      name: `${PREFIX}users_registered_total`,
      help: 'Total number of user registrations',
      registers: [this.register],
    });

    this.auditEventsTotal = new Counter({
      name: `${PREFIX}audit_events_total`,
      help: 'Total number of audit log events',
      labelNames: ['severity'],
      registers: [this.register],
    });

    this.reportsGenerated = new Counter({
      name: `${PREFIX}reports_generated_total`,
      help: 'Total number of reports generated',
      registers: [this.register],
    });
  }

  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  getContentType(): string {
    return this.register.contentType;
  }

  recordAssessmentCreated(status = 'new'): void {
    this.assessmentsCreated.inc({ status });
  }

  recordPayment(status: 'pending' | 'completed' | 'failed'): void {
    this.paymentsTotal.inc({ status });
  }

  recordPaymentAmount(amount: number): void {
    this.paymentsAmountTotal.inc(amount);
  }

  recordBillingPayment(status: BillingPaymentStatus, context: BillingPaymentMetricContext): void {
    this.billingPaymentEventsTotal.inc({
      actor: context.actor,
      scenario: context.scenario,
      status,
    });
  }

  recordBillingPaymentAmount(amount: number, context: BillingPaymentMetricContext): void {
    this.billingPaymentAmountTotal.inc(
      {
        actor: context.actor,
        scenario: context.scenario,
      },
      amount,
    );
  }

  recordPromoValidation(flow: PromoValidationFlow, status: PromoValidationMetricStatus): void {
    this.promoValidationTotal.inc({ flow, status });
  }

  recordPromoApplied(
    context: Pick<BillingPaymentMetricContext, 'scenario'>,
    discountType: PromoDiscountType,
    discountAmount: number,
  ): void {
    const labels = {
      scenario: context.scenario,
      discount_type: discountType,
    };

    this.promoAppliedTotal.inc(labels);

    if (discountAmount > 0) {
      this.promoDiscountAmountTotal.inc(labels, discountAmount);
    }
  }

  recordPaymentHistoryRequest(scope: PaymentHistoryScope, result: MetricsResult): void {
    this.paymentHistoryRequestsTotal.inc({ scope, result });
  }

  recordUserRegistered(): void {
    this.usersRegistered.inc();
  }

  recordAuditEvent(severity = 'info'): void {
    this.auditEventsTotal.inc({ severity });
  }

  recordReportGenerated(): void {
    this.reportsGenerated.inc();
  }
}
