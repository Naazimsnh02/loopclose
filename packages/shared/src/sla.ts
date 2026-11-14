import type { ProgrammeDefinition, SlaWindow, StateDefinition } from './programme.js';
import type { UrgencyTier } from './types.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isBusinessDay(d: Date, calendar: ProgrammeDefinition['calendar']): boolean {
  return calendar.businessDays.includes(d.getUTCDay()) && !calendar.holidays.includes(toDateKey(d));
}

/** Adds N business days, skipping non-business days and holidays. Preserves time-of-day. */
export function addBusinessDays(start: Date, n: number, calendar: ProgrammeDefinition['calendar']): Date {
  const d = new Date(start.getTime());
  let remaining = n;
  while (remaining > 0) {
    d.setTime(d.getTime() + DAY_MS);
    if (isBusinessDay(d, calendar)) remaining -= 1;
  }
  return d;
}

export function computeDeadline(
  window: SlaWindow,
  anchors: { stateEnteredAt: Date; caseCreatedAt: Date },
  calendar: ProgrammeDefinition['calendar'],
): Date {
  const start = window.from === 'case_created' ? anchors.caseCreatedAt : anchors.stateEnteredAt;
  if (window.hours !== undefined) return new Date(start.getTime() + window.hours * HOUR_MS);
  if (window.days !== undefined) return new Date(start.getTime() + window.days * DAY_MS);
  if (window.businessDays !== undefined) return addBusinessDays(start, window.businessDays, calendar);
  /* istanbul ignore next -- schema guarantees one field is set */
  throw new Error('Invalid SLA window');
}

export function deadlineForState(
  programme: ProgrammeDefinition,
  state: StateDefinition,
  tier: UrgencyTier,
  anchors: { stateEnteredAt: Date; caseCreatedAt: Date },
): Date | null {
  if (!state.sla) return null;
  return computeDeadline(state.sla[tier], anchors, programme.calendar);
}

/** Warning threshold (amber) as a fraction of the SLA window elapsed. */
export const SLA_WARN_FRACTION = 0.7;

export function warnAtFor(stateEnteredAt: Date, deadlineAt: Date, fraction = SLA_WARN_FRACTION): Date {
  const span = deadlineAt.getTime() - stateEnteredAt.getTime();
  return new Date(stateEnteredAt.getTime() + Math.floor(span * fraction));
}

export type SlaStatus = 'on_track' | 'at_risk' | 'breached' | 'not_applicable';

export function slaStatus(now: Date, stateEnteredAt: Date, deadlineAt: Date | null): SlaStatus {
  if (!deadlineAt) return 'not_applicable';
  if (now.getTime() > deadlineAt.getTime()) return 'breached';
  if (now.getTime() >= warnAtFor(stateEnteredAt, deadlineAt).getTime()) return 'at_risk';
  return 'on_track';
}
