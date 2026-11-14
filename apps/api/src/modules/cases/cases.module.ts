import { Module } from '@nestjs/common';
import { CasesController } from './cases.controller';
import { ProgrammesController } from './programmes.controller';
import { CasesService } from './cases.service';
import { CaseRepository } from './case.repository';
import { SlaScheduler } from '../sla/sla.scheduler';

@Module({
  controllers: [CasesController, ProgrammesController],
  // SlaScheduler lives here (not in SlaModule) so the case engine can arm timers without a circular import.
  providers: [CasesService, CaseRepository, SlaScheduler],
  exports: [CasesService, CaseRepository, SlaScheduler],
})
export class CasesModule {}
