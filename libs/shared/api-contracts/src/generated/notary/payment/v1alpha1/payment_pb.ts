export interface PaymentAmount {
  amount: string;
  currency: string;
}

export interface Payment {
  id: string;
  userId: string;
  type: PaymentType;
  status: PaymentStatus;
  paymentDate?: unknown;
  transactionId: string;
  amount?: PaymentAmount;
  description: string;
  paymentMethod: string;
  attachmentFileName: string;
  attachmentFileUrl: string;
  subscriptionId: string;
  assessmentId: string;
}

export interface PaymentsMeta {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface GetPaymentHistoryResponse {
  payments: Payment[];
  meta?: PaymentsMeta | null;
}

export enum PaymentStatus {
  PENDING = 0,
  COMPLETED = 1,
  FAILED = 2,
  REFUNDED = 3,
}

export enum PaymentType {
  SUBSCRIPTION = 0,
  ASSESSMENT = 1,
  DOCUMENT_COPY = 2,
}

export const PaymentService = {} as unknown as {
  typeName: string;
};
