import { PaymentType as PrismaPaymentType } from '@internal/prisma-client';
import type { BillingPaymentMetricContext } from '@internal/metrics';

export function resolveBillingPaymentMetricContext(
  type: PrismaPaymentType,
): BillingPaymentMetricContext {
  switch (type) {
    case PrismaPaymentType.Subscription:
      return {
        actor: 'notary',
        scenario: 'subscription',
      };

    case PrismaPaymentType.Assessment:
      return {
        actor: 'applicant',
        scenario: 'assessment_service',
      };

    case PrismaPaymentType.DocumentCopy:
      return {
        actor: 'applicant',
        scenario: 'document_copy_service',
      };
  }

  throw new Error(`Unsupported payment type for metrics: ${String(type)}`);
}
