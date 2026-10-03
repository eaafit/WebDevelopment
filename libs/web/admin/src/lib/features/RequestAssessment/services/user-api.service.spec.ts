import { TestBed } from '@angular/core/testing';
import {
  UserRole as RpcUserRole,
  type User as RpcUser,
} from '@notary-portal/api-contracts';
import { RPC_TRANSPORT } from '@notary-portal/ui';
import { AdminUserApiService, fromRpcRole, toAdminUserRef } from './user-api.service';

describe('AdminUserApiService', () => {
  let service: AdminUserApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: RPC_TRANSPORT, useValue: createStubTransport() }],
    });
    service = TestBed.inject(AdminUserApiService);
  });

  it('should be provided', () => {
    expect(service).toBeTruthy();
  });

  it('returns dash for an empty userId before any cache load', () => {
    expect(service.getUserName('')).toBe('—');
  });

  it('returns the first 8 chars of the id when the cache has no match', () => {
    expect(service.getUserName('abc12345-1111-2222-3333-444455556666')).toBe('abc12345');
  });

  it('exposes an empty usersById map before loadUsers runs', () => {
    expect(service.usersById.size).toBe(0);
  });
});

describe('user-api role mapper', () => {
  it('maps every proto role to the UI role', () => {
    expect(fromRpcRole(RpcUserRole.APPLICANT)).toBe('Applicant');
    expect(fromRpcRole(RpcUserRole.NOTARY)).toBe('Notary');
    expect(fromRpcRole(RpcUserRole.ADMIN)).toBe('Admin');
    expect(fromRpcRole(RpcUserRole.UNSPECIFIED)).toBe('Unknown');
  });
});

describe('toAdminUserRef', () => {
  it('converts an RpcUser to an AdminUserRef', () => {
    const rpc = {
      id: 'u-1',
      email: 'admin@example.com',
      fullName: 'Иванов Иван Иванович',
      role: RpcUserRole.ADMIN,
      phoneNumber: '+7 999 000-00-00',
      isActive: true,
    } as unknown as RpcUser;

    const ref = toAdminUserRef(rpc);

    expect(ref.id).toBe('u-1');
    expect(ref.email).toBe('admin@example.com');
    expect(ref.fullName).toBe('Иванов Иван Иванович');
    expect(ref.role).toBe('Admin');
    expect(ref.isActive).toBe(true);
  });
});

function createStubTransport(): unknown {
  return {
    unary: jest.fn(),
    stream: jest.fn(),
  };
}
