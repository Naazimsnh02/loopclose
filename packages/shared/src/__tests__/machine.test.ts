import { describe, expect, it } from 'vitest';
import { applyCommand, createCase, resolveTier } from '../machine.js';
import type { CaseSnapshot, Result, ApplyOutcome } from '../types.js';
import {
  T0,
  aiNavigator,
  coordinator,
  humanCoordinator,
  humanPhc,
  humanSpecialist,
  loadProgramme,
  phc,
  scheduler,
  specialist,
  systemActor,
  treating,
} from './fixtures.js';

const programme = loadProgramme('colorectal-fit');

function unwrap(r: Result<ApplyOutcome>): ApplyOutcome {
  if (!r.ok) throw r.error;
  return r.value;
}
function expectError(r: Result<ApplyOutcome>, code: string) {
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe(code);
}

function newCase(tier: 'routine' | 'priority' | 'urgent' = 'routine'): CaseSnapshot {
  return unwrap(createCase({ id: 'c1', programme, tier, owner: coordinator, now: T0 })).snapshot;
}

/** Drive a case along the happy path up to (and including) the given state. */
function driveTo(state: string, tier: 'routine' | 'priority' | 'urgent' = 'routine'): CaseSnapshot {
  let s = newCase(tier);
  const steps: Array<[string, Parameters<typeof applyCommand>[1]]> = [
    ['patient_notified', { type: 'transition', to: 'patient_notified', actor: systemActor }],
    ['patient_acknowledged', { type: 'transition', to: 'patient_acknowledged', actor: humanCoordinator, owner: phc }],
    ['consult_done', { type: 'transition', to: 'consult_done', actor: humanPhc }],
    ['referral_sent', { type: 'transition', to: 'referral_sent', actor: humanPhc, owner: specialist }],
    ['referral_accepted', { type: 'transition', to: 'referral_accepted', actor: humanSpecialist, owner: scheduler }],
    ['appointment_booked', { type: 'transition', to: 'appointment_booked', actor: humanSpecialist, owner: specialist }],
    ['confirmatory_done', { type: 'transition', to: 'confirmatory_done', actor: humanSpecialist }],
    ['treatment_or_surveillance', { type: 'transition', to: 'treatment_or_surveillance', actor: humanSpecialist, owner: treating }],
  ];
  for (const [target, cmd] of steps) {
    s = unwrap(applyCommand(s, cmd, programme, T0)).snapshot;
    if (target === state) return s;
  }
  return s;
}

describe('createCase', () => {
  it('starts in the initial state with an owner and an SLA deadline', () => {
    const { snapshot, events } = unwrap(createCase({ id: 'c1', programme, tier: 'routine', owner: coordinator, now: T0 }));
    expect(snapshot.state).toBe('result_issued');
    expect(snapshot.owner).toEqual(coordinator);
    expect(snapshot.version).toBe(1);
    expect(snapshot.slaDeadlineAt).toBe('2026-11-04T08:00:00.000Z'); // 2 business days
    expect(events.map((e) => e.type)).toEqual(['case.owner_assigned', 'sla.scheduled']);
  });

  it('rejects an initial owner with the wrong role', () => {
    expectError(createCase({ id: 'c1', programme, tier: 'routine', owner: phc, now: T0 }), 'OWNER_ROLE_MISMATCH');
  });

  it('urgent tier uses hour-based SLA', () => {
    const { snapshot } = unwrap(createCase({ id: 'c1', programme, tier: 'urgent', owner: coordinator, now: T0 }));
    expect(snapshot.slaDeadlineAt).toBe('2026-11-02T12:00:00.000Z');
  });
});

describe('happy path', () => {
  it('walks every state to treatment_or_surveillance and closes with evidence', () => {
    const s = driveTo('treatment_or_surveillance');
    expect(s.state).toBe('treatment_or_surveillance');
    expect(s.owner).toEqual(treating);
    const closed = unwrap(
      applyCommand(
        s,
        {
          type: 'close',
          actor: humanSpecialist,
          evidence: [{ type: 'colonoscopy_report', reference: 'DiagnosticReport/123', recordedBy: humanSpecialist, recordedAt: T0.toISOString() }],
        },
        programme,
        T0,
      ),
    );
    expect(closed.snapshot.state).toBe('closed');
    expect(closed.snapshot.owner).toBeNull();
    expect(closed.snapshot.slaDeadlineAt).toBeNull();
    expect(closed.events.map((e) => e.type)).toEqual(['case.evidence_attached', 'case.transitioned', 'case.closed']);
  });

  it('31-day colonoscopy SLA is anchored to case creation, not state entry', () => {
    const later = new Date('2026-11-20T08:00:00.000Z');
    let s = driveTo('referral_accepted');
    s = unwrap(
      applyCommand(s, { type: 'transition', to: 'appointment_booked', actor: humanSpecialist, owner: specialist }, programme, later),
    ).snapshot;
    expect(s.slaDeadlineAt).toBe('2026-12-03T08:00:00.000Z'); // T0 + 31 days
  });

  it('increments version on every applied command', () => {
    const s = driveTo('consult_done');
    expect(s.version).toBe(4);
  });
});

