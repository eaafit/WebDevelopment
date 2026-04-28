import 'dotenv/config';
import * as crypto from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  AssessmentStatus,
  DocumentType,
  NotificationStatus,
  NotificationType,
  PaymentReceiptStatus,
  PaymentStatus,
  PaymentType,
  PrismaClient,
  ReportStatus,
  Role,
  SaleType,
  SubscriptionPlan,
} from './generated/prisma/client';
import { RUSSIA_TOP_50_GEOGRAPHY } from './data/russia-top50-geography';

const connectionString = process.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const s3 = new S3Client({
  region: process.env['S3_REGION'] ?? 'us-east-1',
  endpoint: process.env['S3_ENDPOINT'],
  credentials: {
    accessKeyId: process.env['S3_ACCESS_KEY'] ?? 'minioadmin',
    secretAccessKey: process.env['S3_SECRET_KEY'] ?? 'minioadmin',
  },
  forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] !== 'false',
});
const S3_BUCKET = process.env['S3_BUCKET_PAYMENT_DOCUMENTS'] ?? 'payment-documents';

function makeMinimalPdf(): Buffer {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(value: string): string {
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function makeReceiptHtml(params: {
  paymentId: string;
  amount: string;
  paymentDate: string | Date;
  paymentMethod: string;
  transactionId: string;
  type: string;
}): Buffer {
  const dateStr =
    params.paymentDate instanceof Date
      ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(
          params.paymentDate,
        )
      : params.paymentDate;

  const typeLabel =
    params.type === 'Subscription'
      ? 'Оплата подписки'
      : params.type === 'DocumentCopy'
        ? 'Оплата копии документа'
        : 'Оценка недвижимости';

  const html = `<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"/><title>Чек оплаты</title>
<style>
  :root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5}
  body{margin:0;padding:32px;background:#f3f5f7;color:#102030}
  .receipt{max-width:760px;margin:0 auto;background:#fff;border-radius:20px;padding:32px;box-shadow:0 16px 48px rgba(16,32,48,.12)}
  .title{margin:0 0 8px;font-size:28px;line-height:1.1}
  .subtitle{margin:0;color:#556677}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:24px 0}
  .card{padding:16px;border-radius:16px;background:#f8fafc;border:1px solid #e4ebf2}
  .label{display:block;margin-bottom:6px;color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
  .value{font-size:16px;font-weight:600;word-break:break-word}
  table{width:100%;border-collapse:collapse;border-radius:16px;border:1px solid #e4ebf2}
  th,td{padding:14px 16px;text-align:left;border-bottom:1px solid #e4ebf2}
  th{background:#f8fafc;color:#64748b;font-size:12px;text-transform:uppercase}
  tr:last-child td{border-bottom:none}
  .summary{margin-top:20px;display:flex;justify-content:flex-end}
  .summary-card{min-width:240px;padding:16px 20px;border-radius:16px;background:#102030;color:#fff}
  .summary-card strong{display:block;margin-top:6px;font-size:24px}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #e4ebf2}
  .note{margin:0;color:#556677}
  @media print{body{padding:0;background:#fff}.receipt{max-width:none;border-radius:0;box-shadow:none}}
</style></head>
<body><main class="receipt">
  <h1 class="title">Чек оплаты</h1>
  <p class="subtitle">Документ по подтвержденной оплате в системе.</p>
  <section class="grid">
    <article class="card"><span class="label">ID платежа</span><span class="value">${escapeHtml(params.paymentId)}</span></article>
    <article class="card"><span class="label">ID транзакции</span><span class="value">${escapeHtml(params.transactionId)}</span></article>
    <article class="card"><span class="label">Дата оплаты</span><span class="value">${escapeHtml(dateStr)}</span></article>
    <article class="card"><span class="label">Способ оплаты</span><span class="value">${escapeHtml(params.paymentMethod)}</span></article>
  </section>
  <table><thead><tr><th>Описание</th><th>Кол-во</th><th>Сумма</th></tr></thead>
  <tbody><tr><td>${escapeHtml(typeLabel)}</td><td>1</td><td>${escapeHtml(formatMoney(params.amount))}</td></tr></tbody></table>
  <section class="summary"><div class="summary-card">Итого<strong>${escapeHtml(formatMoney(params.amount))}</strong></div></section>
  <footer class="footer"><p class="note">Документ сформирован автоматически. Seed-данные для тестирования.</p></footer>
</main></body></html>`;

  return Buffer.from(html, 'utf8');
}

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

/** Стабильные UUID для городов/районов по строковому ключу (порядок в списке может меняться). */
function geographySeedId(kind: 'city' | 'district', key: string): string {
  const h = crypto.createHash('sha256').update(`seed-geo-${kind}-${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(12, 15)}-a${h.slice(15, 18)}-${h.slice(18, 30)}`;
}

function pad(i: number, len: number): string {
  return String(i).padStart(len, '0');
}

async function main(): Promise<void> {
  const seedPasswordHash = await bcrypt.hash(SEED_USER_PASSWORD, BCRYPT_SALT_ROUNDS);
  const userIds = await upsertUsers(TOTAL_SEED_USERS, seedPasswordHash);
  await upsertGeographyCatalog();
  const promoIds = await upsertPromos(SEED_COUNT);
  await upsertSales(SEED_COUNT, promoIds);
  const assessmentIds = await upsertAssessments(SEED_COUNT, userIds);
  await upsertDocuments(SEED_COUNT, assessmentIds, userIds);
  const subscriptionIds = await upsertSubscriptions(SEED_COUNT, userIds);
  const paymentRefs = await upsertPayments(
    SEED_COUNT,
    userIds,
    subscriptionIds,
    assessmentIds,
    promoIds,
  );
  await upsertReports(SEED_COUNT, assessmentIds, userIds);
  await upsertNotifications(SEED_COUNT, userIds);
  await upsertRefreshTokens(SEED_COUNT, userIds);
  await upsertAuditLogs(SEED_COUNT, userIds, assessmentIds, paymentRefs, promoIds);
  await upsertSecurityEvents(userIds);
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
    cityCount,
    districtCount,
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
    prisma.city.count(),
    prisma.district.count(),
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
      `Cities: ${cityCount}`,
      `Districts: ${districtCount}`,
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

async function upsertGeographyCatalog(): Promise<void> {
  for (const entry of RUSSIA_TOP_50_GEOGRAPHY) {
    const cityId = geographySeedId('city', entry.name);
    await prisma.city.upsert({
      where: { name: entry.name },
      create: { id: cityId, name: entry.name },
      update: {},
    });
    const city = await prisma.city.findUniqueOrThrow({ where: { name: entry.name } });
    for (const districtName of entry.districts) {
      const districtId = geographySeedId('district', `${entry.name}|${districtName}`);
      await prisma.district.upsert({
        where: {
          cityId_name: {
            cityId: city.id,
            name: districtName,
          },
        },
        create: {
          id: districtId,
          cityId: city.id,
          name: districtName,
        },
        update: {},
      });
    }
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
  const bucketName = process.env['S3_BUCKET_ASSESSMENT_FILES']?.trim() || 'assessment-files';
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
    const objectPrefix = resolveSeedDocumentPrefix(docType);
    const extension = fileName.split('.').pop()?.toLowerCase() ?? 'bin';
    const objectKey = `${objectPrefix}/${assessmentId}/seed-${id}.${extension}`;
    await prisma.document.upsert({
      where: { id },
      update: {
        assessmentId,
        fileName,
        fileType: 'application/pdf',
        fileSize: 0,
        documentType: docType,
        bucketName,
        objectKey,
        version: (i % 3) + 1,
        uploadedById,
      },
      create: {
        id,
        assessmentId,
        fileName,
        fileType: 'application/pdf',
        fileSize: 0,
        documentType: docType,
        bucketName,
        objectKey,
        version: (i % 3) + 1,
        uploadedById,
      },
    });
  }
}

function resolveSeedDocumentPrefix(documentType: DocumentType): string {
  if (documentType === DocumentType.Photo) {
    return 'photos';
  }

  if (documentType === DocumentType.Additional) {
    return 'additional';
  }

  return 'documents';
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

interface PaymentSeedRef {
  id: string;
  assessmentId: string | null;
}

async function upsertPayments(
  count: number,
  userIds: string[],
  subscriptionIds: string[],
  assessmentIds: string[],
  promoIds: string[],
): Promise<PaymentSeedRef[]> {
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
  const paymentRefs: PaymentSeedRef[] = [];

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

    const receiptObjectKey = `payment-documents/${id}/${crypto.randomUUID()}.html`;
    const receiptFileName = `receipt-${i}.html`;
    const receiptStatus =
      status === PaymentStatus.Completed
        ? PaymentReceiptStatus.Available
        : status === PaymentStatus.Failed
          ? PaymentReceiptStatus.Failed
          : PaymentReceiptStatus.Pending;
    // Upload a receipt HTML with real payment data to MinIO for completed payments
    if (receiptStatus === PaymentReceiptStatus.Available) {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: receiptObjectKey,
            Body: makeReceiptHtml({
              paymentId: id,
              amount,
              paymentDate,
              paymentMethod: methods[i % 3],
              transactionId: `TXN-SEED-${pad(i, 5)}`,
              type:
                type === PaymentType.Subscription
                  ? 'Subscription'
                  : type === PaymentType.DocumentCopy
                    ? 'DocumentCopy'
                    : 'Assessment',
            }),
            ContentType: 'text/html; charset=utf-8',
          }),
        );
      } catch (err) {
        console.warn(`Seed: failed to upload receipt for payment ${id} to S3`, err);
      }
    }

    paymentRefs.push({ id, assessmentId });

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
        attachmentFileName:
          receiptStatus === PaymentReceiptStatus.Available ? receiptFileName : null,
        attachmentFileUrl:
          receiptStatus === PaymentReceiptStatus.Available ? receiptObjectKey : null,
        receiptStatus,
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
        attachmentFileName:
          receiptStatus === PaymentReceiptStatus.Available ? receiptFileName : null,
        attachmentFileUrl:
          receiptStatus === PaymentReceiptStatus.Available ? receiptObjectKey : null,
        receiptStatus,
      },
    });
  }

  return paymentRefs;
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
  paymentRefs: PaymentSeedRef[],
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
    const relatedAssessmentId = assessmentIds[i % assessmentIds.length];
    const paymentRef = paymentRefs.length > 0 ? paymentRefs[i % paymentRefs.length] : null;
    const entityName =
      action.entityName === 'Payment' && paymentRef?.assessmentId
        ? 'Assessment'
        : action.entityName === 'AssessmentReport'
          ? 'Assessment'
          : action.entityName;
    const entityId =
      entityName === 'Assessment'
        ? (paymentRef?.assessmentId ?? relatedAssessmentId)
        : entityName === 'Payment' && paymentRef
          ? paymentRef.id
          : entityName === 'Promo' && promoIds.length > 0
            ? promoIds[i % promoIds.length]
            : entityName === 'User'
              ? userId
              : relatedAssessmentId;
    const details = {
      source: 'seed',
      index: i,
      ...(action.entityName === 'Payment' && paymentRef
        ? { paymentId: paymentRef.id, assessmentId: paymentRef.assessmentId }
        : {}),
      ...(action.entityName === 'AssessmentReport'
        ? { relatedEntityName: 'AssessmentReport' }
        : {}),
    };
    await prisma.auditLog.upsert({
      where: { id },
      update: {
        userId,
        actionType: action.actionType,
        entityName,
        entityId,
        details,
      },
      create: {
        id,
        userId,
        actionType: action.actionType,
        entityName,
        entityId,
        details,
      },
    });
  }
}

