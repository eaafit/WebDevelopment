import { OAuthProvider, Role as PrismaRole } from '@internal/prisma-client';
import { OAuthAccountRepository } from './oauth-account.repository';

describe('OAuthAccountRepository', () => {
  const prisma = {
    oAuthAccount: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  };

  let repository: OAuthAccountRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new OAuthAccountRepository(prisma as never);
  });

  it('returns the linked user when the provider account exists', async () => {
    const user = { id: 'user-1', email: 'a@b.com', fullName: 'A', role: PrismaRole.Applicant };
    prisma.oAuthAccount.findUnique.mockResolvedValue({ user });

    const result = await repository.findUserByProviderAccount(OAuthProvider.Google, 'sub-1');

    expect(prisma.oAuthAccount.findUnique).toHaveBeenCalledWith({
      where: { provider_providerUserId: { provider: OAuthProvider.Google, providerUserId: 'sub-1' } },
      include: { user: true },
    });
    expect(result).toBe(user);
  });

  it('returns null when no provider account is found', async () => {
    prisma.oAuthAccount.findUnique.mockResolvedValue(null);
    const result = await repository.findUserByProviderAccount(OAuthProvider.Google, 'missing');
    expect(result).toBeNull();
  });

  it('links an account to an existing user', async () => {
    prisma.oAuthAccount.create.mockResolvedValue({});
    await repository.linkAccount('user-2', OAuthProvider.Google, 'sub-2');
    expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
      data: { userId: 'user-2', provider: OAuthProvider.Google, providerUserId: 'sub-2' },
    });
  });

  it('creates a passwordless user together with the linked account', async () => {
    const created = { id: 'user-3', email: 'new@example.com', fullName: 'New', role: PrismaRole.Applicant };
    prisma.user.create.mockResolvedValue(created);

    const result = await repository.createUserWithAccount(
      { email: 'new@example.com', fullName: 'New', role: PrismaRole.Applicant },
      OAuthProvider.Google,
      'sub-3',
    );

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'new@example.com',
        fullName: 'New',
        role: PrismaRole.Applicant,
        passwordHash: null,
        oauthAccounts: { create: { provider: OAuthProvider.Google, providerUserId: 'sub-3' } },
      },
    });
    expect(result).toBe(created);
  });
});
