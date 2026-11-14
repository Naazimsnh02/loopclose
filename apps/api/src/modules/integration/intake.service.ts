import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { DiagnosticReport } from 'fhir/r4';
import { Loinc } from '@loopclose/fhir';
import { PrismaService } from '../../common/prisma.service';
import { CasesService } from '../cases/cases.service';

/**
 * E11.1 — Turns an inbound DiagnosticReport into a ScreeningResult and, if actionable, a Case.
 * Idempotent on the report identifier. The initial owner is the programme coordinator on duty
 * (TODO E3.4: rota lookup; for now the seeded coordinator).
 */
@Injectable()
export class IntakeService {
  private readonly log = new Logger(IntakeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cases: CasesService,
  ) {}

  async ingestDiagnosticReport(report: DiagnosticReport) {
    const externalId = report.identifier?.[0]?.value ?? report.id;
    if (!externalId) throw new BadRequestException('DiagnosticReport needs an identifier or id');
    const existing = await this.prisma.screeningResult.findUnique({ where: { externalId } });
    if (existing) return { deduplicated: true, resultId: existing.id };

    const patientFhirId = report.subject?.reference?.split('/')[1];
    if (!patientFhirId) throw new BadRequestException('DiagnosticReport.subject must reference a Patient');
    const patient = await this.prisma.patient.findUnique({ where: { fhirId: patientFhirId } });
    if (!patient) throw new BadRequestException(`Unknown patient ${patientFhirId}`);

    const loinc = report.code?.coding?.find((c) => c.system === 'http://loinc.org')?.code ?? 'unknown';
    const { programmeId, actionable, flags, valueText } = classify(loinc, report);

    const result = await this.prisma.screeningResult.create({
      data: {
        externalId,
        programmeId,
        patientId: patient.id,
        performerOrgId: report.performer?.[0]?.reference?.split('/')[1] ?? 'org-lab',
        loincCode: loinc,
        valueText,
        actionable,
        flags,
        issuedAt: report.issued ? new Date(report.issued) : new Date(),
        fhirReportId: report.id ?? null,
        rawSource: report as object,
      },
    });
    if (!actionable) return { deduplicated: false, resultId: result.id, caseId: null };

    const coordinator = await this.prisma.user.findFirstOrThrow({ where: { role: 'coordinator' } });
    const snapshot = await this.cases.openForResult(result.id, { id: coordinator.id, role: 'coordinator', organizationId: coordinator.organizationId });
    this.log.log(`Result ${externalId} → case ${snapshot.id} (${snapshot.tier})`);
    return { deduplicated: false, resultId: result.id, caseId: snapshot.id, tier: snapshot.tier };
  }
}

/** Maps a report to programme + actionability. Extend per programme (E11.1 / E16.2). */
function classify(loinc: string, report: DiagnosticReport): { programmeId: string; actionable: boolean; flags: string[]; valueText: string } {
  const conclusion = (report.conclusion ?? '').toLowerCase();
  const flags = (report.extension ?? []).filter((e) => e.url.endsWith('/flag') && e.valueCode).map((e) => e.valueCode!);
  if (loinc === Loinc.fitResult) {
    const positive = conclusion.includes('positive');
    return { programmeId: 'colorectal-fit', actionable: positive, flags, valueText: positive ? 'FIT positive' : 'FIT negative' };
  }
  if (loinc === Loinc.mammogramBirads) {
    const m = conclusion.match(/bi-?rads\s*([0-6][abc]?)/i);
    const cat = m?.[1]?.toLowerCase() ?? '';
    const actionable = cat.startsWith('4') || cat.startsWith('5');
    if (cat.startsWith('5')) flags.push('birads_5');
    if (cat === '4c') flags.push('birads_4c');
    return { programmeId: 'breast-birads', actionable, flags, valueText: `BI-RADS ${cat || '?'}` };
  }
  return { programmeId: 'unknown', actionable: false, flags, valueText: report.conclusion ?? '' };
}