describe('transition graph', () => {
  it('rejects transitions not in the programme graph', () => {
    expectError(applyCommand(newCase(), { type: 'transition', to: 'referral_sent', actor: humanCoordinator }, programme, T0), 'INVALID_TRANSITION');
  });

  it('rejects unknown target states', () => {
    expectError(applyCommand(newCase(), { type: 'transition', to: 'nope', actor: humanCoordinator }, programme, T0), 'UNKNOWN_STATE');
  });

  it('rejects reaching terminal states via plain transition', () => {
    const s = driveTo('treatment_or_surveillance');
    expectError(applyCommand(s, { type: 'transition', to: 'closed', actor: humanSpecialist }, programme, T0), 'INVALID_TRANSITION');
  });

  it('rejects any command on a terminal case', () => {
    const s = driveTo('treatment_or_surveillance');
    const closed = unwrap(
      applyCommand(s, { type: 'close', actor: humanSpecialist, humanDecision: { actor: humanSpecialist, reason: 'Benign; surveillance ordered', decidedAt: T0.toISOString() } }, programme, T0),
    ).snapshot;
    expectError(applyCommand(closed, { type: 'transition', to: 'closed', actor: humanSpecialist }, programme, T0), 'TERMINAL_STATE');
    expectError(applyCommand(closed, { type: 'assign_owner', owner: treating, actor: humanSpecialist }, programme, T0), 'TERMINAL_STATE');
  });
});

describe('ownership invariant', () => {
  it('requires a new owner when the target state has a different owner role', () => {
    let s = newCase();
    s = unwrap(applyCommand(s, { type: 'transition', to: 'patient_notified', actor: systemActor }, programme, T0)).snapshot;
    expectError(applyCommand(s, { type: 'transition', to: 'patient_acknowledged', actor: humanCoordinator }, programme, T0), 'OWNER_REQUIRED');
  });

  it('rejects an owner whose role does not match the target state', () => {
    let s = newCase();
    s = unwrap(applyCommand(s, { type: 'transition', to: 'patient_notified', actor: systemActor }, programme, T0)).snapshot;
    expectError(
      applyCommand(s, { type: 'transition', to: 'patient_acknowledged', actor: humanCoordinator, owner: specialist }, programme, T0),
      'OWNER_ROLE_MISMATCH',
    );
  });

  it('carries the owner over when the role is unchanged', () => {
    const s = driveTo('patient_notified');
    expect(s.owner).toEqual(coordinator);
  });

  it('assign_owner enforces role match and emits an event', () => {
    const s = newCase();
    const other = { id: 'u-coord-2', role: 'coordinator' };
    const out = unwrap(applyCommand(s, { type: 'assign_owner', owner: other, actor: humanCoordinator }, programme, T0));
    expect(out.snapshot.owner).toEqual(other);
    expect(out.events[0]).toMatchObject({ type: 'case.owner_assigned', previous: coordinator });
    expectError(applyCommand(s, { type: 'assign_owner', owner: phc, actor: humanCoordinator }, programme, T0), 'OWNER_ROLE_MISMATCH');
  });
});

