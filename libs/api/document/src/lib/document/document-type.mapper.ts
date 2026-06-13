import {
  DocumentStatus as PrismaDocumentStatus,
  DocumentType as PrismaDocumentType,
} from '@internal/prisma-client';
import {
  DocumentStatus as RpcDocumentStatus,
  DocumentType as RpcDocumentType,
} from '@notary-portal/api-contracts';

export function toPrismaDocumentType(
  value: RpcDocumentType,
  fallback: PrismaDocumentType,
): PrismaDocumentType {
  switch (value) {
    case RpcDocumentType.PASSPORT:
      return PrismaDocumentType.Passport;
    case RpcDocumentType.PROPERTY_DEED:
      return PrismaDocumentType.PropertyDeed;
    case RpcDocumentType.TECHNICAL_PLAN:
      return PrismaDocumentType.TechnicalPlan;
    case RpcDocumentType.CADASTRAL_PASSPORT:
      return PrismaDocumentType.CadastralPassport;
    case RpcDocumentType.PHOTO:
      return PrismaDocumentType.Photo;
    case RpcDocumentType.OTHER:
      return PrismaDocumentType.Other;
    case RpcDocumentType.ADDITIONAL:
      return PrismaDocumentType.Additional;
    case RpcDocumentType.UNSPECIFIED:
    default:
      return fallback;
  }
}

export function fromPrismaDocumentType(value: PrismaDocumentType): RpcDocumentType {
  switch (value) {
    case PrismaDocumentType.Passport:
      return RpcDocumentType.PASSPORT;
    case PrismaDocumentType.PropertyDeed:
      return RpcDocumentType.PROPERTY_DEED;
    case PrismaDocumentType.TechnicalPlan:
      return RpcDocumentType.TECHNICAL_PLAN;
    case PrismaDocumentType.CadastralPassport:
      return RpcDocumentType.CADASTRAL_PASSPORT;
    case PrismaDocumentType.Photo:
      return RpcDocumentType.PHOTO;
    case PrismaDocumentType.Additional:
      return RpcDocumentType.ADDITIONAL;
    case PrismaDocumentType.Other:
    default:
      return RpcDocumentType.OTHER;
  }
}

export function toPrismaDocumentStatus(
  value: RpcDocumentStatus,
  fallback: PrismaDocumentStatus,
): PrismaDocumentStatus {
  switch (value) {
    case RpcDocumentStatus.PENDING_PAYMENT:
      return PrismaDocumentStatus.PendingPayment;
    case RpcDocumentStatus.PAID:
      return PrismaDocumentStatus.Paid;
    case RpcDocumentStatus.IN_PROGRESS:
      return PrismaDocumentStatus.InProgress;
    case RpcDocumentStatus.READY:
      return PrismaDocumentStatus.Ready;
    case RpcDocumentStatus.DELIVERED:
      return PrismaDocumentStatus.Delivered;
    case RpcDocumentStatus.CANCELLED:
      return PrismaDocumentStatus.Cancelled;
    case RpcDocumentStatus.UNSPECIFIED:
    default:
      return fallback;
  }
}

export function fromPrismaDocumentStatus(value: PrismaDocumentStatus): RpcDocumentStatus {
  switch (value) {
    case PrismaDocumentStatus.PendingPayment:
      return RpcDocumentStatus.PENDING_PAYMENT;
    case PrismaDocumentStatus.Paid:
      return RpcDocumentStatus.PAID;
    case PrismaDocumentStatus.InProgress:
      return RpcDocumentStatus.IN_PROGRESS;
    case PrismaDocumentStatus.Ready:
      return RpcDocumentStatus.READY;
    case PrismaDocumentStatus.Delivered:
      return RpcDocumentStatus.DELIVERED;
    case PrismaDocumentStatus.Cancelled:
      return RpcDocumentStatus.CANCELLED;
    default:
      return RpcDocumentStatus.UNSPECIFIED;
  }
}
