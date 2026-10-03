import { TestBed } from '@angular/core/testing';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
  AssessmentStatus as RpcAssessmentStatus,
  type Assessment as RpcAssessment,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import {
  AdminAssessmentApiService,
  fromRpcStatus,
  toAdminAssessmentRow,
  toRpcStatus,
  type AdminAssessmentStatus,
} from './assessment-api.service';

describe('AdminAssessmentApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: RPC_TRANSPORT, useValue: createStubTransport() }],
    });
  });

  it('should be provided', () => {
    expect(TestBed.inject(AdminAssessmentApiService)).toBeTruthy();
  });
});

describe('assessment-api status mapper', () => {
  it('maps every proto status to the UI string', () => {
    expect(fromRpcStatus(RpcAssessmentStatus.NEW)).toBe('New');
    expect(fromRpcStatus(RpcAssessmentStatus.VERIFIED)).toBe('Verified');
    expect(fromRpcStatus(RpcAssessmentStatus.IN_PROGRESS)).toBe('InProgress');
    expect(fromRpcStatus(RpcAssessmentStatus.COMPLETED)).toBe('Completed');
    expect(fromRpcStatus(RpcAssessmentStatus.CANCELLED)).toBe('Cancelled');
  });

  it('falls back to "New" for UNSPECIFIED', () => {
    expect(fromRpcStatus(RpcAssessmentStatus.UNSPECIFIED)).toBe('New');
  });

  it('round-trips through to/from for every defined status', () => {
    const all: AdminAssessmentStatus[] = ['New', 'Verified', 'InProgress', 'Completed', 'Cancelled'];
    for (const s of all) {
      expect(fromRpcStatus(toRpcStatus(s))).toBe(s);
    }
  });
});

describe('toAdminAssessmentRow', () => {
  it('converts an RpcAssessment to an AdminAssessmentRow', () => {
    const created = new Date('2024-03-01T10:00:00.000Z');
    const updated = new Date('2024-03-02T11:30:00.000Z');

    const rpc = {
      id: 'a-1',
      userId: 'u-1',
      status: RpcAssessmentStatus.VERIFIED,
      address: 'г. Москва, Тверская 12',
      description: 'жильё',
      estimatedValue: '1500000',
      createdAt: timestampFromDate(created),
      updatedAt: timestampFromDate(updated),
    } as unknown as RpcAssessment;

    const row = toAdminAssessmentRow(rpc);

    expect(row.id).toBe('a-1');
    expect(row.userId).toBe('u-1');
    expect(row.status).toBe('Verified');
    expect(row.address).toBe('г. Москва, Тверская 12');
    expect(row.description).toBe('жильё');
    expect(row.estimatedValue).toBe('1500000');
    expect(row.createdAt).toBe(created.toISOString());
    expect(row.updatedAt).toBe(updated.toISOString());
  });

  it('returns empty strings for missing timestamps', () => {
    const rpc = {
      id: 'a-2',
      userId: 'u-2',
      status: RpcAssessmentStatus.NEW,
      address: '',
      description: '',
      estimatedValue: '',
      createdAt: undefined,
      updatedAt: undefined,
    } as unknown as RpcAssessment;

    const row = toAdminAssessmentRow(rpc);

    expect(row.createdAt).toBe('');
    expect(row.updatedAt).toBe('');
    expect(row.status).toBe('New');
  });
});

function createStubTransport(): unknown {
  return {
    unary: jest.fn(),
    stream: jest.fn(),
  };
}