describe('AI boundaries', () => {
  it('AI may enter patient_acknowledged (teach-back pass) but only with an owner already in place', () => {
    const s = driveTo('patient_notified');
    // AI cannot assign the PHC owner, so without a pre-assigned owner it must fail safely.
    expectError(applyCommand(s, { type: 'transition', to: 'patient_acknowledged', actor: aiNavigator }, programme, T0), 'OWNER_REQUIRED');
    expectError(applyCommand(s, { type: 'transition', to: 'patient_acknowledged', actor: aiNavigator, owner: phc }, programme, T0), 'AI_FORBIDDEN');
  });

  it('AI may not enter states outside aiPolicy.mayEnterStates', () => {
    const s = newCase();
    expectError(applyCommand(s, { type: 'transition', to: 'patient_notified', actor: aiNavigator }, programme, T0), 'AI_FORBIDDEN');
  });

  it('AI can never assign owners', () => {
    expectError(applyCommand(newCase(), { type: 'assign_owner', owner: coordinator, actor: aiNavigator }, programme, T0), 'AI_FORBIDDEN');
  });

  it('AI and system actors can never close or exit', () => {
    const s = driveTo('treatment_or_surveillance');
    const ev = [{ type: 'care_plan', reference: 'CarePlan/1', recordedBy: humanSpecialist, recordedAt: T0.toISOString() }];
    expectError(applyCommand(s, { type: 'close', actor: aiNavigator, evidence: ev }, programme, T0), 'AI_FORBIDDEN');
    expectError(applyCommand(s, { type: 'close', actor: systemActor, evidence: ev }, programme, T0), 'AI_FORBIDDEN');
    const n = driveTo('patient_notified');
    expectError(applyCommand(n, { type: 'exit', kind: 'declined_by_patient', actor: aiNavigator, justification: 'x' }, programme, T0), 'AI_FORBIDDEN');
  });
});

describe('closure invariant', () => {
  it('refuses closure without evidence or human decision', () => {
    const s = driveTo('treatment_or_surveillance');
    expectError(applyCommand(s, { type: 'close', actor: humanSpecialist }, programme, T0), 'CLOSURE_EVIDENCE_REQUIRED');
    expectError(
      applyCommand(s, { type: 'close', actor: humanSpecialist, humanDecision: { actor: humanSpecialist, reason: '   ', decidedAt: T0.toISOString() } }, programme, T0),
      'CLOSURE_EVIDENCE_REQUIRED',
    );
  });

  it('accepts a documented human decision as closure basis', () => {
    const s = driveTo('confirmatory_done');
    const out = unwrap(
      applyCommand(s, { type: 'close', actor: humanSpecialist, humanDecision: { actor: humanSpecialist, reason: 'Normal colonoscopy, return to routine screening', decidedAt: T0.toISOString() } }, programme, T0),
    );
    expect(out.snapshot.state).toBe('closed');
    expect(out.events.at(-1)).toMatchObject({ type: 'case.closed', evidenceCount: 0 });
  });

  it('rejects closure from disallowed states and invalid evidence types', () => {
    const early = driveTo('referral_sent');
    expectError(
      applyCommand(early, { type: 'close', actor: humanSpecialist, evidence: [{ type: 'care_plan', reference: 'x', recordedBy: humanSpecialist, recordedAt: T0.toISOString() }] }, programme, T0),
      'CLOSURE_NOT_ALLOWED_FROM_STATE',
    );
    const late = driveTo('treatment_or_surveillance');
    expectError(
      applyCommand(late, { type: 'close', actor: humanSpecialist, evidence: [{ type: 'selfie', reference: 'x', recordedBy: humanSpecialist, recordedAt: T0.toISOString() }] }, programme, T0),
      'CLOSURE_EVIDENCE_TYPE_INVALID',
    );
  });

  it('evidence attached earlier satisfies closure later', () => {
    let s = driveTo('confirmatory_done');
    s = unwrap(
      applyCommand(s, { type: 'attach_evidence', evidence: { type: 'histology_report', reference: 'DiagnosticReport/h1', recordedBy: humanSpecialist, recordedAt: T0.toISOString() }, actor: humanSpecialist }, programme, T0),
    ).snapshot;
    const out = unwrap(applyCommand(s, { type: 'close', actor: humanSpecialist }, programme, T0));
    expect(out.snapshot.evidence).toHaveLength(1);
  });
});

describe('loops: no-show and referral redirect', () => {
  it('no-show rebook increments counter and resets state SLA while keeping case-anchored deadline', () => {
    const s = driveTo('appointment_booked');
    const out = unwrap(
      applyCommand(s, { type: 'transition', to: 'appointment_booked', actor: humanSpecialist, loopReason: 'no_show' }, programme, T0),
    );
    expect(out.snapshot.noShowCount).toBe(1);
    expect(out.events.map((e) => e.type)).toContain('appointment.no_show');
  });

  it('referral decline → redirect to another specialist increments decline counter', () => {
    const s = driveTo('referral_sent');
    const other = { id: 'u-gi-2', role: 'specialist', organizationId: 'org-hosp-2' };
    const out = unwrap(
      applyCommand(s, { type: 'transition', to: 'referral_sent', actor: humanCoordinator, owner: other, loopReason: 'referral_declined', reason: 'Wrong site' }, programme, T0),
    );
    expect(out.snapshot.referralDeclineCount).toBe(1);
    expect(out.snapshot.owner).toEqual(other);
    expect(out.events.map((e) => e.type)).toEqual(expect.arrayContaining(['referral.declined', 'case.owner_assigned']));
  });

  it('self-loop without loopReason is rejected', () => {
    const s = driveTo('appointment_booked');
    expectError(applyCommand(s, { type: 'transition', to: 'appointment_booked', actor: humanSpecialist }, programme, T0), 'INVALID_TRANSITION');
  });
});

