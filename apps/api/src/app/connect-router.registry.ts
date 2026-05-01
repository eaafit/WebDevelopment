import { type ConnectRouter } from '@connectrpc/connect';
import { Injectable } from '@nestjs/common';

// RPC-сервисы
import { AuditRpcService } from '@internal/audit';
import { AuthRpcService } from '@internal/auth';
import { AssessmentRpcService } from '@internal/assessment';
import { BitrixRpcService } from '@internal/bitrix';
import { PaymentRpcService } from '@internal/billing';
import { DocumentRpcService } from '@internal/document';
import { NotificationRpcService } from '@internal/notification';
import { ReportRpcService } from '@internal/report';
import { UserRpcService } from '@internal/user';

// gRPC-контракты (сгенерированные сервисы)
import {
  AuditService,
  AuthService,
  AssessmentService,
  BitrixService,
  DocumentService,
  NotificationService,
  PaymentService,
  ReportService,
  UserService,
} from '@notary-portal/api-contracts';

@Injectable()
export class ConnectRouterRegistry {
  constructor(
    private readonly auditRpcService: AuditRpcService,
    private readonly authRpcService: AuthRpcService,
    private readonly assessmentRpcService: AssessmentRpcService,
    private readonly bitrixRpcService: BitrixRpcService,
    private readonly paymentRpcService: PaymentRpcService,
    private readonly documentRpcService: DocumentRpcService,
    private readonly notificationRpcService: NotificationRpcService,
    private readonly reportRpcService: ReportRpcService,
    private readonly userRpcService: UserRpcService,
  ) {}

  register(router: ConnectRouter): void {
    // ─── Audit ───────────────────────────────────────────────
    router.service(AuditService, {
      listAuditEvents: this.auditRpcService.listAuditEvents,
      exportAuditEvents: this.auditRpcService.exportAuditEvents,
    });

    // ─── Auth ────────────────────────────────────────────────
    router.service(AuthService, {
      register: this.authRpcService.register,
      login: this.authRpcService.login,
      refreshToken: this.authRpcService.refreshToken,
      logout: this.authRpcService.logout,
      forgotPassword: this.authRpcService.forgotPassword,
      resetPassword: this.authRpcService.resetPassword,
    });

    // ─── User ────────────────────────────────────────────────
    router.service(UserService, {
      getProfile: this.userRpcService.getProfile,
      updateProfile: this.userRpcService.updateProfile,
      getUserById: this.userRpcService.getUserById,
      listUsers: this.userRpcService.listUsers,
    });

    // ─── Assessment ──────────────────────────────────────────
    router.service(AssessmentService, {
      createAssessment: this.assessmentRpcService.createAssessment,
      getAssessment: this.assessmentRpcService.getAssessment,
      updateAssessment: this.assessmentRpcService.updateAssessment,
      listAssessments: this.assessmentRpcService.listAssessments,
      listCities: this.assessmentRpcService.listCities,
      listDistricts: this.assessmentRpcService.listDistricts,
      verifyAssessment: this.assessmentRpcService.verifyAssessment,
      completeAssessment: this.assessmentRpcService.completeAssessment,
      cancelAssessment: this.assessmentRpcService.cancelAssessment,
    });

    // ─── Document ────────────────────────────────────────────
    router.service(DocumentService, {
      createDocument: this.documentRpcService.createDocument,
      getDocument: this.documentRpcService.getDocument,
      listDocumentsByAssessment: this.documentRpcService.listDocumentsByAssessment,
      deleteDocument: this.documentRpcService.deleteDocument,
    });

    // ─── Notification ────────────────────────────────────────
    router.service(NotificationService, {
      listNotifications: this.notificationRpcService.listNotifications,
      markAsRead: this.notificationRpcService.markAsRead,
      markAllAsRead: this.notificationRpcService.markAllAsRead,
      deleteNotification: this.notificationRpcService.deleteNotification,
    });

    // ─── Report ──────────────────────────────────────────────
    router.service(ReportService, {
      createReport: this.reportRpcService.createReport,
      getReport: this.reportRpcService.getReport,
      listReports: this.reportRpcService.listReports,
      signReport: this.reportRpcService.signReport,
      deleteReport: this.reportRpcService.deleteReport,
    });

    // ─── Payment ─────────────────────────────────────────────
    router.service(PaymentService, {
      createPayment: this.paymentRpcService.createPayment,
      validateSubscriptionPromo: this.paymentRpcService.validateSubscriptionPromo,
      processWebhook: this.paymentRpcService.processWebhook,
      getPaymentHistory: this.paymentRpcService.getPaymentHistory,
      getSubscription: this.paymentRpcService.getSubscription,
      createSubscription: this.paymentRpcService.createSubscription,
    });

    // ─── Bitrix ──────────────────────────────────────────────
    router.service(BitrixService, {
      getBitrixConfig: this.bitrixRpcService.getBitrixConfig,
      updateBitrixConfig: this.bitrixRpcService.updateBitrixConfig,
      testBitrixConnection: this.bitrixRpcService.testBitrixConnection,
      syncUsersWithBitrix: this.bitrixRpcService.syncUsersWithBitrix,
      getSyncStatus: this.bitrixRpcService.getSyncStatus,
      getSyncLogs: this.bitrixRpcService.getSyncLogs,
    });
  }
}
