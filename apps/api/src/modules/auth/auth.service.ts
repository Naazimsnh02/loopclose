import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import type { AuthenticatedUser } from '../../common/actor';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Demo login: any seeded user by email, no password (DEMO_MODE only). TODO E2.5: real IdP. */
  async demoLogin(email: string): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    if (process.env.DEMO_MODE !== 'true') throw new UnauthorizedException('Demo login disabled');
    const u = await this.prisma.user.findUnique({ where: { email } });
    if (!u) throw new UnauthorizedException('Unknown demo user');
    const user: AuthenticatedUser = { id: u.id, role: u.role, organizationId: u.organizationId, displayName: u.displayName };
    return { accessToken: await this.jwt.signAsync({ sub: u.id, ...user }), user };
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const payload = await this.jwt.verifyAsync<{ sub: string; role: string; organizationId: string; displayName: string }>(token);
    return { id: payload.sub, role: payload.role, organizationId: payload.organizationId, displayName: payload.displayName };
  }
}
