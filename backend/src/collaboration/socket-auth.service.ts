import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedSocketUser {
  id: string;
  email: string;
  name: string;
}

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticate(client: Socket): Promise<AuthenticatedSocketUser> {
    const authToken = client.handshake.auth?.token;
    const header = client.handshake.headers.authorization;
    const rawToken =
      typeof authToken === 'string'
        ? authToken
        : typeof header === 'string'
          ? header
          : undefined;
    const token = rawToken?.startsWith('Bearer ')
      ? rawToken.slice('Bearer '.length)
      : rawToken;

    if (!token) throw new WsException('Unauthorized');

    try {
      const payload = await this.jwt.verifyAsync<{ userId?: string }>(token);
      if (!payload.userId) throw new Error('missing userId');
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true },
      });
      if (!user) throw new Error('user not found');
      client.data.user = user;
      return user;
    } catch {
      throw new WsException('Unauthorized');
    }
  }
}
