import { TestBed } from '@angular/core/testing';
import { createRouterTransport } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import {
  AssessmentService,
  AssessmentSchema,
  type ListAssessmentsRequest,
  type GetAssessmentRequest,
  AssessmentStatus,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { AssessmentReadApiService, mapAssessment } from './assessment-read-api.service';

describe('Assessment read RPC', () => {
  it('reads paginated assessments and a detail using the existing contract', async () => {
    const assessment = create(AssessmentSchema, {
      id: 'a-1',
      status: 1,
      address: 'Москва',
      estimatedValue: '123.45',
    });
    const list = jest.fn(async (_request: ListAssessmentsRequest) => ({
      assessments: [assessment],
      meta: { totalPages: 3 },
    }));
    const get = jest.fn(async (_request: GetAssessmentRequest) => ({ assessment }));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RPC_TRANSPORT,
          useValue: createRouterTransport((router) => {
            router.service(AssessmentService, { listAssessments: list, getAssessment: get });
          }),
        },
      ],
    });
    const api = TestBed.inject(AssessmentReadApiService);
    const response = await api.list(2);
    expect(list.mock.calls[0][0]).toMatchObject({ pagination: { page: 2, limit: 20 } });
    expect(response.totalPages).toBe(3);
    expect(response.items[0].assessment.estimatedValue).toBe(123.45);
    expect((await api.get('a-1')).assessment.id).toBe('a-1');
    expect(get.mock.calls[0][0]).toMatchObject({ id: 'a-1' });
  });

  it('keeps missing and unknown server data distinct from valid values', () => {
    const mapped = mapAssessment(
      create(AssessmentSchema, { status: 99 as AssessmentStatus, estimatedValue: 'bad' }),
    );
    expect(mapped.assessment.status).toBe('Unknown');
    expect(mapped.assessment.estimatedValue).toBeUndefined();
    expect(mapped.realEstate.area).toBeUndefined();
    expect(mapped.realEstate.objectType).toBe('Unknown');
  });

  it('rejects a detail response without an assessment', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: RPC_TRANSPORT,
          useValue: createRouterTransport((router) => {
            router.service(AssessmentService, { getAssessment: () => ({}) });
          }),
        },
      ],
    });
    await expect(TestBed.inject(AssessmentReadApiService).get('missing')).rejects.toThrow(
      'Сервер не вернул заявку',
    );
  });
});