describe('exits', () => {
  it('declined_by_patient requires justification and allowed state', () => {
    const s = driveTo('consult_done');
    expectError(applyCommand(s, { type: 'exit', kind: 'declined_by_patient', actor: humanPhc, justification: ' ' }, programme, T0), 'EXIT_JUSTIFICATION_REQUIRED');
    const out = unwrap(applyCommand(s, { type: 'exit', kind: 'declined_by_patient', actor: humanPhc, justification: 'Informed refusal documented' }, programme, T0));
    expect(out.snapshot.state).toBe('declined_by_patient');
    expect(out.snapshot.owner).toBeNull();
    expectError(applyCommand(newCase(), { type: 'exit', kind: 'declined_by_patient', actor: humanCoordinator, justification: 'x' }, programme, T0), 'EXIT_NOT_ALLOWED_FROM_STATE');
  });

  it('lost_to_follow_up requires the outreach protocol to be exhausted', () => {
    let s = driveTo('patient_notified');
    expectError(applyCommand(s, { type: 'exit', kind: 'lost_to_follow_up', actor: humanCoordinator, justification: 'x' }, programme, T0), 'EXIT_OUTREACH_PROTOCOL_NOT_EXHAUSTED');
    const at = T0.toISOString();
    for (const attempt of [
      { channel: 'whatsapp', at, outcome: 'no_response' },
      { channel: 'sms', at, outcome: 'no_response' },
      { channel: 'whatsapp', at, outcome: 'no_response' },
    ] as const) {
      s = unwrap(applyCommand(s, { type: 'record_outreach', attempt, actor: systemActor }, programme, T0)).snapshot;
    }
    // 3 attempts, 2 channels, but no phone attempt yet
    expectError(applyCommand(s, { type: 'exit', kind: 'lost_to_follow_up', actor: humanCoordinator, justification: 'x' }, programme, T0), 'EXIT_OUTREACH_PROTOCOL_NOT_EXHAUSTED');
    s = unwrap(applyCommand(s, { type: 'record_outreach', attempt: { channel: 'phone', at, outcome: 'no_response' }, actor: humanCoordinator }, programme, T0)).snapshot;
    const out = unwrap(applyCommand(s, { type: 'exit', kind: 'lost_to_follow_up', actor: humanCoordinator, justification: 'Protocol exhausted' }, programme, T0));
    expect(out.snapshot.state).toBe('lost_to_follow_up');
  });
});

describe('resolveTier', () => {
  it('picks the highest matching tier', () => {
    expect(resolveTier(programme, { flags: [], age: 55 })).toBe('routine');
    expect(resolveTier(programme, { flags: [], age: 72 })).toBe('priority');
    expect(resolveTier(programme, { flags: ['anaemia'], age: 72 })).toBe('priority');
    expect(resolveTier(programme, { flags: ['alarm_symptoms'], age: 40 })).toBe('urgent');
  });
});

describe('breast programme (config-only generality)', () => {
  const breast = loadProgramme('breast-birads');
  it('loads and runs the same engine with different states/owners', () => {
    expect(resolveTier(breast, { flags: ['birads_5'] })).toBe('urgent');
    const { snapshot } = unwrap(createCase({ id: 'b1', programme: breast, tier: 'urgent', owner: coordinator, now: T0 }));
    expect(snapshot.slaDeadlineAt).toBe('2026-11-02T10:00:00.000Z'); // 2 hours
    const notified = unwrap(applyCommand(snapshot, { type: 'transition', to: 'patient_notified', actor: systemActor }, breast, T0)).snapshot;
    const radiologist = { id: 'u-rad', role: 'breast_radiologist' };
    const ack = unwrap(applyCommand(notified, { type: 'transition', to: 'patient_acknowledged', actor: humanCoordinator, owner: radiologist }, breast, T0)).snapshot;
    expect(ack.owner).toEqual(radiologist);
  });
});