async function upsertSecurityEvents(userIds: string[]): Promise<void> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const securityEvents = [
    {
      offset: 0,
      actionType: 'user.login_failed',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      userId: userIds[0],
      details: {
        actionTitle: 'Неудачная попытка входа',
        actionContext: 'Неверный пароль',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        after: {
          attempts: 3,
          lastAttempt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        },
      },
    },
    {
      offset: 1,
      actionType: 'user.login_failed',
      timestamp: new Date(oneDayAgo.getTime() - 5 * 60 * 60 * 1000),
      userId: userIds[1],
      details: {
        actionTitle: 'Неудачная попытка входа',
        actionContext: 'Неверный email',
        ip: '10.0.0.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
        after: {
          attempts: 1,
          lastAttempt: new Date(oneDayAgo.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        },
      },
    },
    {
      offset: 2,
      actionType: 'user.blocked',
      timestamp: new Date(twoDaysAgo.getTime()),
      userId: userIds[SEED_USERS_PER_ROLE * 2],
      details: {
        actionTitle: 'Пользователь заблокирован',
        actionContext: 'Превышено количество неудачных попыток входа',
        targetTitle: userIds[2],
        targetContext: 'Заявитель 3',
        ip: '172.16.0.10',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0',
        after: {
          blockedUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          reason: 'security',
        },
      },
    },
    {
      offset: 3,
      actionType: 'token.revoked',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000),
      userId: userIds[SEED_USERS_PER_ROLE],
      details: {
        actionTitle: 'Токен отозван',
        actionContext: 'Подозрительная активность',
        targetTitle: 'Refresh Token',
        targetContext: seedId('refreshToken', 5),
        ip: '203.0.113.45',
        userAgent: 'PostmanRuntime/7.36.0',
        after: {
          revokedAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
          reason: 'suspicious_activity',
        },
      },
    },
    {
      offset: 4,
      actionType: 'permission.denied',
      timestamp: new Date(now.getTime() - 10 * 60 * 1000),
      userId: userIds[0],
      details: {
        actionTitle: 'Отказ в доступе',
        actionContext: 'Попытка доступа к админ-панели',
        targetTitle: 'Admin Panel',
        targetContext: '/admin/users',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        after: { requiredRole: 'Admin', actualRole: 'Applicant' },
      },
    },
    {
      offset: 5,
      actionType: 'permission.denied',
      timestamp: new Date(oneDayAgo.getTime() - 3 * 60 * 60 * 1000),
      userId: userIds[1],
      details: {
        actionTitle: 'Отказ в доступе',
        actionContext: 'Попытка доступа к чужому заказу',
        targetTitle: 'Assessment',
        targetContext: seedId('assessment', 10),
        ip: '10.0.0.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
        after: { requiredPermission: 'assessment.read', resourceOwner: userIds[5] },
      },
    },
    {
      offset: 6,
      actionType: 'user.login_failed',
      timestamp: new Date(oneWeekAgo.getTime()),
      userId: userIds[3],
      details: {
        actionTitle: 'Неудачная попытка входа',
        actionContext: 'Истёк срок действия пароля',
        ip: '198.51.100.20',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
        after: { attempts: 1, passwordExpired: true },
      },
    },
    {
      offset: 7,
      actionType: 'token.revoked',
      timestamp: new Date(twoDaysAgo.getTime() - 12 * 60 * 60 * 1000),
      userId: userIds[SEED_USERS_PER_ROLE + 1],
      details: {
        actionTitle: 'Токен отозван',
        actionContext: 'Выход из системы',
        targetTitle: 'Refresh Token',
        targetContext: seedId('refreshToken', 15),
        ip: '172.16.0.25',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edge/120.0.0.0',
        after: {
          revokedAt: new Date(twoDaysAgo.getTime() - 12 * 60 * 60 * 1000).toISOString(),
          reason: 'user_logout',
        },
      },
    },
  ];

  for (const event of securityEvents) {
    const id = seedId('securityEvent', event.offset);
    await prisma.auditLog.upsert({
      where: { id },
      update: {
        userId: event.userId,
        assessmentId: null,
        actionType: event.actionType,
        entityName: 'Security',
        entityId: event.userId,
        timestamp: event.timestamp,
        details: event.details,
      },
      create: {
        id,
        userId: event.userId,
        assessmentId: null,
        actionType: event.actionType,
        entityName: 'Security',
        entityId: event.userId,
        timestamp: event.timestamp,
        details: event.details,
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
