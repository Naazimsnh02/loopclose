import { Module } from '@nestjs/common';
import { TemplateLibrary } from './template-library.service';
import { ChannelRouter } from './channel-router.service';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { AiModule } from '../ai/ai.module';
import { CasesModule } from '../cases/cases.module';
import { EscalationsModule } from '../escalations/escalations.module';
import { PatientNavigator } from './patient-navigator.service';

/**
 * E5.1–E5.3, E5.7 — Template library (4 locales), channel abstraction (web_chat real; whatsapp/sms/email
 * simulated, Twilio optional), consent & preferences enforcement, delivery tracking, non-response detection.
 * Every outbound patient message passes the SafetyGrader (AiModule) before send.
 */
@Module({
  imports: [AiModule, CasesModule, EscalationsModule],
  controllers: [MessagingController],
  providers: [TemplateLibrary, ChannelRouter, MessagingService, PatientNavigator],
  exports: [MessagingService, TemplateLibrary, PatientNavigator, ChannelRouter],
})
export class MessagingModule {}
