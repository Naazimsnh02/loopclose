import { Injectable, Logger } from '@nestjs/common';
import { warnAtFor } from '@loopclose/shared';
import { JobsService, Queues } from '../../common/jobs.service';

export interface SlaJobData {
  caseId: string;
  version: number;
  state: string;
}

@Injectable()
export class SlaScheduler {
  private readonly log = new Logger(SlaScheduler.name);
  constructor(private readonly jobs: JobsService) {}

  async scheduleForState(input: { caseId: string; version: number; state: string; enteredAt: Date; deadlineAt: Date }) {
    const key = `${input.caseId}:${input.version}`;
    const data: SlaJobData = { caseId: input.caseId, version: input.version, state: input.state };
    await this.jobs.scheduleAt(Queues.slaWarn, data, warnAtFor(input.enteredAt, input.deadlineAt), `warn:${key}`);
    await this.jobs.scheduleAt(Queues.slaBreach, data, input.deadlineAt, `breach:${key}`);
    this.log.debug(`SLA timers set for ${key} (${input.state}) → ${input.deadlineAt.toISOString()}`);
  }
}
