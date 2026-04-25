import { DocumentType as PrismaDocumentType } from '@internal/prisma-client';
import { DocumentType as RpcDocumentType } from '@notary-portal/api-contracts';

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
