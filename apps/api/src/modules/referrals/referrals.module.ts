import { Module } from '@nestjs/common';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';
import { CasesModule } from '../cases/cases.module';
import { EscalationsModule } from '../escalations/escalations.module';

/** E4.1–E4.2 — Referral lifecycle per 360X/BSeR + continuity packet. */
@Module({
  imports: [CasesModule, EscalationsModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
