'use client';

import { AlertTriangle, Clock, Bot, User, Cog } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { cn, humanize, slaLabel, slaStatus, fmtDate } from '@/lib/utils';
import type { Tier } from '@/lib/api';

/** Case state → colour family. Terminal states are muted; patient-facing waits are informational. */
const STATE_TONE: Record<string, 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'ai' | 'outline'> = {
  result_issued: 'warn',
  patient_notified: 'info',
  patient_acknowledged: 'info',
  consult_done: 'brand',
  referral_sent: 'brand',
  referral_accepted: 'brand',
  appointment_booked: 'brand',
  confirmatory_done: 'ok',
  treatment_or_surveillance: 'ok',
  closed: 'neutral',
  declined_by_patient: 'outline',
  lost_to_follow_up: 'danger',
};

export const STATE_LABEL: Record<string, string> = {
  result_issued: 'Result issued',
  patient_notified: 'Patient notified',
  patient_acknowledged: 'Acknowledged',
  consult_done: 'Consult done',
  referral_sent: 'Referral sent',
  referral_accepted: 'Referral accepted',
  appointment_booked: 'Appointment booked',
  confirmatory_done: 'Confirmatory done',
  treatment_or_surveillance: 'Treatment / surveillance',
  closed: 'Closed',
  declined_by_patient: 'Declined by patient',
  lost_to_follow_up: 'Lost to follow-up',
};
export const stateLabel = (s: string) => STATE_LABEL[s] ?? humanize(s);

export function StateBadge({ state, className }: { state: string; className?: string }) {
  return (
    <Badge tone={STATE_TONE[state] ?? 'neutral'} dot className={className}>
      {stateLabel(state)}
    </Badge>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  if (tier === 'routine') return <Badge tone="outline">Routine</Badge>;
  if (tier === 'priority') return <Badge tone="warn">Priority</Badge>;
  return (
    <Badge tone="danger">
      <AlertTriangle className="h-3 w-3" /> Urgent
    </Badge>
  );
}

export function SlaChip({ enteredAt, deadline, compact }: { enteredAt: string; deadline: string | null; compact?: boolean }) {
  const status = slaStatus(enteredAt, deadline);
  const { text } = slaLabel(deadline);
  const tone = status === 'breached' ? 'text-danger bg-danger-soft' : status === 'warn' ? 'text-warn bg-warn-soft' : status === 'ok' ? 'text-ok bg-ok-soft' : 'text-ink-muted bg-surface-2';
  const chip = (
    <span className={cn('tabular inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium', tone)}>
      <Clock className="h-3 w-3" />
      {compact ? text.replace(' left', '').replace(' overdue', ' over') : text}
    </span>
  );
  if (!deadline) return chip;
  return <Tooltip content={`${status === 'breached' ? 'Breached' : 'Due'} ${fmtDate(deadline)} · entered ${fmtDate(enteredAt)}`}>{chip}</Tooltip>;
}

export function RiskPill({ tier, score }: { tier: 'green' | 'amber' | 'red' | null; score: number | null }) {
  if (!tier) return <span className="text-[12px] text-ink-faint">—</span>;
  const tone = tier === 'red' ? 'danger' : tier === 'amber' ? 'warn' : 'ok';
  return (
    <Badge tone={tone}>
      Risk {tier}
      {score !== null && <span className="tabular opacity-70">{Math.round(score * 100)}%</span>}
    </Badge>
  );
}

export function ActorIcon({ kind, className }: { kind: 'human' | 'system' | 'ai'; className?: string }) {
  const Icon = kind === 'ai' ? Bot : kind === 'system' ? Cog : User;
  const tone = kind === 'ai' ? 'bg-ai-soft text-ai' : kind === 'system' ? 'bg-surface-2 text-ink-muted' : 'bg-brand-soft text-brand';
  return (
    <span className={cn('grid h-7 w-7 place-items-center rounded-full', tone, className)}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export const LOCALE_LABEL: Record<string, string> = { ar: 'العربية', en: 'English', ur: 'اردو', hi: 'हिन्दी' };
