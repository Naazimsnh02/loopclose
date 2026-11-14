import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobsService, Queues } from '../../common/jobs.service';
import { PrismaService } from '../../common/prisma.service';
import { EscalationsService } from '../escalations/escalations.service';
import type { SlaJobData } from './sla.scheduler';

@Injectable()
export class SlaWorker implements OnModuleInit {
  private readonly log = new Logger(SlaWorker.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly prisma: PrismaService,
    private readonly escalations: EscalationsService,
  ) {}

  async onModuleInit() {
    if (!this.jobs.workersEnabled) return;
    await this.jobs.boss.work<SlaJobData>(Queues.slaWarn, async ([job]) => this.onWarn(job!.data));
    await this.jobs.boss.work<SlaJobData>(Queues.slaBreach, async ([job]) => this.onBreach(job!.data));
  }

  /** A timer is only valid if the case is still at the version that scheduled it. */
  private async stillCurrent(data: SlaJobData): Promise<boolean> {
    const c = await this.prisma.case.findUnique({ where: { id: data.caseId }, select: { version: true, state: true } });
    return !!c && c.version === data.version && c.state === data.state;
  }

  private async onWarn(data: SlaJobData) {
    if (!(await this.stillCurrent(data))) return;
    await this.escalations.handle({ type: 'sla.warn', caseId: data.caseId, state: data.state });
  }

  private async onBreach(data: SlaJobData) {
    if (!(await this.stillCurrent(data))) return;
    this.log.warn(`SLA breached: case ${data.caseId} in ${data.state}`);
    await this.escalations.handle({ type: 'sla.breach', caseId: data.caseId, state: data.state });
  }
}
