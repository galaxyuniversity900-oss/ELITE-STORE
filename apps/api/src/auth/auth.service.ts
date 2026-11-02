import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

type Claims = { sub: string; email: string; role: UserRole; exp: number };

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email && !password) return;
    if (!email || !password || password.length < 16) {
      throw new Error('Set both BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 16 characters');
    }
    const passwordHash = this.hashPassword(password);
    await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, role: UserRole.SUPER_ADMIN, isActive: true },
    });
  }

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return {
      accessToken: this.issueToken({ sub: user.id, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 900 }),
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async authenticate(token: string) {
    const secret = this.secret();
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Invalid access token');
    const signed = `${parts[0]}.${parts[1]}`;
    const expected = createHmac('sha256', secret).update(signed).digest();
    let supplied: Buffer;
    let claims: Claims;
    try {
      supplied = Buffer.from(parts[2], 'base64url');
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Claims;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || !claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Account is unavailable');
    return { id: user.id, email: user.email, role: user.role };
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
  }

  private verifyPassword(password: string, stored: string) {
    const [scheme, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false;
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private issueToken(claims: Claims) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const unsigned = `${header}.${payload}`;
    return `${unsigned}.${createHmac('sha256', this.secret()).update(unsigned).digest('base64url')}`;
  }

  private secret() {
    const secret = process.env.JWT_SECRET;
    if (!secret || Buffer.byteLength(secret) < 32) {
      throw new InternalServerErrorException('JWT_SECRET must be configured with at least 32 bytes');
    }
    return secret;
  }
}
