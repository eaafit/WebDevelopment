import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentStatus as RpcPaymentStatus, PaymentType as RpcPaymentType } from '@notary-portal/api-contracts';
import { RPC_TRANSPORT, WebLoggerService } from '@notary-portal/ui';
import { BehaviorSubject } from 'rxjs';
import { AdminPaymentsApiService } from '../../api/admin-payments-api.service';
import { AdminUserApiService, type AdminUserRef } from '../RequestAssessment/services/user-api.service';
import { MOCK_PAYMENTS, type Payment } from './payments.shared';
import { PaymentFormComponent } from './payment-form.component';

describe('PaymentFormComponent', () => {
  const testUserId = '11111111-1111-4111-8111-111111111111';
  const testAssessmentId = '22222222-2222-4222-8222-222222222222';

  let fixture: ComponentFixture<PaymentFormComponent>;
  let component: PaymentFormComponent;
  let routerNavigate: jest.Mock;
  let createPaymentMock: jest.Mock;
  let updatePaymentMock: jest.Mock;
  let getPaymentByIdMock: jest.Mock;
  let logger: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };
  let paymentsSubject: BehaviorSubject<Payment[] | null>;
  let routeId: string | null = null;

  const testUser: AdminUserRef = {
    id: testUserId,
    fullName: 'Иван Иванов',
    email: 'ivan@test.ru',
    role: 'Applicant',
    isActive: true,
  };

  function setupModule(): void {
    routeId = null;
    routerNavigate = jest.fn().mockResolvedValue(true);
    createPaymentMock = jest.fn().mockResolvedValue({ paymentId: 'new-payment-id' });
    updatePaymentMock = jest.fn().mockResolvedValue({ ...MOCK_PAYMENTS[0], amount: 15000 });
    getPaymentByIdMock = jest.fn().mockResolvedValue(MOCK_PAYMENTS[0]);
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    paymentsSubject = new BehaviorSubject<Payment[] | null>(MOCK_PAYMENTS.map((p) => ({ ...p })));

    TestBed.configureTestingModule({
      imports: [PaymentFormComponent],
      providers: [
        {
          provide: Router,
          useValue: { navigate: routerNavigate },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'id' ? routeId : null),
              },
            },
          },
        },
        {
          provide: RPC_TRANSPORT,
          useValue: {},
        },
        {
          provide: AdminPaymentsApiService,
          useValue: {
            preload: jest.fn(),
            payments$: paymentsSubject.asObservable(),
            getPaymentById: getPaymentByIdMock,
            createPayment: createPaymentMock,
            updatePayment: updatePaymentMock,
          },
        },
        {
          provide: AdminUserApiService,
          useValue: {
            loadUsers: jest.fn().mockResolvedValue(undefined),
            usersById: new Map([[testUser.id, testUser]]),
          },
        },
        {
          provide: WebLoggerService,
          useValue: logger,
        },
      ],
    });
  }

  async function createComponent(): Promise<void> {
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(PaymentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    paymentsSubject?.complete();
  });

  describe('create mode', () => {
    beforeEach(async () => {
      setupModule();
      await createComponent();
    });

    it('should open create form and log form_opened', () => {
      expect(component.mode).toBe('create');
      expect(component.paymentId).toBeNull();
      expect(logger.info).toHaveBeenCalledWith(
        'payment.admin.form_opened',
        expect.objectContaining({
          area: 'admin_payments_form',
          mode: 'create',
        }),
      );
    });

    it('should block submit when form is invalid', async () => {
      component.form.patchValue({
        userId: '',
        payer: '',
        amount: 0,
      });

      await component.submit();

      expect(createPaymentMock).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'payment.admin.form_submit_blocked_invalid',
        expect.objectContaining({ mode: 'create' }),
      );
      expect(component.form.touched).toBe(true);
    });

    it('should create payment and navigate to list on valid submit', async () => {
      component.form.patchValue({
        userId: testUser.id,
        payer: testUser.fullName,
        amount: 5000,
        type: 'Assessment',
        assessmentId: testAssessmentId,
        paymentMethod: 'card',
        status: 'pending',
      });

      await component.submit();

      expect(createPaymentMock).toHaveBeenCalledWith({
        userId: testUser.id,
        amount: '5000',
        type: RpcPaymentType.ASSESSMENT,
        targetId: testAssessmentId,
      });
      expect(component.successMessage).toBe('Платёж успешно создан');
      expect(routerNavigate).toHaveBeenCalledWith(['/admin', 'payments']);
      expect(logger.info).toHaveBeenCalledWith(
        'payment.admin.form_create_succeeded',
        expect.objectContaining({ area: 'admin_payments_form' }),
      );
    });

    it('should show error when createPayment fails', async () => {
      createPaymentMock.mockRejectedValue(new Error('RPC error'));

      component.form.patchValue({
        userId: testUser.id,
        payer: testUser.fullName,
        amount: 5000,
        type: 'Assessment',
        assessmentId: testAssessmentId,
      });

      await component.submit();

      expect(component.error).toBe('RPC error');
      expect(component.loading).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'payment.admin.form_create_failed',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });

    it('should navigate back on cancel', () => {
      component.cancel();

      expect(routerNavigate).toHaveBeenCalledWith(['/admin', 'payments']);
      expect(logger.info).toHaveBeenCalledWith(
        'payment.admin.form_cancelled',
        expect.objectContaining({ mode: 'create' }),
      );
    });
  });

  describe('edit mode (view & update)', () => {
    beforeEach(async () => {
      setupModule();
      routeId = String(MOCK_PAYMENTS[0].id);
      await createComponent();
    });

    it('should load payment for editing and patch the form', () => {
      expect(component.mode).toBe('edit');
      expect(component.paymentId).toBe(String(MOCK_PAYMENTS[0].id));
      expect(getPaymentByIdMock).toHaveBeenCalledWith(String(MOCK_PAYMENTS[0].id));
      expect(component.form.get('amount')?.value).toBe(MOCK_PAYMENTS[0].amount);
      expect(component.form.get('status')?.value).toBe(MOCK_PAYMENTS[0].status);
      expect(logger.info).toHaveBeenCalledWith(
        'payment.admin.form_load_succeeded',
        expect.objectContaining({
          paymentId: String(MOCK_PAYMENTS[0].id),
        }),
      );
    });

    it('should show error when payment is not found', async () => {
      TestBed.resetTestingModule();
      setupModule();
      routeId = 'missing-payment';
      getPaymentByIdMock.mockResolvedValue(null);
      await createComponent();

      expect(component.error).toBe('Платёж не найден');
      expect(logger.warn).toHaveBeenCalledWith(
        'payment.admin.form_load_not_found',
        expect.objectContaining({ paymentId: 'missing-payment' }),
      );
    });

    it('should update payment and navigate to list on valid submit', async () => {
      component.form.patchValue({
        amount: 15000,
        status: 'completed',
        paymentMethod: 'invoice',
        transactionId: 'txn_updated',
      });

      await component.submit();

      expect(updatePaymentMock).toHaveBeenCalledWith({
        id: String(MOCK_PAYMENTS[0].id),
        amount: '15000',
        status: RpcPaymentStatus.COMPLETED,
        paymentMethod: 'invoice',
        transactionId: 'txn_updated',
        attachmentFileName: MOCK_PAYMENTS[0].attachmentFileName,
        attachmentFileUrl: MOCK_PAYMENTS[0].attachmentFileUrl,
      });
      expect(component.successMessage).toBe('Платёж обновлён');
      expect(routerNavigate).toHaveBeenCalledWith(['/admin', 'payments']);
      expect(logger.info).toHaveBeenCalledWith(
        'payment.admin.form_update_succeeded',
        expect.objectContaining({
          paymentId: String(MOCK_PAYMENTS[0].id),
        }),
      );
    });

    it('should show error when updatePayment fails', async () => {
      updatePaymentMock.mockRejectedValue(new Error('Update failed'));

      await component.submit();

      expect(component.error).toBe('Update failed');
      expect(component.loading).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'payment.admin.form_update_failed',
        expect.objectContaining({ error: expect.any(Error) }),
      );
    });
  });
});
