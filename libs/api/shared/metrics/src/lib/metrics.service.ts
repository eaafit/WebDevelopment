import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
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
export type AuthMetricOutcome = 'success' | 'failed';
export type AuthPasswordResetStage = 'request' | 'submit';
export type AuthBrowserValidationForm =
  | 'login'
  | 'register'
  | 'password_reset_request'
  | 'password_reset_submit';
export type HttpRequestMetricPathGroup =
  | 'auth_login'
  | 'auth_register'
  | 'auth_password_reset_request'
  | 'auth_password_reset_submit'
  | 'health'
  | 'metrics'
  | 'other';
export type FailedAccessMetricReason =
  | 'auth_denied'
  | 'failed_login'
  | 'scan_miss'
  | 'rate_limited'
  | 'client_error';
export type FailedAccessMetricPathGroup =
  | 'auth_login'
  | 'payment_receipt'
  | 'document_content'
  | 'connect_rpc'
  | 'api'
  | 'other';

export type NewsletterCampaignMetricStatus = 'sending' | 'sent' | 'partial_failed' | 'failed';
export type NewsletterDeliveryOutcome = 'sent' | 'failed';
export type NewsletterAudienceMetricType = 'all' | 'role' | 'selected';

export interface BillingPaymentMetricContext {
  actor: BillingPaymentActor;
  scenario: BillingPaymentScenario;
}

export interface FailedAccessMetricLabels {
  method: string;
  statusCode: string;
  reason: FailedAccessMetricReason;
  pathGroup: FailedAccessMetricPathGroup;
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
  private readonly authLoginTotal: Counter<'outcome' | 'reason'>;
  private readonly authRegistrationTotal: Counter<'outcome' | 'role' | 'reason'>;
  private readonly authPasswordResetTotal: Counter<'stage' | 'outcome' | 'reason'>;
  private readonly authBrowserValidationFailedTotal: Counter<'form' | 'reason'>;
  private readonly httpRequestDurationSeconds: Histogram<
    'method' | 'path_group' | 'status_code'
  >;
  private readonly failedAccessTotal: Counter<
    'method' | 'status_code' | 'reason' | 'path_group'
  >;
  private readonly usersRegistered: Counter<string>;
  private readonly auditEventsTotal: Counter<string>;
  private readonly reportsGenerated: Counter<string>;
  private readonly newsletterCampaignsTotal: Counter<'status' | 'audience_type'>;
  private readonly newsletterDeliveriesTotal: Counter<'outcome'>;
  private readonly newsletterRecipientsTotal: Counter<'audience_type'>;

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

    this.authLoginTotal = new Counter({
      name: `${PREFIX}auth_login_total`,
      help: 'Total number of auth login attempts by outcome and reason',
      labelNames: ['outcome', 'reason'],
      registers: [this.register],
    });

    this.authRegistrationTotal = new Counter({
      name: `${PREFIX}auth_registration_total`,
      help: 'Total number of auth registration attempts by outcome, role, and reason',
      labelNames: ['outcome', 'role', 'reason'],
      registers: [this.register],
    });

    this.authPasswordResetTotal = new Counter({
      name: `${PREFIX}auth_password_reset_total`,
      help: 'Total number of password reset events by stage, outcome, and reason',
      labelNames: ['stage', 'outcome', 'reason'],
      registers: [this.register],
    });

    this.authBrowserValidationFailedTotal = new Counter({
      name: `${PREFIX}auth_browser_validation_failed_total`,
      help: 'Total number of client-side auth validation failures by form and reason',
      labelNames: ['form', 'reason'],
      registers: [this.register],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: `${PREFIX}http_request_duration_seconds`,
      help: 'HTTP request duration in seconds by method, low-cardinality path group, and status code',
      labelNames: ['method', 'path_group', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 1.5, 2.5, 5, 10],
      registers: [this.register],
    });

    this.failedAccessTotal = new Counter({
      name: `${PREFIX}failed_access_total`,
      help:
        'Total number of failed HTTP access attempts by method, status code, reason, and low-cardinality path group',
      labelNames: ['method', 'status_code', 'reason', 'path_group'],
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

    this.newsletterCampaignsTotal = new Counter({
      name: `${PREFIX}newsletter_campaigns_total`,
      help: 'Total number of newsletter campaigns by status and audience type',
      labelNames: ['status', 'audience_type'],
      registers: [this.register],
    });

    this.newsletterDeliveriesTotal = new Counter({
      name: `${PREFIX}newsletter_deliveries_total`,
      help: 'Total number of newsletter deliveries by outcome',
      labelNames: ['outcome'],
      registers: [this.register],
    });

    this.newsletterRecipientsTotal = new Counter({
      name: `${PREFIX}newsletter_recipients_total`,
      help: 'Total number of newsletter recipients targeted by audience type',
      labelNames: ['audience_type'],
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

  recordAuthLogin(outcome: AuthMetricOutcome, reason = 'none'): void {
    this.authLoginTotal.inc({ outcome, reason });
  }

  recordAuthRegistration(outcome: AuthMetricOutcome, role = 'unspecified', reason = 'none'): void {
    this.authRegistrationTotal.inc({ outcome, role, reason });
  }

  recordAuthPasswordReset(
    stage: AuthPasswordResetStage,
    outcome: AuthMetricOutcome,
    reason = 'none',
  ): void {
    this.authPasswordResetTotal.inc({ stage, outcome, reason });
  }

  recordAuthBrowserValidationFailed(
    form: AuthBrowserValidationForm,
    reason = 'unknown',
  ): void {
    this.authBrowserValidationFailedTotal.inc({ form, reason });
  }

  recordHttpRequestDuration(
    method: string,
    pathGroup: HttpRequestMetricPathGroup,
    statusCode: string,
    durationSeconds: number,
  ): void {
    this.httpRequestDurationSeconds.observe(
      {
        method,
        path_group: pathGroup,
        status_code: statusCode,
      },
      Math.max(0, durationSeconds),
    );
  }

  recordFailedAccessAttempt(labels: FailedAccessMetricLabels): void {
    this.failedAccessTotal.inc({
      method: labels.method,
      status_code: labels.statusCode,
      reason: labels.reason,
      path_group: labels.pathGroup,
    });
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

  recordNewsletterCampaignStarted(
    audienceType: NewsletterAudienceMetricType,
    recipientsCount: number,
  ): void {
    try {
      this.newsletterCampaignsTotal.inc({ status: 'sending', audience_type: audienceType });
      this.newsletterRecipientsTotal.inc({ audience_type: audienceType }, recipientsCount);
    } catch {
      // best-effort
    }
  }

  recordNewsletterDelivery(outcome: NewsletterDeliveryOutcome): void {
    try {
      this.newsletterDeliveriesTotal.inc({ outcome });
    } catch {
      // best-effort
    }
  }

  recordNewsletterCampaignCompleted(
    audienceType: NewsletterAudienceMetricType,
    status: NewsletterCampaignMetricStatus,
  ): void {
    try {
      this.newsletterCampaignsTotal.inc({ status, audience_type: audienceType });
    } catch {
      // best-effort
    }
  }
}
