import { AuthService } from './auth.service';

describe('AuthService invitation claim', () => {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  };
  const jwt = { sign: jest.fn() };
  const invitations = { claimForUser: jest.fn() };

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
  });

  it('creates the user and claims pending invitations in one transaction', async () => {
    const service = new AuthService(prisma as any, jwt as any, invitations as any);

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
  });
});
