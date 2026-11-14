import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { DiagnosticReport, Organization, Patient, Practitioner } from 'fhir/r4';
import { buildCaseTask, buildProvenance, FhirClientError } from '@loopclose/fhir';
import type { CaseEvent } from '@loopclose/shared';
import { PrismaService } from '../../common/prisma.service';
import { FhirService } from '../../common/fhir.service';
import { JobsService, Queues } from '../../common/jobs.service';
import { CaseRepository } from '../cases/case.repository';

const BATCH = 50;
const MAX_ATTEMPTS = 10;

/**
 * E2.4 — Outbox drain: projects case events to HAPI FHIR (ADR-001). Runs as a pg-boss worker; the
 * repository nudges it after every commit and a 1-minute cron is the safety net. Each outbox row is
 * handled independently so one bad row never blocks the queue. Idempotent: everything is a PUT with a
 * client-assigned id, so replaying the outbox is safe.
 */
@Injectable()
export class FhirProjector implements OnModuleInit {
  private readonly log = new Logger(FhirProjector.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fhir: FhirService,
    private readonly jobs: JobsService,
    private readonly repo: CaseRepository,
  ) {}

  async onModuleInit() {
    if (!this.jobs.workersEnabled) return;
    await this.jobs.boss.work(Queues.outboxDrain, { batchSize: 1 }, async () => {
      await this.drain();
    });
    await this.jobs.boss.schedule(Queues.outboxDrain, '* * * * *', {}, { singletonKey: 'outbox.cron' });
  }

  /** Processes pending outbox rows oldest-first. Returns how many succeeded. */
  async drain(): Promise<number> {
    const rows = await this.prisma.outbox.findMany({
      where: { processedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    let ok = 0;
    for (const row of rows) {
      try {
        if (row.kind === 'fhir.project_case_event') {
          await this.projectCaseEvent(row.payload as { caseId: string; sequence: number });
        } else {
          this.log.warn(`No handler for outbox kind ${row.kind}; marking processed`);
        }
        await this.prisma.outbox.update({ where: { id: row.id }, data: { processedAt: new Date() } });
        ok += 1;
      } catch (e) {
        const message = e instanceof FhirClientError ? `${e.message} ${JSON.stringify(e.operationOutcome ?? '')}`.slice(0, 2000) : String(e);
        await this.prisma.outbox.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, lastError: message } });
        this.log.warn(`Outbox ${row.id} (${row.kind}) failed attempt ${row.attempts + 1}: ${message}`);
      }
    }
    if (rows.length) this.log.debug(`Outbox drained ${ok}/${rows.length}`);
    return ok;
  }

  private async projectCaseEvent(payload: { caseId: string; sequence: number }) {
    const c = await this.prisma.case.findUniqueOrThrow({
      where: { id: payload.caseId },
      include: { patient: true, result: { include: { performerOrg: true } }, owner: { include: { organization: true } } },
    });
    const ev = await this.prisma.caseEvent.findUniqueOrThrow({
      where: { caseId_sequence: { caseId: payload.caseId, sequence: payload.sequence } },
    });

    // HAPI enforces referential integrity on write, so the reference graph is projected first
    // (Organization → Practitioner, Patient → DiagnosticReport) and every PUT is idempotent.
    await this.fhir.upsert(organizationResource(c.result.performerOrg));
    if (c.owner) {
      await this.fhir.upsert(organizationResource(c.owner.organization));
      await this.fhir.upsert(practitionerResource(c.owner));
    }
    await this.fhir.upsert(patientResource(c.patient));
    const report = reportResource(c.result, c.patient.fhirId);
    await this.fhir.upsert(report);
    if (c.result.fhirReportId !== report.id) {
      await this.prisma.screeningResult.update({ where: { id: c.result.id }, data: { fhirReportId: report.id! } });
    }

    const snapshot = await this.repo.loadSnapshot(c.id);
    const task = buildCaseTask(snapshot, report.id!, c.patient.fhirId);
    if (c.owner) task.owner = { reference: `Practitioner/${c.owner.id}`, display: c.owner.displayName };
    await this.fhir.upsert(task);

    const provenance = buildProvenance({
      id: `${c.id}-${ev.sequence}`,
      caseId: c.id,
      event: ev.payload as unknown as CaseEvent,
      agentDisplay: ev.actorKind === 'system' ? 'LoopClose engine' : `${ev.actorKind}:${ev.actorId}`,
    });
    await this.fhir.upsert(provenance);

    await this.prisma.$transaction([
      this.prisma.case.update({ where: { id: c.id }, data: { fhirTaskId: task.id } }),
      this.prisma.caseEvent.update({ where: { id: ev.id }, data: { fhirProvenanceId: provenance.id } }),
    ]);
  }
}

function organizationResource(o: { id: string; name: string; kind: string }): Organization {
  return {
    resourceType: 'Organization',
    id: o.id,
    name: o.name,
    type: [{ coding: [{ system: 'urn:loopclose:organization-kind', code: o.kind }] }],
  };
}

function practitionerResource(u: { id: string; displayName: string; role: string; email: string }): Practitioner {
  return {
    resourceType: 'Practitioner',
    id: u.id,
    identifier: [{ system: 'urn:loopclose:role', value: u.role }],
    name: [{ text: u.displayName }],
    telecom: [{ system: 'email', value: u.email, use: 'work' }],
  };
}

function patientResource(p: {
  fhirId: string;
  givenName: string;
  familyName: string;
  birthDate: Date;
  sex: string;
  phone: string | null;
  email: string | null;
  preferredLocale: string;
}): Patient {
  const telecom: Patient['telecom'] = [];
  if (p.phone) telecom.push({ system: 'phone', value: p.phone, use: 'mobile' });
  if (p.email) telecom.push({ system: 'email', value: p.email });
  return {
    resourceType: 'Patient',
    id: p.fhirId,
    name: [{ given: [p.givenName], family: p.familyName }],
    birthDate: p.birthDate.toISOString().slice(0, 10),
    gender: p.sex === 'female' || p.sex === 'male' ? p.sex : 'unknown',
    ...(telecom.length ? { telecom } : {}),
    communication: [{ language: { coding: [{ system: 'urn:ietf:bcp:47', code: p.preferredLocale }] }, preferred: true }],
  };
}

function reportResource(
  r: { externalId: string; loincCode: string; valueText: string; issuedAt: Date; performerOrg: { id: string; name: string } },
  patientFhirId: string,
): DiagnosticReport {
  return {
    resourceType: 'DiagnosticReport',
    id: r.externalId.replace(/[^A-Za-z0-9.-]/g, '-').slice(0, 64),
    identifier: [{ system: 'urn:loopclose:result-external-id', value: r.externalId }],
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: r.loincCode }] },
    subject: { reference: `Patient/${patientFhirId}` },
    issued: r.issuedAt.toISOString(),
    performer: [{ reference: `Organization/${r.performerOrg.id}`, display: r.performerOrg.name }],
    conclusion: r.valueText,
  };
}
