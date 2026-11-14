import { Controller, Get, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma.service';

/**
 * E8 — Metrics computed from the event store. Definitions live in docs/metrics-definitions.md.
 * TODO: materialised views + refresh job; stage-time distributions; SLA compliance by org; drop-off
 * reason taxonomy; teach-back pass rate; PREM; CSV (IFHAS layout) + FHIR MeasureReport exports.
 */
@ApiTags('metrics')
@ApiBearerAuth()
@Controller('metrics')
class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('funnel')
  async funnel(@Query('programmeId') programmeId?: string) {
    const rows = await this.prisma.case.groupBy({ by: ['state'], where: programmeId ? { programmeId } : {}, _count: { _all: true } });
    return rows.map((r) => ({ state: r.state, count: r._count._all }));
  }

  @Get('open-results-ageing')
  async ageing() {
    const open = await this.prisma.case.findMany({ where: { state: { notIn: ['closed', 'declined_by_patient', 'lost_to_follow_up'] } }, select: { createdAt: true } });
    const now = Date.now();
    const buckets = { '0-7d': 0, '8-14d': 0, '15-31d': 0, '>31d': 0 };
    for (const c of open) {
      const d = (now - c.createdAt.getTime()) / 86_400_000;
      if (d <= 7) buckets['0-7d']++;
      else if (d <= 14) buckets['8-14d']++;
      else if (d <= 31) buckets['15-31d']++;
      else buckets['>31d']++;
    }
    return buckets;
  }
}

@Module({ controllers: [MetricsController] })
export class MetricsModule {}
