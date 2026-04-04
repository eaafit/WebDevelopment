import 'dotenv/config';
import * as crypto from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import {
  AssessmentStatus,
  DocumentType,
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  PaymentType,
  PrismaClient,
  ReportStatus,
  Role,
  SaleType,
  SubscriptionPlan,
} from './generated/prisma/client';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const SEED_COUNT = Number(process.env['SEED_SIZE'] ?? 100);
const SEED_USERS_PER_ROLE = 10;
const TOTAL_SEED_USERS = SEED_USERS_PER_ROLE * 3; // 10 Applicant, 10 Notary, 10 Admin
const PAYMENT_HISTORY_PER_USER = 10;
const SEED_USER_PASSWORD = process.env['SEED_USER_PASSWORD'] ?? 'SeedPass123!';
const BCRYPT_SALT_ROUNDS = 12;

function seedId(entity: string, i: number): string {
  const h = crypto.createHash('sha256').update(`seed-${entity}-${i}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(12, 15)}-a${h.slice(15, 18)}-${h.slice(18, 30)}`;
}

function pad(i: number, len: number): string {
  return String(i).padStart(len, '0');
}

async function main(): Promise<void> {
  const seedPasswordHash = await bcrypt.hash(SEED_USER_PASSWORD, BCRYPT_SALT_ROUNDS);
  const userIds = await upsertUsers(TOTAL_SEED_USERS, seedPasswordHash);
  const promoIds = await upsertPromos(SEED_COUNT);
  await upsertSales(SEED_COUNT, promoIds);
  const assessmentIds = await upsertAssessments(SEED_COUNT, userIds);
  await upsertDocuments(SEED_COUNT, assessmentIds, userIds);
  const subscriptionIds = await upsertSubscriptions(SEED_COUNT, userIds);
  await upsertPayments(SEED_COUNT, userIds, subscriptionIds, assessmentIds, promoIds);
  await upsertReports(SEED_COUNT, assessmentIds, userIds);
  await upsertNotifications(SEED_COUNT, userIds);
  await upsertRefreshTokens(SEED_COUNT, userIds);
  await upsertAuditLogs(SEED_COUNT, userIds, assessmentIds, promoIds);
  await upsertAssessmentProcessingHistory(assessmentIds, userIds);

  const [
    userCount,
    assessmentCount,
    documentCount,
    subscriptionCount,
    paymentCount,
    reportCount,
    notificationCount,
    refreshTokenCount,
    auditLogCount,
    promoCount,
    saleCount,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.assessment.count(),
    prisma.document.count(),
    prisma.subscription.count(),
    prisma.payment.count(),
    prisma.assessmentReport.count(),
    prisma.notification.count(),
    prisma.refreshToken.count(),
    prisma.auditLog.count(),
    prisma.promo.count(),
    prisma.sale.count(),
  ]);

  console.info(
    [
      'Seed finished successfully.',
      `Users: ${userCount}`,
      `Assessments: ${assessmentCount}`,
      `Documents: ${documentCount}`,
      `Subscriptions: ${subscriptionCount}`,
      `Payments: ${paymentCount}`,
      `Reports: ${reportCount}`,
      `Notifications: ${notificationCount}`,
      `RefreshTokens: ${refreshTokenCount}`,
      `AuditLogs: ${auditLogCount}`,
      `Promos: ${promoCount}`,
      `Sales: ${saleCount}`,
      `Seed auth password: ${SEED_USER_PASSWORD}`,
      ...buildSeedCredentialHints(TOTAL_SEED_USERS),
    ].join(' '),
  );
}

