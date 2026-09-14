import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { InvitationService } from '../invitation/invitation.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private readonly invitations: InvitationService,
  ) {}

  async register(registerDto: RegisterDto) {
    const email = registerDto.email.trim().toLowerCase();
    const name = registerDto.name.trim();
    const { password } = registerDto;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.$transaction(async (db) => {
      const existingUser = await db.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const created = await db.user.create({
        data: { email, name, password: hashedPassword },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          createdAt: true,
        },
      });
      await this.invitations.claimForUser(created.id, created.email, db);
      return created;
    });

    // Generate JWT token
    const payload = { userId: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      user,
      token,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const payload = { userId: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}
