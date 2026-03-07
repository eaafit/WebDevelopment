import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AssessmentStatus,
  NotificationStatus,
  NotificationType,
  PaymentStatus,
  PaymentType,
  PrismaClient,
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

const ids = {
  users: {
    applicant: '8b1f7f4f-c2b8-4554-b1ab-2eb9bbce515f',
    notary: '26cb4da7-9948-4fa4-9cb1-16c0d9198240',
    admin: '6747f7df-ce63-4e48-a754-1a361ed7c8d1',
  },
  assessments: {
    apartment: '9c6cd7df-fdc9-4e88-bf19-0b4875ca31bd',
    countryHouse: '05cd70fa-ea6f-42e7-90ff-74e9d7f55cd5',
    office: '14f8216f-06fc-4e75-9d4a-e4ee9fd8e356',
  },
  documents: {
    apartmentPassport: '6af4cbce-f8e2-4372-9c62-c2d2d1aa20f7',
    apartmentExtract: 'ef8dc34a-9f3e-4a2c-9c77-86f4af0bad66',
    countryHouseOwnership: 'f42355e5-da5c-4da6-8140-c2bb5837cdd6',
  },
  subscriptions: {
    premium: '5fe0937a-f766-43e0-b1d1-bc091145bb6f',
    enterprise: '6f3c1c79-3d0b-492b-b1e3-e8dd6bb2cf0c',
  },
  payments: {
    premiumCompleted: 'fbfa0aea-6d95-4b36-9bf5-527b33a40a17',
    enterprisePending: '374905c1-8604-4c88-b79a-58f13c51cfd0',
    apartmentAssessment: 'e88fd79d-e88f-4d87-adfd-33cf0381f859',
    countryHouseAssessmentRefund: '7c870ea9-f201-4120-a149-df93ce510a9c',
    officeDocumentCopy: '2d5f2122-7990-42ab-9780-dd1afaba3444',
  },
  reports: {
    apartment: '2c26dd5c-5245-4ff8-b6dc-96fe6070f214',
    countryHouse: 'bd464ddf-1cbb-4dae-90b7-ab05f8662fc0',
  },
  notifications: {
    applicant: '6eec3ccd-4838-46d1-b6cf-18fd44b39984',
    notary: '4879d1d8-79f5-4b07-80e8-ee73de4eb4e6',
    admin: '85ab2914-6dd3-486a-a382-cfe7cf86dbb2',
  },
  auditLogs: {
    assessmentCreated: '7ef4f5bc-7227-46d4-a67f-c3075ccabebf',
    paymentReceived: '0d36586e-8e2b-450c-9b91-fec8d18295f7',
    reportSigned: '2602d7eb-6336-4f69-bce8-7c9829cc8b74',
  },
  promos: {
    spring: 'db7737cc-6d86-47dc-a0ab-6be21349a2a0',
  },
  sales: {
    spring: 'ddb6b6ce-c9df-4972-ad3a-29056b77b57d',
  },
} as const;

async function main(): Promise<void> {
  await upsertUsers();
  await upsertPromoAndSale();
  await upsertAssessments();
  await upsertDocuments();
  await upsertSubscriptions();
  await upsertPayments();
  await upsertReports();
  await upsertNotifications();
  await upsertAuditLogs();

  const [
    userCount,
    assessmentCount,
    paymentCount,
    subscriptionCount,
    notificationCount,
    promoCount,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.assessment.count(),
    prisma.payment.count(),
    prisma.subscription.count(),
    prisma.notification.count(),
    prisma.promo.count(),
  ]);

  console.info(
    [
      'Seed finished successfully.',
      `Users: ${userCount}`,
      `Assessments: ${assessmentCount}`,
      `Payments: ${paymentCount}`,
      `Subscriptions: ${subscriptionCount}`,
      `Notifications: ${notificationCount}`,
      `Promos: ${promoCount}`,
    ].join(' '),
  );
}