async function upsertUsers(count: number, passwordHash: string): Promise<string[]> {
  const userIds: string[] = [];
  const roles: Role[] = [Role.Applicant, Role.Notary, Role.Admin];
  const roleCounts = [SEED_USERS_PER_ROLE, SEED_USERS_PER_ROLE, SEED_USERS_PER_ROLE];
  let roleIndex = 0;
  let roleOffset = 0;
  for (let i = 0; i < count; i++) {
    if (i >= roleOffset + roleCounts[roleIndex]) {
      roleOffset += roleCounts[roleIndex];
      roleIndex += 1;
    }
    const role = roles[roleIndex];
    const id = seedId('user', i);
    userIds.push(id);
    const email = `seed-user-${pad(i, 3)}@seed.local`;
    const base =
      role === Role.Applicant ? 'Заявитель' : role === Role.Notary ? 'Нотариус' : 'Администратор';
    await prisma.user.upsert({
      where: { id },
      update: {
        email,
        passwordHash,
        fullName: `${base} ${i + 1}`,
        role,
        phoneNumber: `+7999${pad(i, 7)}`,
        isActive: true,
      },
      create: {
        id,
        email,
        passwordHash,
        fullName: `${base} ${i + 1}`,
        role,
        phoneNumber: `+7999${pad(i, 7)}`,
        isActive: true,
      },
    });
  }
  return userIds;
}

function buildSeedCredentialHints(count: number): string[] {
  const hints: string[] = [];

  if (count > 0) {
    hints.push(`Applicant login: ${seedUserEmail(0)}`);
  }
  if (count > SEED_USERS_PER_ROLE) {
    hints.push(`Notary login: ${seedUserEmail(SEED_USERS_PER_ROLE)}`);
  }
  if (count > SEED_USERS_PER_ROLE * 2) {
    hints.push(`Admin login: ${seedUserEmail(SEED_USERS_PER_ROLE * 2)}`);
  }

  return hints;
}

function seedUserEmail(index: number): string {
  return `seed-user-${pad(index, 3)}@seed.local`;
}

async function upsertPromos(count: number): Promise<string[]> {
  const promoIds: string[] = [];
  const baseDate = new Date('2026-03-01T00:00:00.000Z');
  for (let i = 0; i < count; i++) {
    const id = seedId('promo', i);
    promoIds.push(id);
    const code = `SEED-PROMO-${pad(i, 3)}`;
    const expiresAt = new Date(baseDate);
    expiresAt.setMonth(expiresAt.getMonth() + 6);
    await prisma.promo.upsert({
      where: { id },
      update: {
        code,
        description: `Скидка для seed промо ${i + 1}.`,
        discountPercent: String(10 + (i % 20) + '.00'),
        usageLimit: 100,
        usedCount: i % 10,
        expiresAt,
      },
      create: {
        id,
        code,
        description: `Скидка для seed промо ${i + 1}.`,
        discountPercent: String(10 + (i % 20) + '.00'),
        usageLimit: 100,
        usedCount: i % 10,
        expiresAt,
      },
    });
  }
  return promoIds;
}

async function upsertSales(count: number, promoIds: string[]): Promise<void> {
  const saleTypes = [SaleType.Permanent, SaleType.Subscription, SaleType.Product, SaleType.Promo];
  const baseStart = new Date('2026-01-01T00:00:00.000Z');
  const baseEnd = new Date('2026-12-31T00:00:00.000Z');
  for (let i = 0; i < count; i++) {
    const id = seedId('sale', i);
    const type = saleTypes[i % 4];
    const startDate = new Date(baseStart);
    startDate.setDate(startDate.getDate() + (i % 90));
    const endDate = new Date(baseEnd);
    endDate.setDate(endDate.getDate() - (i % 30));
    await prisma.sale.upsert({
      where: { id },
      update: {
        type,
        startDate,
        endDate,
        percent: String(5 + (i % 25) + '.00'),
        isActive: i % 5 !== 0,
        promoId: type === SaleType.Promo && i < promoIds.length ? promoIds[i] : null,
        subscriptionId: null,
      },
      create: {
        id,
        type,
        startDate,
        endDate,
        percent: String(5 + (i % 25) + '.00'),
        isActive: i % 5 !== 0,
        promoId: type === SaleType.Promo && i < promoIds.length ? promoIds[i] : null,
        subscriptionId: null,
      },
    });
  }
}

