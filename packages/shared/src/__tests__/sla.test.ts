import { describe, expect, it } from 'vitest';
import { addBusinessDays, computeDeadline, slaStatus, warnAtFor } from '../sla.js';
import { ProgrammeSchema } from '../programme.js';
import { loadProgramme } from './fixtures.js';

const calendar = { businessDays: [1, 2, 3, 4, 5], holidays: ['2026-12-02', '2026-12-03'] }; // UAE National Day

describe('addBusinessDays', () => {
  it('skips weekends', () => {
    const fri = new Date('2026-11-06T09:00:00.000Z');
    expect(addBusinessDays(fri, 1, calendar).toISOString()).toBe('2026-11-09T09:00:00.000Z'); // Monday
  });
  it('skips holidays', () => {
    const tue = new Date('2026-12-01T09:00:00.000Z');
    expect(addBusinessDays(tue, 1, calendar).toISOString()).toBe('2026-12-04T09:00:00.000Z');
  });
});

describe('computeDeadline', () => {
  const anchors = { stateEnteredAt: new Date('2026-11-10T08:00:00.000Z'), caseCreatedAt: new Date('2026-11-01T08:00:00.000Z') };
  it('hours and days from state entry', () => {
    expect(computeDeadline({ hours: 4, from: 'state_entered' }, anchors, calendar).toISOString()).toBe('2026-11-10T12:00:00.000Z');
    expect(computeDeadline({ days: 3, from: 'state_entered' }, anchors, calendar).toISOString()).toBe('2026-11-13T08:00:00.000Z');
  });
  it('anchors to case creation when requested', () => {
    expect(computeDeadline({ days: 31, from: 'case_created' }, anchors, calendar).toISOString()).toBe('2026-12-02T08:00:00.000Z');
  });
});

describe('slaStatus', () => {
  const entered = new Date('2026-11-10T00:00:00.000Z');
  const deadline = new Date('2026-11-20T00:00:00.000Z');
  it('warns at 70% of the window', () => {
    expect(warnAtFor(entered, deadline).toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(slaStatus(new Date('2026-11-12T00:00:00.000Z'), entered, deadline)).toBe('on_track');
    expect(slaStatus(new Date('2026-11-17T00:00:00.000Z'), entered, deadline)).toBe('at_risk');
    expect(slaStatus(new Date('2026-11-21T00:00:00.000Z'), entered, deadline)).toBe('breached');
    expect(slaStatus(new Date(), entered, null)).toBe('not_applicable');
  });
});

describe('programme schema validation', () => {
  it('accepts both shipped programmes', () => {
    expect(loadProgramme('colorectal-fit').id).toBe('colorectal-fit');
    expect(loadProgramme('breast-birads').id).toBe('breast-birads');
  });
  it('rejects a programme that lets AI enter a terminal state', () => {
    const p = loadProgramme('colorectal-fit');
    const bad = { ...p, aiPolicy: { ...p.aiPolicy, mayEnterStates: ['closed'] } };
    expect(ProgrammeSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects a non-terminal state without an owner role', () => {
    const p = loadProgramme('colorectal-fit');
    const bad = { ...p, states: p.states.map((s) => (s.id === 'consult_done' ? { ...s, ownerRole: null } : s)) };
    expect(ProgrammeSchema.safeParse(bad).success).toBe(false);
  });
});
