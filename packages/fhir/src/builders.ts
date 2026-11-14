/**
 * Typed FHIR R4 resource builders. Keep these pure; persistence happens in the client/projector.
 * Mapping rationale lives in docs/architecture.md §FHIR profile mapping (E13.3).
 */
import type {
  AuditEvent,
  Communication,
  DiagnosticReport,
  Observation,
  Provenance,
  Reference,
  ServiceRequest,
  Task,
} from 'fhir/r4.js';
import type { CaseEvent, CaseSnapshot } from '@loopclose/shared';
import { Loinc, ReferralBusinessStatus, Systems } from './systems.js';

export const ref = (type: string, id: string): Reference => ({ reference: `${type}/${id}` });

export function buildFitDiagnosticReport(input: {
  id: string;
  patientId: string;
  issued: string;
  positive: boolean;
  performerOrgId: string;
}): { report: DiagnosticReport; observation: Observation } {
  const obsId = `${input.id}-obs`;
  const observation: Observation = {
    resourceType: 'Observation',
    id: obsId,
    status: 'final',
    code: { coding: [{ system: Systems.loinc, code: Loinc.fitResult, display: 'FIT stool haemoglobin' }] },
    subject: ref('Patient', input.patientId),
    effectiveDateTime: input.issued,
    valueCodeableConcept: {
      coding: [
        input.positive
          ? { system: Systems.snomed, code: '10828004', display: 'Positive' }
          : { system: Systems.snomed, code: '260385009', display: 'Negative' },
      ],
    },
    interpretation: input.positive
      ? [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: 'A', display: 'Abnormal' }] }]
      : [],
  };
  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: input.id,
    identifier: [{ system: Systems.resultId, value: input.id }],
    status: 'final',
    category: [{ coding: [{ system: Systems.diagnosticServiceSection, code: 'LAB' }] }],
    code: { coding: [{ system: Systems.loinc, code: Loinc.fitResult }] },
    subject: ref('Patient', input.patientId),
    issued: input.issued,
    performer: [ref('Organization', input.performerOrgId)],
    result: [ref('Observation', obsId)],
    conclusion: input.positive ? 'FIT positive — actionable result' : 'FIT negative',
  };
  return { report, observation };
}

/** The case itself is a Task whose focus is the triggering DiagnosticReport. */
export function buildCaseTask(snapshot: CaseSnapshot, resultReportId: string, patientId: string): Task {
  return {
    resourceType: 'Task',
    id: snapshot.id,
    identifier: [{ system: Systems.caseId, value: snapshot.id }],
    status: mapCaseStateToTaskStatus(snapshot.state),
    businessStatus: { coding: [{ system: Systems.caseState, code: snapshot.state }] },
    intent: 'order',
    priority: snapshot.tier === 'urgent' ? 'urgent' : snapshot.tier === 'priority' ? 'asap' : 'routine',
    code: { coding: [{ system: Systems.taskCode, code: 'screening-case', display: 'Screening result follow-up case' }] },
    focus: ref('DiagnosticReport', resultReportId),
    for: ref('Patient', patientId),
    authoredOn: snapshot.createdAt,
    lastModified: snapshot.enteredStateAt,
    ...(snapshot.owner ? { owner: ref('PractitionerRole', snapshot.owner.id) } : {}),
    ...(snapshot.slaDeadlineAt ? { restriction: { period: { end: snapshot.slaDeadlineAt } } } : {}),
    extension: [{ url: Systems.programme, valueCode: snapshot.programmeId }],
  };
}

export function mapCaseStateToTaskStatus(state: string): Task['status'] {
  switch (state) {
    case 'result_issued':
      return 'requested';
    case 'closed':
      return 'completed';
    case 'declined_by_patient':
      return 'rejected';
    case 'lost_to_follow_up':
      return 'cancelled';
    default:
      return 'in-progress';
  }
}