async function upsertAssessments(count: number, userIds: string[]): Promise<string[]> {
  const assessmentIds: string[] = [];
  const statuses = [
    AssessmentStatus.New,
    AssessmentStatus.InProgress,
    AssessmentStatus.Completed,
    AssessmentStatus.Verified,
    AssessmentStatus.Cancelled,
  ];
  const applicantCount = Math.min(SEED_USERS_PER_ROLE, userIds.length);
  const notaryStart = SEED_USERS_PER_ROLE;
  const notaryCount = Math.min(
    SEED_USERS_PER_ROLE,
    Math.max(0, userIds.length - SEED_USERS_PER_ROLE),
  );
  const addresses = [
    'г. Екатеринбург, ул. Малышева, 18',
    'Свердловская обл., п. Балтым, ул. Сосновая, 7',
    'г. Екатеринбург, ул. Бориса Ельцина, 3',
  ];
  for (let i = 0; i < count; i++) {
    const id = seedId('assessment', i);
    assessmentIds.push(id);
    const userId = userIds[i % applicantCount];
    const notaryId =
      notaryCount > 0 && i % 3 === 0 ? userIds[notaryStart + (i % notaryCount)] : null;
    const status = statuses[i % 5];
    const estimatedValue = String(5000000 + (i % 15) * 500000) + '.00';
    const address = `${addresses[i % 3]}, ${i % 100}`;
    await prisma.assessment.upsert({
      where: { id },
      update: {
        userId,
        notaryId,
        status,
        cancelReason:
          status === AssessmentStatus.Cancelled ? `Причина отмены заявки seed ${i + 1}.` : null,
        address,
        description: `Оценка объекта seed ${i + 1}.`,
        estimatedValue,
      },
      create: {
        id,
        userId,
        notaryId,
        status,
        cancelReason:
          status === AssessmentStatus.Cancelled ? `Причина отмены заявки seed ${i + 1}.` : null,
        address,
        description: `Оценка объекта seed ${i + 1}.`,
        estimatedValue,
      },
    });
  }
  return assessmentIds;
}

async function upsertDocuments(
  count: number,
  assessmentIds: string[],
  userIds: string[],
): Promise<void> {
  const docTypes = [
    DocumentType.Passport,
    DocumentType.PropertyDeed,
    DocumentType.TechnicalPlan,
    DocumentType.CadastralPassport,
    DocumentType.Photo,
    DocumentType.Other,
  ];
  const fileNames = [
    'passport.pdf',
    'extract-egrn.pdf',
    'ownership.pdf',
    'technical-plan.pdf',
    'photo.jpg',
    'other.pdf',
  ];
  for (let i = 0; i < count; i++) {
    const id = seedId('document', i);
    const assessmentId = assessmentIds[i % assessmentIds.length];
    const uploadedById = userIds[i % userIds.length];
    const docType = docTypes[i % 6];
    const fileName = `seed-doc-${pad(i, 3)}-${fileNames[i % 6]}`;
    await prisma.document.upsert({
      where: { id },
      update: {
        assessmentId,
        fileName,
        fileType: 'application/pdf',
        documentType: docType,
        filePath: `/uploads/seed/${fileName}`,
        version: (i % 3) + 1,
        uploadedById,
      },
      create: {
        id,
        assessmentId,
        fileName,
        fileType: 'application/pdf',
        documentType: docType,
        filePath: `/uploads/seed/${fileName}`,
        version: (i % 3) + 1,
        uploadedById,
      },
    });
  }
}

