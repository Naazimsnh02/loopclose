import { describe, expect, it } from 'vitest';
import type { CaseSnapshot } from '@loopclose/shared';
import { buildCaseTask, buildFitDiagnosticReport, buildReferral, mapCaseStateToTaskStatus } from './builders.js';

const snapshot: CaseSnapshot = {
  id: 'case-1',
  programmeId: 'colorectal-fit',
  state: 'referral_sent',
  tier: 'urgent',
  owner: { id: 'pr-1', role: 'specialist' },
  version: 5,
  createdAt: '2026-11-02T08:00:00.000Z',
  enteredStateAt: '2026-11-05T08:00:00.000Z',
  slaDeadlineAt: '2026-11-06T08:00:00.000Z',
  evidence: [],
  outreachAttempts: [],
  noShowCount: 0,
  referralDeclineCount: 0,
};

describe('builders', () => {
  it('FIT report links its observation and flags abnormal', () => {
    const { report, observation } = buildFitDiagnosticReport({ id: 'r1', patientId: 'p1', issued: '2026-11-02T07:00:00Z', positive: true, performerOrgId: 'lab' });
    expect(report.result?.[0]?.reference).toBe('Observation/r1-obs');
    expect(observation.interpretation?.[0]?.coding?.[0]?.code).toBe('A');
  });

  it('case Task carries state, priority, owner and SLA restriction', () => {
    const task = buildCaseTask(snapshot, 'r1', 'p1');
    expect(task.status).toBe('in-progress');
    expect(task.priority).toBe('urgent');
    expect(task.owner?.reference).toBe('PractitionerRole/pr-1');
    expect(task.restriction?.period?.end).toBe(snapshot.slaDeadlineAt);
    expect(task.businessStatus?.coding?.[0]?.code).toBe('referral_sent');
  });

  it('terminal states map to FHIR Task statuses', () => {
    expect(mapCaseStateToTaskStatus('closed')).toBe('completed');
    expect(mapCaseStateToTaskStatus('declined_by_patient')).toBe('rejected');
    expect(mapCaseStateToTaskStatus('lost_to_follow_up')).toBe('cancelled');
  });

  it('referral = ServiceRequest + Task with focus on the request (360X/BSeR)', () => {
    const { serviceRequest, task } = buildReferral({
      id: 'ref-1', caseId: 'case-1', patientId: 'p1', requesterRoleId: 'pr-phc', recipientOrgId: 'org-gi',
      reasonText: 'Positive FIT', authoredOn: '2026-11-05T08:00:00Z', snomedProcedureCode: { code: '73761001', display: 'Colonoscopy' },
    });
    expect(task.focus?.reference).toBe('ServiceRequest/ref-1');
    expect(task.partOf?.[0]?.reference).toBe('Task/case-1');
    expect(serviceRequest.basedOn?.[0]?.reference).toBe('Task/case-1');
  });
});
