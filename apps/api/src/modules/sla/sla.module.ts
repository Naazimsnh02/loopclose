import { Module } from '@nestjs/common';
import { SlaWorker } from './sla.worker';
import { CasesModule } from '../cases/cases.module';
import { EscalationsModule } from '../escalations/escalations.module';

/**
 * E3.2 — Durable SLA timers. On every `sla.scheduled` event: enqueue `sla.warn` (70%) and
 * `sla.breach` (100%) jobs keyed by case+version. Workers re-check the case version so a
 * timer from a superseded state is a no-op. Killing the API mid-timer must not lose a breach.
 */
@Module({
  imports: [CasesModule, EscalationsModule],
  providers: [SlaWorker],
})
export class SlaModule {}
