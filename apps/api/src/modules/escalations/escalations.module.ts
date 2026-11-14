import { Module } from '@nestjs/common';
import { EscalationsController } from './escalations.controller';
import { EscalationsService } from './escalations.service';

/** E3.3 — YAML-driven escalation rules (config/escalation-rules.yaml) → Escalation rows + notifications. */
@Module({
  controllers: [EscalationsController],
  providers: [EscalationsService],
  exports: [EscalationsService],
})
export class EscalationsModule {}