async function upsertSubscriptions(count: number, userIds: string[]): Promise<string[]> {
  const subscriptionIds: string[] = [];
  const plans = [SubscriptionPlan.Basic, SubscriptionPlan.Premium, SubscriptionPlan.Enterprise];
  const basePrices = ['1990.00', '4990.00', '14990.00'];
  const baseStart = new Date('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < count; i++) {
    const id = seedId('subscription', i);
    subscriptionIds.push(id);
    const plan = plans[i % 3];
    const basePrice = basePrices[i % 3];
    const startDate = new Date(baseStart);
    startDate.setDate(startDate.getDate() + (i % 60));
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    await prisma.subscription.upsert({
      where: { id },
      update: {
        userId: userIds[i % userIds.length],
        plan,
        basePrice,
        currency: 'RUB',
        startDate,
        endDate,
        isActive: i % 10 !== 0,
      },
      create: {
        id,
        userId: userIds[i % userIds.length],
        plan,
        basePrice,
        currency: 'RUB',
        startDate,
        endDate,
        isActive: i % 10 !== 0,
      },
    });
  }
  return subscriptionIds;
}

async function upsertPayments(
  count: number,
  userIds: string[],
  subscriptionIds: string[],
  assessmentIds: string[],
  promoIds: string[],
): Promise<void> {
  const types = [PaymentType.Subscription, PaymentType.Assessment, PaymentType.DocumentCopy];
  const statuses = [
    PaymentStatus.Pending,
    PaymentStatus.Completed,
    PaymentStatus.Failed,
    PaymentStatus.Refunded,
  ];
  const methods = ['bank_card', 'sbp', 'invoice'];
  const totalHistoryPayments = TOTAL_SEED_USERS * PAYMENT_HISTORY_PER_USER;
  const totalPayments = Math.max(count, totalHistoryPayments);
  const baseDate = new Date('2026-01-01T10:00:00.000Z');

  for (let i = 0; i < totalPayments; i++) {
    const id = seedId('payment', i);
    const isHistoryPayment = i < totalHistoryPayments;
    let userId: string;
    let paymentDate: Date;
    let type: PaymentType;
    let subscriptionId: string | null;
    let assessmentId: string | null;
    let amount: string;
    let discountAmount: string | null;
    let promoId: string | null;
    let status: PaymentStatus;

    if (isHistoryPayment) {
      const userIndex = Math.floor(i / PAYMENT_HISTORY_PER_USER);
      const j = i % PAYMENT_HISTORY_PER_USER;
      userId = userIds[userIndex];
      paymentDate = new Date(baseDate);
      paymentDate.setDate(paymentDate.getDate() - (totalHistoryPayments - i) * 2);
      type = types[j % 3];
      subscriptionId =
        type === PaymentType.Subscription
          ? subscriptionIds[userIndex % subscriptionIds.length]
          : null;
      assessmentId =
        type !== PaymentType.Subscription
          ? assessmentIds[(userIndex * PAYMENT_HISTORY_PER_USER + j) % assessmentIds.length]
          : null;
      amount = String(1000 + (j % 50) * 200) + '.00';
      discountAmount = j % 10 === 0 ? String(Math.floor(Number(amount) * 0.1)) + '.00' : null;
      promoId = j % 10 === 0 && promoIds.length > 0 ? promoIds[userIndex % promoIds.length] : null;
      status = statuses[j % 4];
    } else {
      const idx = i - totalHistoryPayments;
      userId = userIds[idx % userIds.length];
      type = types[idx % 3];
      subscriptionId =
        type === PaymentType.Subscription ? subscriptionIds[idx % subscriptionIds.length] : null;
      assessmentId =
        type !== PaymentType.Subscription ? assessmentIds[idx % assessmentIds.length] : null;
      amount = String(1000 + (idx % 50) * 200) + '.00';
      discountAmount = idx % 10 === 0 ? String(Math.floor(Number(amount) * 0.1)) + '.00' : null;
      promoId = idx % 10 === 0 && idx < promoIds.length ? promoIds[idx % promoIds.length] : null;
      paymentDate = new Date(baseDate);
      paymentDate.setDate(paymentDate.getDate() + (idx % 30));
      status = statuses[idx % 4];
    }

    await prisma.payment.upsert({
      where: { id },
      update: {
        userId,
        type,
        subscriptionId,
        assessmentId,
        promoId,
        amount,
        discountAmount,
        paymentDate,
        status,
        paymentMethod: methods[i % 3],
        transactionId: `TXN-SEED-${pad(i, 5)}`,
        attachmentFileName: `receipt-${i}.pdf`,
        attachmentFileUrl: `https://example.local/files/receipt-${i}.pdf`,
      },
      create: {
        id,
        userId,
        type,
        subscriptionId,
        assessmentId,
        promoId,
        amount,
        discountAmount,
        paymentDate,
        status,
        paymentMethod: methods[i % 3],
        transactionId: `TXN-SEED-${pad(i, 5)}`,
        attachmentFileName: `receipt-${i}.pdf`,
        attachmentFileUrl: `https://example.local/files/receipt-${i}.pdf`,
      },
    });
  }
}