async function upsertUsers(): Promise<void> {
  await prisma.user.upsert({
    where: { id: ids.users.applicant },
    update: {
      email: 'applicant@test.local',
      passwordHash: 'test-password-hash-applicant',
      fullName: 'Иван Заявитель',
      role: Role.Applicant,
      phoneNumber: '+79990000001',
      isActive: true,
    },
    create: {
      id: ids.users.applicant,
      email: 'applicant@test.local',
      passwordHash: 'test-password-hash-applicant',
      fullName: 'Иван Заявитель',
      role: Role.Applicant,
      phoneNumber: '+79990000001',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: ids.users.notary },
    update: {
      email: 'notary@test.local',
      passwordHash: 'test-password-hash-notary',
      fullName: 'Наталья Нотариус',
      role: Role.Notary,
      phoneNumber: '+79990000002',
      isActive: true,
    },
    create: {
      id: ids.users.notary,
      email: 'notary@test.local',
      passwordHash: 'test-password-hash-notary',
      fullName: 'Наталья Нотариус',
      role: Role.Notary,
      phoneNumber: '+79990000002',
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { id: ids.users.admin },
    update: {
      email: 'admin@test.local',
      passwordHash: 'test-password-hash-admin',
      fullName: 'Алексей Администратор',
      role: Role.Admin,
      phoneNumber: '+79990000003',
      isActive: true,
    },
    create: {
      id: ids.users.admin,
      email: 'admin@test.local',
      passwordHash: 'test-password-hash-admin',
      fullName: 'Алексей Администратор',
      role: Role.Admin,
      phoneNumber: '+79990000003',
      isActive: true,
    },
  });
}

async function upsertPromoAndSale(): Promise<void> {
  await prisma.promo.upsert({
    where: { id: ids.promos.spring },
    update: {
      code: 'SPRING25',
      description: 'Скидка 25% на оформление подписки для локального стенда.',
    },
    create: {
      id: ids.promos.spring,
      code: 'SPRING25',
      description: 'Скидка 25% на оформление подписки для локального стенда.',
    },
  });

  await prisma.sale.upsert({
    where: { id: ids.sales.spring },
    update: {
      sourceId: ids.promos.spring,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      percent: '25.00',
      type: SaleType.Promo,
    },
    create: {
      id: ids.sales.spring,
      sourceId: ids.promos.spring,
      startDate: new Date('2026-03-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T00:00:00.000Z'),
      percent: '25.00',
      type: SaleType.Promo,
    },
  });
}

async function upsertAssessments(): Promise<void> {
  await prisma.assessment.upsert({
    where: { id: ids.assessments.apartment },
    update: {
      userId: ids.users.applicant,
      status: AssessmentStatus.InProgress,
      address: 'г. Екатеринбург, ул. Малышева, 18, кв. 42',
      description: 'Оценка квартиры для нотариальной сделки купли-продажи.',
      estimatedValue: '7450000.00',
    },
    create: {
      id: ids.assessments.apartment,
      userId: ids.users.applicant,
      status: AssessmentStatus.InProgress,
      address: 'г. Екатеринбург, ул. Малышева, 18, кв. 42',
      description: 'Оценка квартиры для нотариальной сделки купли-продажи.',
      estimatedValue: '7450000.00',
    },
  });

  await prisma.assessment.upsert({
    where: { id: ids.assessments.countryHouse },
    update: {
      userId: ids.users.applicant,
      status: AssessmentStatus.Completed,
      address: 'Свердловская обл., п. Балтым, ул. Сосновая, 7',
      description: 'Оценка загородного дома для вступления в наследство.',
      estimatedValue: '12900000.00',
    },
    create: {
      id: ids.assessments.countryHouse,
      userId: ids.users.applicant,
      status: AssessmentStatus.Completed,
      address: 'Свердловская обл., п. Балтым, ул. Сосновая, 7',
      description: 'Оценка загородного дома для вступления в наследство.',
      estimatedValue: '12900000.00',
    },
  });

  await prisma.assessment.upsert({
    where: { id: ids.assessments.office },
    update: {
      userId: ids.users.notary,
      status: AssessmentStatus.Verified,
      address: 'г. Екатеринбург, ул. Бориса Ельцина, 3, офис 1204',
      description: 'Подготовка копий документов и оценка коммерческого помещения.',
      estimatedValue: '18350000.00',
    },
    create: {
      id: ids.assessments.office,
      userId: ids.users.notary,
      status: AssessmentStatus.Verified,
      address: 'г. Екатеринбург, ул. Бориса Ельцина, 3, офис 1204',
      description: 'Подготовка копий документов и оценка коммерческого помещения.',
      estimatedValue: '18350000.00',
    },
  });
}

async function upsertDocuments(): Promise<void> {
  await prisma.document.upsert({
    where: { id: ids.documents.apartmentPassport },
    update: {
      assessmentId: ids.assessments.apartment,
      fileName: 'passport.pdf',
      fileType: 'application/pdf',
      filePath: '/uploads/test/passport.pdf',
      version: 1,
      uploadedById: ids.users.applicant,
    },
    create: {
      id: ids.documents.apartmentPassport,
      assessmentId: ids.assessments.apartment,
      fileName: 'passport.pdf',
      fileType: 'application/pdf',
      filePath: '/uploads/test/passport.pdf',
      version: 1,
      uploadedById: ids.users.applicant,
    },
  });

  await prisma.document.upsert({
    where: { id: ids.documents.apartmentExtract },
    update: {
      assessmentId: ids.assessments.apartment,
      fileName: 'extract-egrn.pdf',
      fileType: 'application/pdf',
      filePath: '/uploads/test/extract-egrn.pdf',
      version: 2,
      uploadedById: ids.users.applicant,
    },
    create: {
      id: ids.documents.apartmentExtract,
      assessmentId: ids.assessments.apartment,
      fileName: 'extract-egrn.pdf',
      fileType: 'application/pdf',
      filePath: '/uploads/test/extract-egrn.pdf',
      version: 2,
      uploadedById: ids.users.applicant,
    },
  });

  await prisma.document.upsert({
    where: { id: ids.documents.countryHouseOwnership },
    update: {
      assessmentId: ids.assessments.countryHouse,
      fileName: 'ownership-certificate.pdf',
      fileType: 'application/pdf',
      filePath: '/uploads/test/ownership-certificate.pdf',
      version: 1,
      uploadedById: ids.users.applicant,
    },
    create: {
      id: ids.documents.countryHouseOwnership,
      assessmentId: ids.assessments.countryHouse,
      fileName: 'ownership-certificate.pdf',
      fileType: 'application/pdf',
      filePath: '/uploads/test/ownership-certificate.pdf',
      version: 1,
      uploadedById: ids.users.applicant,
    },
  });
}

async function upsertSubscriptions(): Promise<void> {
  await prisma.subscription.upsert({
    where: { id: ids.subscriptions.premium },
    update: {
      userId: ids.users.notary,
      plan: SubscriptionPlan.Premium,
      startDate: new Date('2026-02-15T00:00:00.000Z'),
      endDate: new Date('2026-03-17T00:00:00.000Z'),
      isActive: true,
    },
    create: {
      id: ids.subscriptions.premium,
      userId: ids.users.notary,
      plan: SubscriptionPlan.Premium,
      startDate: new Date('2026-02-15T00:00:00.000Z'),
      endDate: new Date('2026-03-17T00:00:00.000Z'),
      isActive: true,
    },
  });

  await prisma.subscription.upsert({
    where: { id: ids.subscriptions.enterprise },
    update: {
      userId: ids.users.admin,
      plan: SubscriptionPlan.Enterprise,
      startDate: new Date('2026-03-05T00:00:00.000Z'),
      endDate: new Date('2026-04-04T00:00:00.000Z'),
      isActive: true,
    },
    create: {
      id: ids.subscriptions.enterprise,
      userId: ids.users.admin,
      plan: SubscriptionPlan.Enterprise,
      startDate: new Date('2026-03-05T00:00:00.000Z'),
      endDate: new Date('2026-04-04T00:00:00.000Z'),
      isActive: true,
    },
  });
}

async function upsertPayments(): Promise<void> {
  await prisma.payment.upsert({
    where: { id: ids.payments.premiumCompleted },
    update: {
      userId: ids.users.notary,
      type: PaymentType.Subscription,
      subscriptionId: ids.subscriptions.premium,
      assessmentId: null,
      amount: '4990.00',
      paymentDate: new Date('2026-02-15T10:30:00.000Z'),
      status: PaymentStatus.Completed,
      paymentMethod: 'bank_card',
      transactionId: 'TXN-SEED-1001',
      attachmentFileName: 'receipt-premium.pdf',
      attachmentFileUrl: 'https://example.local/files/receipt-premium.pdf',
    },
    create: {
      id: ids.payments.premiumCompleted,
      userId: ids.users.notary,
      type: PaymentType.Subscription,
      subscriptionId: ids.subscriptions.premium,
      assessmentId: null,
      amount: '4990.00',
      paymentDate: new Date('2026-02-15T10:30:00.000Z'),
      status: PaymentStatus.Completed,
      paymentMethod: 'bank_card',
      transactionId: 'TXN-SEED-1001',
      attachmentFileName: 'receipt-premium.pdf',
      attachmentFileUrl: 'https://example.local/files/receipt-premium.pdf',
    },
  });

  await prisma.payment.upsert({
    where: { id: ids.payments.enterprisePending },
    update: {
      userId: ids.users.admin,
      type: PaymentType.Subscription,
      subscriptionId: ids.subscriptions.enterprise,
      assessmentId: null,
      amount: '14990.00',
      paymentDate: new Date('2026-03-05T09:15:00.000Z'),
      status: PaymentStatus.Pending,
      paymentMethod: 'invoice',
      transactionId: 'TXN-SEED-1002',
      attachmentFileName: 'invoice-enterprise.pdf',
      attachmentFileUrl: 'https://example.local/files/invoice-enterprise.pdf',
    },
    create: {
      id: ids.payments.enterprisePending,
      userId: ids.users.admin,
      type: PaymentType.Subscription,
      subscriptionId: ids.subscriptions.enterprise,
      assessmentId: null,
      amount: '14990.00',
      paymentDate: new Date('2026-03-05T09:15:00.000Z'),
      status: PaymentStatus.Pending,
      paymentMethod: 'invoice',
      transactionId: 'TXN-SEED-1002',
      attachmentFileName: 'invoice-enterprise.pdf',
      attachmentFileUrl: 'https://example.local/files/invoice-enterprise.pdf',
    },
  });

  await prisma.payment.upsert({
    where: { id: ids.payments.apartmentAssessment },
    update: {
      userId: ids.users.applicant,
      type: PaymentType.Assessment,
      subscriptionId: null,
      assessmentId: ids.assessments.apartment,
      amount: '8900.00',
      paymentDate: new Date('2026-03-01T14:20:00.000Z'),
      status: PaymentStatus.Completed,
      paymentMethod: 'sbp',
      transactionId: 'TXN-SEED-1003',
      attachmentFileName: 'assessment-payment.pdf',
      attachmentFileUrl: 'https://example.local/files/assessment-payment.pdf',
    },
    create: {
      id: ids.payments.apartmentAssessment,
      userId: ids.users.applicant,
      type: PaymentType.Assessment,
      subscriptionId: null,
      assessmentId: ids.assessments.apartment,
      amount: '8900.00',
      paymentDate: new Date('2026-03-01T14:20:00.000Z'),
      status: PaymentStatus.Completed,
      paymentMethod: 'sbp',
      transactionId: 'TXN-SEED-1003',
      attachmentFileName: 'assessment-payment.pdf',
      attachmentFileUrl: 'https://example.local/files/assessment-payment.pdf',
    },
  });

  await prisma.payment.upsert({
    where: { id: ids.payments.countryHouseAssessmentRefund },
    update: {
      userId: ids.users.applicant,
      type: PaymentType.Assessment,
      subscriptionId: null,
      assessmentId: ids.assessments.countryHouse,
      amount: '11200.00',
      paymentDate: new Date('2026-02-25T11:10:00.000Z'),
      status: PaymentStatus.Refunded,
      paymentMethod: 'bank_card',
      transactionId: 'TXN-SEED-1004',
      attachmentFileName: 'refund-country-house.pdf',
      attachmentFileUrl: 'https://example.local/files/refund-country-house.pdf',
    },
    create: {
      id: ids.payments.countryHouseAssessmentRefund,
      userId: ids.users.applicant,
      type: PaymentType.Assessment,
      subscriptionId: null,
      assessmentId: ids.assessments.countryHouse,
      amount: '11200.00',
      paymentDate: new Date('2026-02-25T11:10:00.000Z'),
      status: PaymentStatus.Refunded,
      paymentMethod: 'bank_card',
      transactionId: 'TXN-SEED-1004',
      attachmentFileName: 'refund-country-house.pdf',
      attachmentFileUrl: 'https://example.local/files/refund-country-house.pdf',
    },
  });

  await prisma.payment.upsert({
    where: { id: ids.payments.officeDocumentCopy },
    update: {
      userId: ids.users.notary,
      type: PaymentType.DocumentCopy,
      subscriptionId: null,
      assessmentId: ids.assessments.office,
      amount: '1500.00',
      paymentDate: new Date('2026-03-06T08:45:00.000Z'),
      status: PaymentStatus.Failed,
      paymentMethod: 'bank_card',
      transactionId: 'TXN-SEED-1005',
      attachmentFileName: 'document-copy.pdf',
      attachmentFileUrl: 'https://example.local/files/document-copy.pdf',
    },
    create: {
      id: ids.payments.officeDocumentCopy,
      userId: ids.users.notary,
      type: PaymentType.DocumentCopy,
      subscriptionId: null,
      assessmentId: ids.assessments.office,
      amount: '1500.00',
      paymentDate: new Date('2026-03-06T08:45:00.000Z'),
      status: PaymentStatus.Failed,
      paymentMethod: 'bank_card',
      transactionId: 'TXN-SEED-1005',
      attachmentFileName: 'document-copy.pdf',
      attachmentFileUrl: 'https://example.local/files/document-copy.pdf',
    },
  });
}

async function upsertReports(): Promise<void> {
  await prisma.assessmentReport.upsert({
    where: { id: ids.reports.apartment },
    update: {
      assessmentId: ids.assessments.apartment,
      reportPath: '/reports/test/apartment-report-v1.pdf',
      signedById: ids.users.notary,
      signatureData: Buffer.from('signed-apartment-report'),
      version: 1,
    },
    create: {
      id: ids.reports.apartment,
      assessmentId: ids.assessments.apartment,
      reportPath: '/reports/test/apartment-report-v1.pdf',
      signedById: ids.users.notary,
      signatureData: Buffer.from('signed-apartment-report'),
      version: 1,
    },
  });

  await prisma.assessmentReport.upsert({
    where: { id: ids.reports.countryHouse },
    update: {
      assessmentId: ids.assessments.countryHouse,
      reportPath: '/reports/test/country-house-report-v2.pdf',
      signedById: ids.users.admin,
      signatureData: Buffer.from('signed-country-house-report'),
      version: 2,
    },
    create: {
      id: ids.reports.countryHouse,
      assessmentId: ids.assessments.countryHouse,
      reportPath: '/reports/test/country-house-report-v2.pdf',
      signedById: ids.users.admin,
      signatureData: Buffer.from('signed-country-house-report'),
      version: 2,
    },
  });
}

async function upsertNotifications(): Promise<void> {
  await prisma.notification.upsert({
    where: { id: ids.notifications.applicant },
    update: {
      userId: ids.users.applicant,
      type: NotificationType.Email,
      message: 'По заявке на квартиру загружены все документы, оценка находится в работе.',
      status: NotificationStatus.Sent,
    },
    create: {
      id: ids.notifications.applicant,
      userId: ids.users.applicant,
      type: NotificationType.Email,
      message: 'По заявке на квартиру загружены все документы, оценка находится в работе.',
      status: NotificationStatus.Sent,
    },
  });

  await prisma.notification.upsert({
    where: { id: ids.notifications.notary },
    update: {
      userId: ids.users.notary,
      type: NotificationType.Push,
      message: 'Подписка Premium активна до 17 марта 2026.',
      status: NotificationStatus.Sent,
    },
    create: {
      id: ids.notifications.notary,
      userId: ids.users.notary,
      type: NotificationType.Push,
      message: 'Подписка Premium активна до 17 марта 2026.',
      status: NotificationStatus.Sent,
    },
  });

  await prisma.notification.upsert({
    where: { id: ids.notifications.admin },
    update: {
      userId: ids.users.admin,
      type: NotificationType.SMS,
      message: 'Счёт на Enterprise подписку ожидает оплаты.',
      status: NotificationStatus.Pending,
    },
    create: {
      id: ids.notifications.admin,
      userId: ids.users.admin,
      type: NotificationType.SMS,
      message: 'Счёт на Enterprise подписку ожидает оплаты.',
      status: NotificationStatus.Pending,
    },
  });
}

async function upsertAuditLogs(): Promise<void> {
  await prisma.auditLog.upsert({
    where: { id: ids.auditLogs.assessmentCreated },
    update: {
      userId: ids.users.applicant,
      actionType: 'assessment.created',
      entityName: 'Assessment',
      entityId: ids.assessments.apartment,
      details: {
        address: 'г. Екатеринбург, ул. Малышева, 18, кв. 42',
        source: 'seed',
      },
    },
    create: {
      id: ids.auditLogs.assessmentCreated,
      userId: ids.users.applicant,
      actionType: 'assessment.created',
      entityName: 'Assessment',
      entityId: ids.assessments.apartment,
      details: {
        address: 'г. Екатеринбург, ул. Малышева, 18, кв. 42',
        source: 'seed',
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: ids.auditLogs.paymentReceived },
    update: {
      userId: ids.users.notary,
      actionType: 'payment.completed',
      entityName: 'Payment',
      entityId: ids.payments.premiumCompleted,
      details: {
        amount: '4990.00',
        method: 'bank_card',
        source: 'seed',
      },
    },
    create: {
      id: ids.auditLogs.paymentReceived,
      userId: ids.users.notary,
      actionType: 'payment.completed',
      entityName: 'Payment',
      entityId: ids.payments.premiumCompleted,
      details: {
        amount: '4990.00',
        method: 'bank_card',
        source: 'seed',
      },
    },
  });

  await prisma.auditLog.upsert({
    where: { id: ids.auditLogs.reportSigned },
    update: {
      userId: ids.users.admin,
      actionType: 'report.signed',
      entityName: 'AssessmentReport',
      entityId: ids.reports.countryHouse,
      details: {
        reportPath: '/reports/test/country-house-report-v2.pdf',
        source: 'seed',
      },
    },
    create: {
      id: ids.auditLogs.reportSigned,
      userId: ids.users.admin,
      actionType: 'report.signed',
      entityName: 'AssessmentReport',
      entityId: ids.reports.countryHouse,
      details: {
        reportPath: '/reports/test/country-house-report-v2.pdf',
        source: 'seed',
      },
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
