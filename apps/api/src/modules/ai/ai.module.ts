import { Module } from '@nestjs/common';
import { LlmClient } from './llm.client';
import { AiFeatureFlags } from './feature-flags.service';
import { SafetyGrader } from './grader/safety-grader.service';
import { NavigatorService } from './navigator/navigator.service';
import { SummariserService } from './summariser/summariser.service';
import { RiskService } from './risk/risk.service';
import { RiskWorker } from './risk/risk.worker';
import { ProposalsService } from './proposals.service';
import { AiController } from './ai.controller';
import { CasesModule } from '../cases/cases.module';
import { EscalationsModule } from '../escalations/escalations.module';

/**
 * Bounded AI services (ADR-006). Everything here *proposes*; humans decide. Each call is audited
 * (prompt hash, model, tokens, outcome) and each feature has a kill-switch.
 *  - SafetyGrader  (E5.6): pre-send policy check on every patient message. Rules first, LLM second.
 *  - Navigator     (E5.4–5.5): template-bound explanation, teach-back, booking assist, escalation.
 *  - Summariser    (E6.1): hand-off Composition draft with claim→source trace.
 *  - Risk          (E6.2–6.5): interpretable drop-off risk from JSON coefficients trained in analytics/.
 */
@Module({
  imports: [CasesModule, EscalationsModule],
  controllers: [AiController],
  providers: [LlmClient, AiFeatureFlags, SafetyGrader, NavigatorService, SummariserService, RiskService, RiskWorker, ProposalsService],
  exports: [LlmClient, SafetyGrader, NavigatorService, SummariserService, RiskService, RiskWorker, AiFeatureFlags],
})
export class AiModule {}