async function upsertReports(
  count: number,
  assessmentIds: string[],
  userIds: string[],
): Promise<void> {
  const notaryAdminStart = Math.min(SEED_USERS_PER_ROLE, userIds.length);
  const signedByIdCandidates = userIds.slice(notaryAdminStart);
  const signerCount = signedByIdCandidates.length || 1;
  for (let i = 0; i < count; i++) {
    const id = seedId('report', i);
    const assessmentId = assessmentIds[i % assessmentIds.length];
    const signedById =
      signedByIdCandidates.length > 0 ? signedByIdCandidates[i % signerCount] : userIds[0];
    const status = i % 2 === 0 ? ReportStatus.Draft : ReportStatus.Signed;
    await prisma.assessmentReport.upsert({
      where: { id },
      update: {
        assessmentId,
        reportPath: `/reports/seed/report-${pad(i, 3)}.pdf`,
        signedById,
        signatureData: status === ReportStatus.Signed ? Buffer.from(`signed-report-${i}`) : null,
        version: (i % 3) + 1,
        status,
      },
      create: {
        id,
        assessmentId,
        reportPath: `/reports/seed/report-${pad(i, 3)}.pdf`,
        signedById,
        signatureData: status === ReportStatus.Signed ? Buffer.from(`signed-report-${i}`) : null,
        version: (i % 3) + 1,
        status,
      },
    });
  }
}

async function upsertNotifications(count: number, userIds: string[]): Promise<void> {
  const types = [NotificationType.Email, NotificationType.SMS, NotificationType.Push];
  const statuses = [NotificationStatus.Pending, NotificationStatus.Sent, NotificationStatus.Failed];
  const baseSent = new Date('2026-02-01T12:00:00.000Z');
  for (let i = 0; i < count; i++) {
    const id = seedId('notification', i);
    const userId = userIds[i % userIds.length];
    const type = types[i % 3];
    const message = `Seed уведомление ${i + 1}: тестовое сообщение.`;
    const status = statuses[i % 3];
    const sentAt = new Date(baseSent);
    sentAt.setHours(sentAt.getHours() + (i % 48));
    const readAt = i % 5 === 0 ? new Date(sentAt.getTime() + 3600000) : null;
    await prisma.notification.upsert({
      where: { id },
      update: { userId, type, message, sentAt, readAt, status },
      create: { id, userId, type, message, sentAt, readAt, status },
    });
  }
}

async function upsertRefreshTokens(count: number, userIds: string[]): Promise<void> {
  const baseExpires = new Date();
  baseExpires.setDate(baseExpires.getDate() + 30);
  const baseRevoked = new Date();
  baseRevoked.setDate(baseRevoked.getDate() - 1);
  for (let i = 0; i < count; i++) {
    const id = seedId('refreshToken', i);
    const userId = userIds[i % userIds.length];
    const tokenHash = `seed-token-hash-${pad(i, 5)}`;
    const expiresAt = new Date(baseExpires);
    expiresAt.setDate(expiresAt.getDate() + (i % 14));
    const revokedAt = i % 7 === 0 ? new Date(baseRevoked) : null;
    await prisma.refreshToken.upsert({
      where: { id },
      update: { userId, tokenHash, expiresAt, revokedAt },
      create: { id, userId, tokenHash, expiresAt, revokedAt },
    });
  }
}

