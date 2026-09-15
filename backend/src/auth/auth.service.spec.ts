import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

describe('AuthService invitation claim', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwt = { sign: jest.fn() };
  const invitations = { claimForUser: jest.fn() };
  const audit = { record: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'member@test.com',
      name: 'Member',
      avatar: null,
      createdAt: new Date(),
    });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    invitations.claimForUser.mockResolvedValue({ claimed: 1 });
    jwt.sign.mockReturnValue('token');
    audit.record.mockResolvedValue(undefined);
  });

  it('creates the user and claims pending invitations in one transaction', async () => {
    const service = new AuthService(prisma as any, jwt as any, invitations as any, audit as any);

    const result = await service.register({
      email: ' MEMBER@Test.com ',
      name: 'Member',
      password: 'secret1',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(invitations.claimForUser).toHaveBeenCalledWith(
      'user-1',
      'member@test.com',
      prisma,
    );
    expect(result.token).toBe('token');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: undefined,
        actorId: 'user-1',
        action: 'USER_REGISTERED',
      }),
      prisma,
    );
  });

  it('audits a successful protected login without recording credentials', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'member@test.com',
      name: 'Member',
      password: await bcrypt.hash('secret1', 4),
      avatar: null,
      createdAt: new Date(),
    });
    const service = new AuthService(prisma as any, jwt as any, invitations as any, audit as any);

    await service.login({ email: 'member@test.com', password: 'secret1' });

    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: undefined,
      actorId: 'user-1',
      action: 'USER_LOGGED_IN',
      metadata: {},
    }));
  });
});
