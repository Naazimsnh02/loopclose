import { Module } from '@nestjs/common';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';
import { CasesModule } from '../cases/cases.module';
import { FhirProjector } from './fhir-projector.service';

/**
 * E11 — Inbound result intake (FHIR DiagnosticReport via HAPI Subscription rest-hook or direct POST;
 * HL7 v2 ORU^R01 via mapper), adapter interfaces for Malaffi/EMR/LIS/scheduling, outbound notifications.
 */
@Module({
  imports: [CasesModule],
  controllers: [IntakeController],
  providers: [IntakeService, FhirProjector],
  exports: [FhirProjector, IntakeService],
})
export class IntegrationModule {}
