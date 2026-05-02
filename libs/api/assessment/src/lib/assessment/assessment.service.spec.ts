import { create } from '@bufbuild/protobuf';
import { AssessmentStatus } from '@internal/prisma-client';
import { Role, requestContextStorage, type AccessTokenPayload } from '@internal/auth-shared';
import {
  AssessmentStatus as RpcAssessmentStatus,
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

  const service = new AssessmentService(
    assessmentRepository as never,
    auditService as never,
    metrics as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
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
