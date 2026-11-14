import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './common/prisma.service';
import { ProgrammeRegistry } from './common/programme-registry.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
  ) {}

  @Get()
  async health() {
    let db = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'unreachable';
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      programmes: this.programmes.list().map((p) => `${p.id}@${p.version}`),
      time: new Date().toISOString(),
    };
  }
}
