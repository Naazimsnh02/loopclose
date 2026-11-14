'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight, CheckCheck, Siren, TimerReset, Users } from 'lucide-react';
import { Cases, Escalations, Metrics, Programmes, type Escalation } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { roleLabel } from '@/lib/auth';
import { cn, humanize, relative } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toaster';
import { StateBadge, TierBadge, stateLabel } from '@/components/domain';

const STAGE_ORDER = ['issued', 'notified', 'acknowledged', 'consulted', 'referred', 'referral_accepted', 'appointment', 'confirmatory', 'treatment', 'closed', 'exited'];
const RULE_LABEL: Record<string, string> = { 'sla-breach': 'SLA breached', 'sla-warn': 'SLA at risk', stalled: 'Case stalled', 'owner-offer-timeout': 'Owner did not accept', 'referral-declined': 'Referral declined', 'no-show': 'Patient no-show' };
const ruleLabel = (r: string) => RULE_LABEL[r] ?? humanize(r.replace(/-/g, ' '));

/** E8 — Programme dashboard: open-loop funnel, ageing, SLA pressure and the human escalation queue. */
export default function Dashboard() {
  const summary = useQuery('dash:summary', () => Cases.summary(), { pollMs: 30_000 });
  const funnel = useQuery('dash:funnel', () => Metrics.funnel(), { pollMs: 60_000 });
  const ageing = useQuery('dash:ageing', Metrics.ageing, { pollMs: 60_000 });
  const programmes = useQuery('programmes', Programmes.list);
  const escalations = useQuery('dash:escalations', () => Escalations.list({ status: 'open' }), { pollMs: 20_000 });

  const open = summary.data?.all ?? 0;
  const overdue = summary.data?.overdue ?? 0;
  const pct = (n: number) => (open ? Math.round((n / open) * 100) : 0);

  // Order the funnel by clinical stage (from the programme definitions) so it reads like the pathway.
  const order = React.useMemo(() => {
    const stageOf = new Map<string, number>();
    for (const p of programmes.data ?? []) for (const s of p.states) stageOf.set(s.id, STAGE_ORDER.indexOf(s.stage));
    return [...stageOf.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
  }, [programmes.data]);
  const funnelRows = React.useMemo(() => {
    const byState = new Map((funnel.data ?? []).map((r) => [r.state, r.count]));
    const states = order.length ? order : [...byState.keys()];
    return states.filter((s) => !['closed', 'declined_by_patient', 'lost_to_follow_up'].includes(s)).map((s) => ({ state: s, count: byState.get(s) ?? 0 }));
  }, [funnel.data, order]);
  const funnelMax = Math.max(1, ...funnelRows.map((r) => r.count));
  const terminal = (funnel.data ?? []).filter((r) => ['closed', 'declined_by_patient', 'lost_to_follow_up'].includes(r.state));

  return (
    <section className="animate-fade">
      <PageHeader title="Programme dashboard" description="Where every open loop sits right now, how old it is, and who needs to act." />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open loops" value={summary.data ? String(open) : undefined} hint="actionable results not yet closed" icon={Users} />
        <Kpi label="Past SLA" value={summary.data ? String(overdue) : undefined} hint={summary.data ? `${pct(overdue)}% of open loops` : undefined} icon={TimerReset} tone={overdue > 0 ? 'danger' : 'ok'} />
        <Kpi label="Unassigned" value={summary.data ? String(summary.data.unassigned) : undefined} hint="ownership must never be null" icon={AlertTriangle} tone={(summary.data?.unassigned ?? 0) > 0 ? 'warn' : 'ok'} />
        <Kpi label="Open escalations" value={escalations.data ? String(escalations.data.length) : undefined} hint="waiting for a human decision" icon={Siren} tone={(escalations.data?.length ?? 0) > 0 ? 'danger' : 'ok'} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Open loops by pathway step" description="Counts of open cases in each state, in pathway order" />
            <CardBody>
              {funnel.loading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <ul className="space-y-2.5">
                  {funnelRows.map((r, i) => (
                    <li key={r.state} className="grid grid-cols-[180px_minmax(0,1fr)_40px] items-center gap-3 text-[13px] animate-in-up" style={{ animationDelay: `${i * 25}ms` }}>
                      <span className="truncate text-ink-2">{stateLabel(r.state)}</span>
                      <div className="h-6 w-full overflow-hidden rounded-md bg-surface-2">
                        <div className="h-full rounded-md bg-brand/80 transition-[width] duration-700" style={{ width: `${(r.count / funnelMax) * 100}%` }} />
                      </div>
                      <span className="tabular text-end font-medium text-ink">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              {terminal.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3 text-[12.5px] text-ink-muted">
                  <span className="me-1">Documented endings:</span>
                  {terminal.map((t) => (
                    <Badge key={t.state} tone={t.state === 'closed' ? 'ok' : t.state === 'lost_to_follow_up' ? 'danger' : 'outline'}>
                      {stateLabel(t.state)} <span className="tabular">{t.count}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Open-results ageing" description="Days since the result was issued, for cases still open" />
            <CardBody>
              {ageing.loading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(ageing.data ?? {}).map(([bucket, count], i) => {
                    const total = Object.values(ageing.data ?? {}).reduce((a, b) => a + b, 0) || 1;
                    const tone = i === 0 ? 'bg-ok' : i === 1 ? 'bg-brand' : i === 2 ? 'bg-warn' : 'bg-danger';
                    return (
                      <div key={bucket} className="rounded-lg border border-line p-3">
                        <div className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">{bucket}</div>
                        <div className="mt-1 text-[22px] font-semibold tracking-tight text-ink tabular">{count}</div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                          <div className={cn('h-full rounded-full', tone)} style={{ width: `${(count / total) * 100}%` }} />
                        </div>
                        <div className="mt-1 text-[11.5px] text-ink-muted tabular">{Math.round((count / total) * 100)}%</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <EscalationQueue q={escalations} />
      </div>
    </section>
  );
}

function Kpi({ label, value, hint, icon: Icon, tone = 'neutral' }: { label: string; value?: string; hint?: string; icon: React.ComponentType<{ className?: string }>; tone?: 'neutral' | 'ok' | 'warn' | 'danger' }) {
  const ring = tone === 'danger' ? 'bg-danger-soft text-danger' : tone === 'warn' ? 'bg-warn-soft text-warn' : tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-brand-soft text-brand';
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12.5px] font-medium text-ink-muted">{label}</div>
          {value === undefined ? <Skeleton className="mt-2 h-8 w-16" /> : <div className="mt-1 text-[28px] font-semibold tracking-tight text-ink tabular">{value}</div>}
          {hint && <div className="mt-1 text-[12px] text-ink-muted">{hint}</div>}
        </div>
        <span className={cn('grid h-9 w-9 place-items-center rounded-lg', ring)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
    </Card>
  );
}

function EscalationQueue({ q }: { q: ReturnType<typeof useQuery<Escalation[]>> }) {
  const [active, setActive] = React.useState<Escalation | null>(null);
  const [resolution, setResolution] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function resolve() {
    if (!active) return;
    setBusy(true);
    try {
      await Escalations.resolve(active.id, resolution.trim());
      toast.success('Escalation resolved', { description: ruleLabel(active.ruleId) });
      setActive(null);
      setResolution('');
      await q.refetch();
    } catch (e) {
      toast.error('Could not resolve', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="self-start">
      <CardHeader title="Escalation queue" description="Raised by SLA breaches and stalled cases. Each one needs a named human to act." />
      <CardBody className="pt-0">
        {q.loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : !q.data?.length ? (
          <EmptyState icon={CheckCheck} title="Nothing waiting" description="No open escalations. Every breach has been actioned." />
        ) : (
          <ul className="divide-y divide-line">
            {q.data.slice(0, 25).map((e, i) => (
              <li key={e.id} className="flex items-start gap-3 py-3 animate-in-up" style={{ animationDelay: `${Math.min(i, 10) * 20}ms` }}>
                <span className={cn('mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full', e.priority === 'urgent' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn')}>
                  <Siren className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-medium text-ink">{ruleLabel(e.ruleId)}</span>
                    {e.case && <TierBadge tier={e.case.tier} />}
                    {e.case && <StateBadge state={e.case.state} />}
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-ink-muted">
                    {e.case?.patient ? `${e.case.patient.givenName} ${e.case.patient.familyName} · ` : ''}
                    to {roleLabel(e.targetRole)} · suggested: {humanize(e.suggestedAction)} · {relative(e.createdAt)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setActive(e)}>
                    Resolve
                  </Button>
                  <Link href={`/coordinator/${e.caseId}`} className="rounded-md p-1.5 text-ink-faint transition hover:bg-surface-2 hover:text-brand" aria-label="Open case">
                    <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        {active && (
          <DialogContent
            title="Resolve escalation"
            description={`${ruleLabel(active.ruleId)} · ${active.reason}`}
            size="sm"
            footer={
              <Button loading={busy} disabled={resolution.trim().length < 5} onClick={resolve}>
                <CheckCheck className="h-4 w-4" /> Mark resolved
              </Button>
            }
          >
            <Field label="What was done" hint="Recorded against the escalation with your name.">
              <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Called the owning clinic; patient contacted and consult booked for Monday." />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
