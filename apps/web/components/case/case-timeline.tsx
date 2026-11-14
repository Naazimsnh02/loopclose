'use client';

import type { CaseEvent } from '@/lib/api';
import { fmtDate, humanize } from '@/lib/utils';
import { ActorIcon, stateLabel } from '@/components/domain';
import { roleLabel } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';

function describe(ev: CaseEvent): { title: string; detail?: string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = ev.payload as Record<string, any>;
  switch (ev.type) {
    case 'case.transitioned':
      return { title: `${stateLabel(String(p.from))} → ${stateLabel(String(p.to))}`, detail: p.reason ? String(p.reason) : undefined };
    case 'case.owner_assigned':
      return { title: `Owner assigned (${roleLabel(p.owner?.role)})`, detail: p.previous ? `Previously ${roleLabel(p.previous.role)}` : 'First owner' };
    case 'case.outreach_recorded':
      return { title: `Outreach via ${humanize(String(p.attempt?.channel ?? ''))}`, detail: humanize(String(p.attempt?.outcome ?? '')) };
    case 'case.evidence_attached':
      return { title: `Evidence: ${humanize(String(p.evidence?.type ?? ''))}`, detail: p.evidence?.reference };
    case 'case.closed':
      return { title: 'Loop closed', detail: p.humanDecision ? `Human decision: ${p.humanDecision.reason}` : `${p.evidenceCount} evidence item(s)` };
    case 'case.exited':
      return { title: `Exited: ${stateLabel(String(p.kind))}`, detail: p.justification };
    case 'sla.scheduled':
      return { title: `SLA clock set for ${stateLabel(String(p.state))}`, detail: `Due ${fmtDate(String(p.deadlineAt))}` };
    case 'appointment.no_show':
      return { title: `No-show recorded (#${p.count})` };
    case 'referral.declined':
      return { title: `Referral declined (#${p.count})` };
    default:
      return { title: humanize(ev.type.replace(/\./g, ' ')) };
  }
}

export function CaseTimeline({ events, loading }: { events: CaseEvent[] | undefined; loading: boolean }) {
  if (loading)
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex-1 space-y-1.5 pt-1">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  const list = [...(events ?? [])].sort((a, b) => b.sequence - a.sequence);
  if (!list.length) return <p className="text-[13px] text-ink-muted">No events yet.</p>;
  return (
    <ol className="relative space-y-0">
      {list.map((ev, i) => {
        const d = describe(ev);
        const quiet = ev.type === 'sla.scheduled';
        return (
          <li key={ev.id} className="relative flex gap-3 pb-5 last:pb-0 animate-in-up" style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
            {i < list.length - 1 && <span className="absolute start-[13px] top-7 bottom-0 w-px bg-line" aria-hidden />}
            <ActorIcon kind={ev.actorKind} className={quiet ? 'opacity-60' : ''} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className={`text-[13.5px] ${quiet ? 'text-ink-muted' : 'font-medium text-ink'}`}>{d.title}</div>
              {d.detail && <div className="mt-0.5 text-[12.5px] text-ink-2">{d.detail}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-faint">
                <span className="tabular">{fmtDate(ev.occurredAt)}</span>
                <span>·</span>
                <span>{ev.actorKind === 'human' ? roleLabel(ev.actorRole) : ev.actorKind === 'ai' ? 'AI (proposal)' : 'System'}</span>
                {ev.fhirProvenanceId && (
                  <>
                    <span>·</span>
                    <span title={`Provenance/${ev.fhirProvenanceId}`}>FHIR Provenance ✓</span>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
