import { create } from '@bufbuild/protobuf';
import { AssessmentStatus } from '@internal/prisma-client';
import { Role, requestContextStorage, type AccessTokenPayload } from '@internal/auth-shared';
import {
  AssessmentStatus as RpcAssessmentStatus,
  CancelAssessmentRequestSchema,
  CompleteAssessmentRequestSchema,
  CreateAssessmentRequestSchema,
  UpdateAssessmentRequestSchema,
  VerifyAssessmentRequestSchema,
} from '@notary-portal/api-contracts';
import { AssessmentService } from './assessment.service';

describe('AssessmentService audit events', () => {
  const assessmentRepository = {
    listCities: jest.fn(),
    listDistricts: jest.fn(),
    listAssessments: jest.fn(),
    getAssessment: jest.fn(),
    getAssessmentSnapshot: jest.fn(),
    getUserDisplayName: jest.fn(),
    resolveGeographyIds: jest.fn(),
    createAssessment: jest.fn(),
    updateAssessment: jest.fn(),
    verifyAssessment: jest.fn(),
    completeAssessment: jest.fn(),
    cancelAssessment: jest.fn(),
  };
  const auditService = {
    record: jest.fn(),
  };
  const metrics = {
    recordAssessmentCreated: jest.fn(),
  };
  const fiasProvider = {
    searchAddressItems: jest.fn(),
  };
  const notificationService = {
    createInternalNotificationsForRole: jest.fn(),
  };

  const service = new AssessmentService(
    assessmentRepository as never,
    auditService as never,
    metrics as never,
    fiasProvider as never,
    notificationService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    assessmentRepository.getUserDisplayName.mockResolvedValue(null);
    assessmentRepository.resolveGeographyIds.mockResolvedValue({});
    fiasProvider.searchAddressItems.mockResolvedValue([]);
    notificationService.createInternalNotificationsForRole.mockResolvedValue(undefined);
  });

  it('creates an admin notification after assessment creation', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const applicantId = '33333333-3333-4333-8333-333333333333';
    const snapshot = buildSnapshot({
      id: assessmentId,
      notaryId: null,
      status: AssessmentStatus.New,
    });

    assessmentRepository.createAssessment.mockResolvedValue({
      id: assessmentId,
      userId: applicantId,
      status: RpcAssessmentStatus.NEW,
      address: snapshot.address,
      description: snapshot.description ?? '',
      estimatedValue: '',
    });
    assessmentRepository.getAssessmentSnapshot.mockResolvedValue(snapshot);
    assessmentRepository.getUserDisplayName.mockResolvedValue('Заявитель 1');

    await service.createAssessment(
      create(CreateAssessmentRequestSchema, {
        userId: applicantId,
        address: snapshot.address,
      }),
    );

    expect(notificationService.createInternalNotificationsForRole).toHaveBeenCalledWith(
      'Admin',
      expect.objectContaining({
        title: 'Создана новая заявка на оценку',
        message: 'Заявитель 1 создал заявку #11111111: г. Екатеринбург, ул. Малышева, 18.',
      }),
    );
  });

  it('creates an admin notification after assessment update', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const before = buildSnapshot({
      id: assessmentId,
      notaryId: null,
      status: AssessmentStatus.New,
    });
    const after = {
      ...before,
      address: 'г. Екатеринбург, ул. Ленина, 1',
    };

    assessmentRepository.getAssessmentSnapshot
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    assessmentRepository.updateAssessment.mockResolvedValue({
      id: assessmentId,
      userId: before.userId,
      status: RpcAssessmentStatus.NEW,
      address: after.address,
      description: after.description ?? '',
      estimatedValue: '',
    });
    assessmentRepository.getUserDisplayName.mockResolvedValue('Заявитель 1');

    await runAs(
      {
        sub: before.userId,
        email: 'applicant@example.local',
        role: Role.Applicant,
        iat: 1,
        exp: 2,
      },
      () =>
        service.updateAssessment(
          create(UpdateAssessmentRequestSchema, {
            id: assessmentId,
            address: after.address,
            description: after.description ?? '',
          }),
        ),
    );

    expect(notificationService.createInternalNotificationsForRole).toHaveBeenCalledWith(
      'Admin',
      expect.objectContaining({
        title: 'Обновлена заявка на оценку',
        message: 'Заявитель 1 изменил данные заявки #11111111: г. Екатеринбург, ул. Ленина, 1.',
      }),
    );
  });

  it('normalizes FIAS geography ids before creating an assessment draft', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const applicantId = '33333333-3333-4333-8333-333333333333';
    const staleCityId = 'dbbe9e82-c4ab-437c-a9e8-629ec978b64c';
    const staleDistrictId = '54496aa9-baa2-476b-acc3-7bc1046e614a';
    const localCityId = '58924dd4-3fac-4ce3-a99c-d8393d8da2cf';
    const localDistrictId = '11111111-2222-4333-8444-555555555555';
    const address = 'г Москва, ул Тверская, д 7, кв 12';
    const snapshot = buildSnapshot({
      id: assessmentId,
      notaryId: null,
      status: AssessmentStatus.New,
    });

    assessmentRepository.resolveGeographyIds
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ cityId: localCityId, districtId: localDistrictId });
    fiasProvider.searchAddressItems.mockResolvedValue([
      {
        fullName: address,
        addressDetails: {
          city: 'Москва',
          district: 'Тверской',
        },
      },
    ]);
    assessmentRepository.createAssessment.mockResolvedValue({
      id: assessmentId,
      userId: applicantId,
      status: RpcAssessmentStatus.NEW,
      address,
      description: '',
      estimatedValue: '',
    });
    assessmentRepository.getAssessmentSnapshot.mockResolvedValue(snapshot);

    await service.createAssessment(
      create(CreateAssessmentRequestSchema, {
        userId: applicantId,
        address,
        realEstateObject: {
          cityId: staleCityId,
          districtId: staleDistrictId,
          address,
          area: '54.6',
          objectType: 1,
        },
      }),
    );

    expect(assessmentRepository.createAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        realEstateObject: expect.objectContaining({
          cityId: localCityId,
          districtId: localDistrictId,
        }),
      }),
    );
  });

  it('clears an unknown optional district id during assessment update', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const cityId = '58924dd4-3fac-4ce3-a99c-d8393d8da2cf';
    const staleDistrictId = '54496aa9-baa2-476b-acc3-7bc1046e614a';
    const before = buildSnapshot({
      id: assessmentId,
      notaryId: null,
      status: AssessmentStatus.New,
    });
    const after = { ...before, address: 'г Москва, ул Тверская, д 7, кв 12' };

    assessmentRepository.resolveGeographyIds.mockResolvedValueOnce({ cityId });
    assessmentRepository.getAssessmentSnapshot
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    assessmentRepository.updateAssessment.mockResolvedValue({
      id: assessmentId,
      userId: before.userId,
      status: RpcAssessmentStatus.NEW,
      address: after.address,
      description: '',
      estimatedValue: '',
    });

    await service.updateAssessment(
      create(UpdateAssessmentRequestSchema, {
        id: assessmentId,
        address: after.address,
        description: '',
        realEstateObject: {
          cityId,
          districtId: staleDistrictId,
          address: after.address,
          area: '54.6',
          objectType: 1,
        },
      }),
    );

    expect(assessmentRepository.updateAssessment).toHaveBeenCalledWith(
      assessmentId,
      expect.objectContaining({
        realEstateObject: expect.objectContaining({
          cityId,
          districtId: null,
        }),
      }),
    );
  });

  it('records assignment and in-progress audit events when a notary takes an assessment', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const notaryId = '22222222-2222-4222-8222-222222222222';
    const before = buildSnapshot({
      id: assessmentId,
      notaryId: null,
      status: AssessmentStatus.New,
    });
    const after = buildSnapshot({
      id: assessmentId,
      notaryId,
      status: AssessmentStatus.InProgress,
    });

    assessmentRepository.getAssessmentSnapshot
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    assessmentRepository.verifyAssessment.mockResolvedValue({
      id: assessmentId,
      userId: before.userId,
      status: RpcAssessmentStatus.IN_PROGRESS,
      address: after.address,
      description: after.description ?? '',
      estimatedValue: '',
    });
    assessmentRepository.getUserDisplayName.mockResolvedValue('Нотариус 1');

    await runAs(
      {
        sub: notaryId,
        email: 'notary@example.local',
        role: Role.Notary,
        iat: 1,
        exp: 2,
      },
      () =>
        service.verifyAssessment(
          create(VerifyAssessmentRequestSchema, {
            id: assessmentId,
          }),
        ),
    );

    expect(assessmentRepository.verifyAssessment).toHaveBeenCalledWith(assessmentId, notaryId);
    expect(auditService.record).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        actorUserId: notaryId,
        eventType: 'assessment.assigned_to_notary',
        targetType: 'Assessment',
        targetId: assessmentId,
        actionTitle: 'Заявка назначена нотариусу',
        actionContext: 'Нотариус: не назначен -> #22222222',
      }),
    );
    expect(auditService.record).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        actorUserId: notaryId,
        eventType: 'assessment.status_in_progress',
        targetType: 'Assessment',
        targetId: assessmentId,
        actionTitle: 'Заявка переведена в работу',
        actionContext: 'Статус: new -> under_review',
      }),
    );
    expect(notificationService.createInternalNotificationsForRole).toHaveBeenNthCalledWith(
      1,
      'Admin',
      expect.objectContaining({
        title: 'Заявка назначена нотариусу',
        message: 'Заявка #11111111 передана нотариусу Нотариус 1.',
      }),
    );
    expect(notificationService.createInternalNotificationsForRole).toHaveBeenNthCalledWith(
      2,
      'Admin',
      expect.objectContaining({
        title: 'Заявка взята в работу',
        message: 'Нотариус 1 начал работу по заявке #11111111.',
      }),
    );
  });

  it('creates an admin notification when an assessment is completed', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const before = buildSnapshot({
      id: assessmentId,
      notaryId: '22222222-2222-4222-8222-222222222222',
      status: AssessmentStatus.InProgress,
    });
    const after = {
      ...before,
      status: AssessmentStatus.Completed,
      estimatedValue: '1500000',
    };

    assessmentRepository.getAssessmentSnapshot
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    assessmentRepository.completeAssessment.mockResolvedValue({
      id: assessmentId,
      userId: before.userId,
      status: RpcAssessmentStatus.COMPLETED,
      address: after.address,
      description: after.description ?? '',
      estimatedValue: after.estimatedValue,
    });

    await service.completeAssessment(
      create(CompleteAssessmentRequestSchema, {
        id: assessmentId,
        finalEstimatedValue: after.estimatedValue,
      }),
    );

    expect(notificationService.createInternalNotificationsForRole).toHaveBeenCalledWith(
      'Admin',
      expect.objectContaining({
        title: 'Оценка заявки завершена',
        message:
          'По заявке #11111111 завершена оценка объекта. Итоговая стоимость: 1 500 000 ₽.',
      }),
    );
  });

  it('creates an admin notification when an assessment is cancelled', async () => {
    const assessmentId = '11111111-1111-4111-8111-111111111111';
    const before = buildSnapshot({
      id: assessmentId,
      notaryId: null,
      status: AssessmentStatus.New,
    });
    const after = {
      ...before,
      status: AssessmentStatus.Cancelled,
      cancelReason: 'неполные данные',
    };

    assessmentRepository.getAssessmentSnapshot
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after);
    assessmentRepository.cancelAssessment.mockResolvedValue({
      id: assessmentId,
      userId: before.userId,
      status: RpcAssessmentStatus.CANCELLED,
      address: after.address,
      description: after.description ?? '',
      estimatedValue: '',
    });

    await service.cancelAssessment(
      create(CancelAssessmentRequestSchema, {
        id: assessmentId,
        reason: after.cancelReason,
      }),
    );

    expect(notificationService.createInternalNotificationsForRole).toHaveBeenCalledWith(
      'Admin',
      expect.objectContaining({
        title: 'Заявка на оценку отменена',
        message: 'Заявка #11111111 была отменена. Причина: неполные данные.',
      }),
    );
  });
});

function buildSnapshot(overrides: {
  id: string;
  notaryId: string | null;
  status: AssessmentStatus;
}) {
  return {
    id: overrides.id,
    userId: '33333333-3333-4333-8333-333333333333',
    notaryId: overrides.notaryId,
    status: overrides.status,
    address: 'г. Екатеринбург, ул. Малышева, 18',
    description: 'Оценка объекта',
    estimatedValue: null,
    cancelReason: null,
  };
}

function runAs<T>(user: AccessTokenPayload, callback: () => Promise<T>): Promise<T> {
  return requestContextStorage.run(
    {
      user,
      metadata: {
        ip: null,
        userAgent: null,
      },
    },
    callback,
  );
}
