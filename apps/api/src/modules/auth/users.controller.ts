import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';
import { Public } from './jwt-auth.guard';

/** User directory for owner pickers and the demo role switcher. */
@ApiTags('users')
@Controller()
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /** Seeded demo personas (DEMO_MODE only) — powers the login screen. */
  @Public()
  @Get('auth/demo-users')
  async demoUsers() {
    if (process.env.DEMO_MODE !== 'true') return [];
    const users = await this.prisma.user.findMany({ include: { organization: { select: { name: true, kind: true } } }, orderBy: { displayName: 'asc' } });
    return users.map((u) => ({ id: u.id, email: u.email, displayName: u.displayName, role: u.role, locale: u.locale, organization: u.organization }));
  }

  @ApiBearerAuth()
  @Get('users')
  async list(@Query('role') role?: string) {
    return this.prisma.user.findMany({
      where: role ? { role: { in: role.split(',') } } : undefined,
      select: { id: true, displayName: true, role: true, organizationId: true, organization: { select: { name: true } } },
      orderBy: { displayName: 'asc' },
    });
  }

  @ApiBearerAuth()
  @Get('organizations')
  async organizations() {
    return this.prisma.organization.findMany({ select: { id: true, name: true, kind: true }, orderBy: { name: 'asc' } });
  }
}
