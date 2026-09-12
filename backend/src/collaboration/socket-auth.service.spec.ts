import { WsException } from '@nestjs/websockets';
import { SocketAuthService } from './socket-auth.service';

describe('SocketAuthService', () => {
  const jwt = { verifyAsync: jest.fn() };
  const prisma = { user: { findUnique: jest.fn() } };
  let service: SocketAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SocketAuthService(jwt as any, prisma as any);
  });

  it('rejects a socket without a bearer token', async () => {
    const socket = { handshake: { auth: {}, headers: {} }, data: {} };

    await expect(service.authenticate(socket as any)).rejects.toBeInstanceOf(
      WsException,
    );
  });

  it('rejects an invalid token without querying a user', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    const socket = {
      handshake: { auth: { token: 'invalid' }, headers: {} },
      data: {},
    };

    await expect(service.authenticate(socket as any)).rejects.toBeInstanceOf(
      WsException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('uses JWT identity and ignores client supplied identity', async () => {
    jwt.verifyAsync.mockResolvedValue({
      userId: 'jwt-user',
      email: 'jwt@test.com',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'jwt-user',
      email: 'jwt@test.com',
      name: 'Verified User',
    });
    const socket = {
      handshake: {
        auth: { token: 'valid', userId: 'attacker', role: 'OWNER' },
        headers: {},
      },
      data: {},
    };

    await expect(service.authenticate(socket as any)).resolves.toEqual({
      id: 'jwt-user',
      email: 'jwt@test.com',
      name: 'Verified User',
    });
    expect(socket.data).toEqual({
      user: {
        id: 'jwt-user',
        email: 'jwt@test.com',
        name: 'Verified User',
      },
    });
  });
});
