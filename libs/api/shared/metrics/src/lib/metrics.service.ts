import { Injectable } from '@nestjs/common';
import {
  Counter,
  collectDefaultMetrics,
  register as defaultRegister,
  type Registry,
} from 'prom-client';

const PREFIX = 'notary_';

@Injectable()
export class MetricsService {
  private readonly register: Registry = defaultRegister;

  private readonly assessmentsCreated: Counter<string>;
  private readonly paymentsTotal: Counter<string>;
  private readonly paymentsAmountTotal: Counter<string>;
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