/** Referral per 360X/BSeR: ServiceRequest (initiator-owned) + Task (recipient-owned) with focus = ServiceRequest. */
export function buildReferral(input: {
  id: string;
  caseId: string;
  patientId: string;
  requesterRoleId: string;
  recipientOrgId: string;
  reasonText: string;
  authoredOn: string;
  snomedProcedureCode: { code: string; display: string };
}): { serviceRequest: ServiceRequest; task: Task } {
  const serviceRequest: ServiceRequest = {
    resourceType: 'ServiceRequest',
    id: input.id,
    status: 'active',
    intent: 'order',
    priority: 'routine',
    code: { coding: [{ system: Systems.snomed, ...input.snomedProcedureCode }] },
    subject: ref('Patient', input.patientId),
    authoredOn: input.authoredOn,
    requester: ref('PractitionerRole', input.requesterRoleId),
    performer: [ref('Organization', input.recipientOrgId)],
    reasonCode: [{ text: input.reasonText }],
    basedOn: [ref('Task', input.caseId)],
  };
  const task: Task = {
    resourceType: 'Task',
    id: `${input.id}-task`,
    status: 'requested',
    businessStatus: { coding: [{ system: Systems.taskCode, code: ReferralBusinessStatus.offered }] },
    intent: 'order',
    code: { coding: [{ system: Systems.taskCode, code: 'referral' }] },
    focus: ref('ServiceRequest', input.id),
    for: ref('Patient', input.patientId),
    authoredOn: input.authoredOn,
    requester: ref('PractitionerRole', input.requesterRoleId),
    owner: ref('Organization', input.recipientOrgId),
    partOf: [ref('Task', input.caseId)],
  };
  return { serviceRequest, task };
}

export function buildPatientCommunication(input: {
  id: string;
  caseId: string;
  patientId: string;
  sentAt: string;
  channel: string;
  locale: string;
  templateId: string;
  text: string;
  direction: 'outbound' | 'inbound';
}): Communication {
  return {
    resourceType: 'Communication',
    id: input.id,
    status: 'completed',
    category: [{ coding: [{ system: Systems.taskCode, code: 'patient-notification' }] }],
    medium: [{ coding: [{ system: Systems.v3ActCode, code: input.channel === 'phone' ? 'PHONE' : 'ELECTRONIC' }] }],
    subject: ref('Patient', input.patientId),
    partOf: [ref('Task', input.caseId)],
    sent: input.sentAt,
    payload: [{ contentString: input.text }],
    extension: [
      { url: `${Systems.taskCode}/channel`, valueCode: input.channel },
      { url: `${Systems.taskCode}/locale`, valueCode: input.locale },
      { url: `${Systems.taskCode}/template`, valueString: input.templateId },
      { url: `${Systems.taskCode}/direction`, valueCode: input.direction },
    ],
  };
}

/** Every domain event becomes Provenance (what changed, by whom) — the FHIR face of the event log. */
export function buildProvenance(input: { id: string; caseId: string; event: CaseEvent; agentDisplay: string }): Provenance {
  const actorKind = 'actor' in input.event ? input.event.actor.kind : 'system';
  return {
    resourceType: 'Provenance',
    id: input.id,
    target: [ref('Task', input.caseId)],
    recorded: input.event.at,
    activity: { coding: [{ system: Systems.taskCode, code: input.event.type }] },
    agent: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
              code: actorKind === 'ai' ? 'assembler' : actorKind === 'system' ? 'performer' : 'author',
            },
          ],
        },
        who: { display: input.agentDisplay },
      },
    ],
  };
}

export function buildAiAuditEvent(input: {
  id: string;
  feature: 'navigator' | 'summariser' | 'risk' | 'grader';
  model: string;
  promptHash: string;
  caseId: string;
  outcome: 'success' | 'blocked' | 'error';
  recorded: string;
}): AuditEvent {
  return {
    resourceType: 'AuditEvent',
    id: input.id,
    type: { system: Systems.taskCode, code: 'ai-invocation' },
    subtype: [{ system: Systems.taskCode, code: input.feature }],
    action: 'E',
    recorded: input.recorded,
    outcome: input.outcome === 'success' ? '0' : input.outcome === 'blocked' ? '4' : '8',
    agent: [{ who: { display: `ai:${input.feature}:${input.model}` }, requestor: false }],
    source: { observer: { display: 'loopclose-api' } },
    entity: [
      { what: ref('Task', input.caseId) },
      { what: { display: `prompt-sha256:${input.promptHash}` } },
    ],
  };
}
