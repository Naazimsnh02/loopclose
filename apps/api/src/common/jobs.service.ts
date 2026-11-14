import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import PgBoss from 'pg-boss';

export const Queues = {
  slaWarn: 'sla.warn',
  slaBreach: 'sla.breach',
  ownerOfferTimeout: 'owner.offer_timeout',
  outboxDrain: 'outbox.drain',
  riskRecompute: 'risk.recompute',
  stalledScan: 'stalled.scan',
  nonResponseCheck: 'message.non_response_check',
} as const;

/**
 * Durable timers and background jobs on Postgres (ADR-003). Timers survive API restarts,
 * which is the whole point for SLA enforcement.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(JobsService.name);
  readonly boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: 'pgboss' });

  /** False when JOBS_WORKERS_DISABLED=true (e.g. the seeder): jobs are enqueued but not processed here. */
  get workersEnabled(): boolean {
    return process.env.JOBS_DISABLED !== 'true' && process.env.JOBS_WORKERS_DISABLED !== 'true';
  }

  async onModuleInit() {
    if (process.env.JOBS_DISABLED === 'true') return;
    this.boss.on('error', (e) => this.log.error(e));
    await this.boss.start();
    for (const q of Object.values(Queues)) await this.boss.createQueue(q);
    this.log.log('pg-boss started');
  }

  async onModuleDestroy() {
    await this.boss.stop({ graceful: true, timeout: 5000 });
  }

  /** Schedule a one-off job at a specific time, keyed so rescheduling replaces the previous timer. */
  async scheduleAt(queue: string, data: object, at: Date, singletonKey: string) {
    return this.boss.send(queue, data, { startAfter: at, singletonKey, retryLimit: 5, retryBackoff: true });
  }

  /** Ask a worker to run soon; collapses bursts into one job per `seconds` window. Never throws. */
  async nudge(queue: string, seconds = 2) {
    if (process.env.JOBS_DISABLED === 'true') return;
    try {
      await this.boss.send(queue, {}, { singletonKey: `${queue}:nudge`, singletonSeconds: seconds });
    } catch (e) {
      this.log.warn(`nudge ${queue} failed: ${String(e)}`);
    }
  }

  /** Re-score one case's drop-off risk shortly (debounced per case). Never throws. */
  async recomputeRisk(caseId: string, seconds = 3) {
    if (process.env.JOBS_DISABLED === 'true') return;
    try {
      await this.boss.send(Queues.riskRecompute, { caseId }, { singletonKey: `risk:${caseId}`, singletonSeconds: seconds });
    } catch (e) {
      this.log.warn(`risk nudge failed: ${String(e)}`);
    }
  }

  async cancelByKey(queue: string, singletonKey: string) {
    // pg-boss has no cancel-by-key; workers must check the case version before acting (see SlaWorker).
    this.log.debug(`cancel requested for ${queue}/${singletonKey} — handled by version check in worker`);
  }
}