async function upsertAuditLogs(
  count: number,
  userIds: string[],
  assessmentIds: string[],
  promoIds: string[],
): Promise<void> {
  const actions: Array<{ actionType: string; entityName: string }> = [
    { actionType: 'assessment.created', entityName: 'Assessment' },
    { actionType: 'payment.completed', entityName: 'Payment' },
    { actionType: 'report.signed', entityName: 'AssessmentReport' },
    { actionType: 'user.login', entityName: 'User' },
    { actionType: 'subscription.created', entityName: 'Subscription' },
  ];
  for (let i = 0; i < count; i++) {
    const id = seedId('auditLog', i);
    const userId = userIds[i % userIds.length];
    const action = actions[i % actions.length];
    const entityId =
      action.entityName === 'Assessment'
        ? assessmentIds[i % assessmentIds.length]
        : action.entityName === 'Promo' && promoIds.length > 0
          ? promoIds[i % promoIds.length]
          : assessmentIds[i % assessmentIds.length];
    const details = { source: 'seed', index: i };
    await prisma.auditLog.upsert({
      where: { id },
      update: {
        userId,
        actionType: action.actionType,
        entityName: action.entityName,
        entityId,
        details,
      },
      create: {
        id,
        userId,
        actionType: action.actionType,
        entityName: action.entityName,
        entityId,
        details,
      },
    });
  }
}

const ASSESSMENT_PROCESSING_EVENTS = [
  'assessment.created',
  'assessment.assigned_to_notary',
  'assessment.status_in_progress',
  'assessment.completed',
] as const;
const ASSESSMENT_PROCESSING_EVENT_CANCELLED = 'assessment.cancelled';

async function upsertAssessmentProcessingHistory(
  assessmentIds: string[],
  userIds: string[],
): Promise<void> {
  const applicantCount = Math.min(SEED_USERS_PER_ROLE, userIds.length);
  const notaryStart = SEED_USERS_PER_ROLE;
  const notaryCount = Math.min(
    SEED_USERS_PER_ROLE,
    Math.max(0, userIds.length - SEED_USERS_PER_ROLE),
  );
  const baseTimestamp = new Date('2026-02-01T08:00:00.000Z');
  const countToProcess = Math.min(assessmentIds.length, 100);

  for (let a = 0; a < countToProcess; a++) {
    const assessmentId = assessmentIds[a];
    const isCancelled = a % 5 === 4;
    const events = isCancelled
      ? [...ASSESSMENT_PROCESSING_EVENTS.slice(0, -1), ASSESSMENT_PROCESSING_EVENT_CANCELLED]
      : [...ASSESSMENT_PROCESSING_EVENTS];
    const applicantId = userIds[a % applicantCount];
    const notaryId = notaryCount > 0 ? userIds[notaryStart + (a % notaryCount)] : userIds[0];

    for (let step = 0; step < events.length; step++) {
      const globalIndex = SEED_COUNT + a * 10 + step;
      const id = seedId('auditLog', globalIndex);
      const eventUserId = step === 0 ? applicantId : notaryId;
      const timestamp = new Date(baseTimestamp);
      timestamp.setDate(timestamp.getDate() + a);
      timestamp.setHours(timestamp.getHours() + step * 4);

      await prisma.auditLog.upsert({
        where: { id },
        update: {
          userId: eventUserId,
          actionType: events[step],
          entityName: 'Assessment',
          entityId: assessmentId,
          timestamp,
          details: { source: 'seed', assessmentIndex: a, step, cancelled: isCancelled },
        },
        create: {
          id,
          userId: eventUserId,
          actionType: events[step],
          entityName: 'Assessment',
          entityId: assessmentId,
          timestamp,
          details: { source: 'seed', assessmentIndex: a, step, cancelled: isCancelled },
        },
      });
    }
  }
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
