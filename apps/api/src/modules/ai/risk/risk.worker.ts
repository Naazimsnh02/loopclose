import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { JobsService, Queues } from '../../../common/jobs.service';
import { PrismaService } from '../../../common/prisma.service';
import { ProgrammeRegistry } from '../../../common/programme-registry.service';
import { EscalationsService } from '../../escalations/escalations.service';
import { AiFeatureFlags } from '../feature-flags.service';
import { RiskService } from './risk.service';

export interface RiskJobData {
  caseId?: string;
}

/**
 * E6.3 — Keeps drop-off risk fresh. Runs on demand (nudged after outreach, inbound messages and
 * transitions) and every 15 minutes as a sweep. When a case newly turns red, a human escalation is
 * raised for the coordinator (rule `risk-red`). The model never changes case state.
 */
@Injectable()
export class RiskWorker implements OnApplicationBootstrap {
  private readonly log = new Logger(RiskWorker.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
    private readonly programmes: ProgrammeRegistry,
    private readonly risk: RiskService,
    private readonly flags: AiFeatureFlags,
    private readonly escalations: EscalationsService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.jobs.workersEnabled) return;
    await this.jobs.boss.work<RiskJobData>(Queues.riskRecompute, async ([job]) => {
      if (job?.data?.caseId) await this.recomputeOne(job.data.caseId);
      else await this.recomputeAll();
    });
    await this.jobs.boss.schedule(Queues.riskRecompute, '*/15 * * * *', {}, { singletonKey: 'risk:sweep' });
    await this.jobs.nudge(Queues.riskRecompute, 5);
  }

  async recomputeAll(): Promise<{ scored: number; turnedRed: number }> {
    if (!(await this.flags.isEnabled('risk'))) return { scored: 0, turnedRed: 0 };
    const terminal = new Set(this.programmes.list().flatMap((p) => p.terminalStates));
    const open = await this.prisma.case.findMany({ where: { state: { notIn: [...terminal] } }, select: { id: true } });
    let turnedRed = 0;
    for (const { id } of open) if (await this.recomputeOne(id)) turnedRed++;
    this.log.log(`Risk sweep: ${open.length} open cases scored, ${turnedRed} newly red`);
    return { scored: open.length, turnedRed };
  }

  /** Returns true when the case newly entered the red tier. */
  async recomputeOne(caseId: string): Promise<boolean> {
    try {
      const r = await this.risk.score(caseId);
      if (r.tier !== 'red' || r.previousTier === 'red') return false;
      const already = await this.prisma.escalation.findFirst({ where: { caseId, ruleId: 'risk-red', status: { in: ['open', 'acknowledged'] } } });
      if (!already) {
        await this.escalations.handle({
          type: 'risk.tier_changed',
          caseId,
          meta: { tier: 'red', suggestedAction: r.reasons[0]?.suggestedAction, reasons: r.reasons.map((x) => x.label) },
        });
      }
      return true;
    } catch (e) {
      this.log.warn(`risk score failed for ${caseId}: ${String(e)}`);
      return false;
    }
  }
}
