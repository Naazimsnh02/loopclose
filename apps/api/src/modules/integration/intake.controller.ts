import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Bundle, DiagnosticReport } from 'fhir/r4';
import { Public } from '../auth/jwt-auth.guard';
import { IntakeService } from './intake.service';

/**
 * Inbound endpoints. In production these sit behind mTLS / IP allow-list from the HIE (E12.4).
 *  - POST /fhir/DiagnosticReport : direct push (LIS/EMR) or HAPI Subscription rest-hook payload
 *  - POST /fhir/Bundle           : batch of reports
 *  - POST /hl7v2/oru             : TODO E11.2 ORU^R01 → DiagnosticReport mapper
 */
@ApiTags('integration')
@Controller()
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Public()
  @Post('fhir/DiagnosticReport')
  report(@Body() report: DiagnosticReport) {
    return this.intake.ingestDiagnosticReport(report);
  }

  @Public()
  @Post('fhir/Bundle')
  async bundle(@Body() bundle: Bundle) {
    const reports = (bundle.entry ?? []).map((e) => e.resource).filter((r): r is DiagnosticReport => r?.resourceType === 'DiagnosticReport');
    const results = [];
    for (const r of reports) results.push(await this.intake.ingestDiagnosticReport(r));
    return { processed: results.length, results };
  }
}
