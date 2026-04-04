import { Code } from '@connectrpc/connect';
import { create } from '@bufbuild/protobuf';
import { LoginRequestSchema, UserRole, UserSchema, type User } from '@notary-portal/api-contracts';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    toPrismaRole: jest.fn(),
    toMessage: jest.fn(),
  };
  const refreshTokenRepository = {
    save: jest.fn(),
    rotate: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
  };
  const passwordResetRepository = {
    create: jest.fn(),
    findValid: jest.fn(),
    markUsed: jest.fn(),
  };
  const passwordService = {
    hash: jest.fn(),
    compare: jest.fn(),
  };
  const tokenService = {
    generateTokenPair: jest.fn(),
    verifyAccessToken: jest.fn(),
    generatePasswordResetToken: jest.fn(),
  };
  const metrics = {
    recordUserRegistered: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      authRepository as never,
      refreshTokenRepository as never,
      passwordResetRepository as never,
      passwordService as never,
      tokenService as never,
      metrics as never,
      null,
    );
  });

  it('logs in with a valid password hash', async () => {
    const record = {
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuuK1P6aQ4T6bVJj8M3R1xY8VfQ9g2zT4W',
      fullName: 'Заявитель 1',
      role: 'Applicant',
      phoneNumber: '+7999000000',
      isActive: true,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
      updatedAt: new Date('2026-03-13T00:00:00.000Z'),
    };
    const user: User = create(UserSchema, {
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      fullName: 'Заявитель 1',
      role: UserRole.APPLICANT,
      phoneNumber: '+7999000000',
      isActive: true,
    });

    authRepository.findByEmail.mockResolvedValue(record);
    authRepository.toMessage.mockReturnValue(user);
    passwordService.compare.mockResolvedValue(true);
    tokenService.generateTokenPair.mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    refreshTokenRepository.save.mockResolvedValue(undefined);

    const result = await service.login(
      create(LoginRequestSchema, {
        email: 'Seed-User-000@Seed.Local',
        password: 'SeedPass123!',
      }),
    );

    expect(authRepository.findByEmail).toHaveBeenCalledWith('seed-user-000@seed.local');
    expect(passwordService.compare).toHaveBeenCalledWith('SeedPass123!', record.passwordHash);
    expect(refreshTokenRepository.save).toHaveBeenCalledWith(
      'user-1',
      'refresh-token',
      new Date('2026-04-12T00:00:00.000Z'),
    );
    expect(result.result?.accessToken).toBe('access-token');
    expect(result.result?.refreshToken).toBe('refresh-token');
    expect(result.result?.user?.email).toBe('seed-user-000@seed.local');
  });

  it('rejects invalid credentials when password comparison fails', async () => {
    authRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: 'seed-user-000@seed.local',
      passwordHash: '$2a$12$abcdefghijklmnopqrstuuK1P6aQ4T6bVJj8M3R1xY8VfQ9g2zT4W',
      isActive: true,
    });
    passwordService.compare.mockResolvedValue(false);

    await expect(
      service.login(
        create(LoginRequestSchema, {
          email: 'seed-user-000@seed.local',
          password: 'wrong-password',
        }),
      ),
    ).rejects.toMatchObject({
      code: Code.Unauthenticated,
      message: '[unauthenticated] invalid credentials',
    });

    expect(refreshTokenRepository.save).not.toHaveBeenCalled();
  });
});
