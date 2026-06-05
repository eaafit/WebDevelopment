import { AssessmentStatus } from '@internal/prisma-client';
import { AssessmentRepository } from './assessment.repository';

const summaryAssessment = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  status: AssessmentStatus.New,
  address: 'г. Екатеринбург, ул. Малышева, 18',
  description: 'Оценка объекта',
  estimatedValue: null,
  createdAt: new Date('2026-06-01T10:00:00.000Z'),
  updatedAt: new Date('2026-06-01T10:05:00.000Z'),
  realEstateObjectId: '33333333-3333-4333-8333-333333333333',
};

describe('AssessmentRepository list fallback', () => {
  it('returns summary rows when nested real estate include fails', async () => {
    const prisma = {
      $transaction: jest
        .fn()
        .mockRejectedValueOnce(new Error('Inconsistent query result: Field city is required'))
        .mockImplementationOnce(async (operations: Promise<unknown>[]) => Promise.all(operations)),
      assessment: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([summaryAssessment]),
      },
    };
    const repository = new AssessmentRepository(prisma as never);

    const response = await repository.listAssessments({ page: 1, limit: 20 });

    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.assessment.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          realEstateObjectId: true,
        }),
        take: 20,
      }),
    );
    expect(response.assessments).toHaveLength(1);
    expect(response.assessments[0]).toEqual(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        userId: '22222222-2222-4222-8222-222222222222',
        address: 'г. Екатеринбург, ул. Малышева, 18',
        description: 'Оценка объекта',
        realEstateObjectId: '33333333-3333-4333-8333-333333333333',
      }),
    );
    expect(response.assessments[0].realEstateObject).toBeUndefined();
    expect(response.meta?.totalItems).toBe(1);
    expect(response.meta?.perPage).toBe(20);
  });
});

describe('AssessmentRepository status mutations', () => {
  it('verifies assessment with a summary response that avoids nested include failures', async () => {
    const prisma = {
      assessment: {
        update: jest.fn().mockResolvedValue({
          ...summaryAssessment,
          status: AssessmentStatus.InProgress,
        }),
      },
    };
    const repository = new AssessmentRepository(prisma as never);

    const response = await repository.verifyAssessment(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444',
    );

    expect(prisma.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AssessmentStatus.InProgress,
          notaryId: '44444444-4444-4444-8444-444444444444',
        }),
        select: expect.objectContaining({
          id: true,
          realEstateObjectId: true,
        }),
      }),
    );
    expect(prisma.assessment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ include: expect.anything() }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        status: 3,
        realEstateObjectId: '33333333-3333-4333-8333-333333333333',
      }),
    );
    expect(response.realEstateObject).toBeUndefined();
  });

  it('completes assessment with summary select and preserves the entered value', async () => {
    const prisma = {
      assessment: {
        update: jest.fn().mockResolvedValue({
          ...summaryAssessment,
          status: AssessmentStatus.Completed,
          estimatedValue: '5500000',
        }),
      },
    };
    const repository = new AssessmentRepository(prisma as never);

    const response = await repository.completeAssessment(
      '11111111-1111-4111-8111-111111111111',
      '5500000',
    );

    expect(prisma.assessment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: AssessmentStatus.Completed,
          estimatedValue: '5500000',
        },
        select: expect.objectContaining({
          id: true,
          estimatedValue: true,
        }),
      }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        status: 4,
        estimatedValue: '5500000',
      }),
    );
  });
});
