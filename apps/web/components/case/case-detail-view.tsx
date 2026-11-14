'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, CalendarClock, FileCheck2, Mail, MapPin, Phone, ShieldAlert, Siren, TestTube2 } from 'lucide-react';
import { Cases, Programmes } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { fmtDate, fmtDay, humanize, relative, slaStatus } from '@/lib/utils';
import { roleLabel } from '@/lib/auth';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LOCALE_LABEL, RiskPill, SlaChip, StateBadge, TierBadge, stateLabel } from '@/components/domain';
import { CaseActions } from './case-actions';
import { AiProposalsCard } from './ai-proposals-card';
import { CaseTimeline } from './case-timeline';
import { PathwayStepper } from './pathway-stepper';

export function CaseDetailView({ id, backHref }: { id: string; backHref: string }) {
  const c = useQuery(`case:${id}`, () => Cases.get(id), { pollMs: 20_000 });
  const timeline = useQuery(`timeline:${id}`, () => Cases.timeline(id));
  const programmes = useQuery('programmes', Programmes.list);
  const programme = programmes.data?.find((p) => p.id === c.data?.programmeId);

  const refresh = async () => {
    await Promise.all([c.refetch(), timeline.refetch()]);
  };

  if (c.error)
    return (
      <Card>
        <EmptyState icon={ShieldAlert} title="Case not available" description={c.error.message} action={<Button variant="secondary" onClick={() => void c.refetch()}>Retry</Button>} />
      </Card>
    );

  const data = c.data;
  return (
    <div className="animate-fade">
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted transition hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to worklist
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {data ? <Avatar name={`${data.patient.givenName} ${data.patient.familyName}`} size="lg" className="h-12 w-12 text-[16px]" /> : <Skeleton className="h-12 w-12 rounded-full" />}
          <div className="min-w-0">
            {data ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[22px] font-semibold tracking-tight text-ink">
                    {data.patient.givenName} {data.patient.familyName}
                  </h1>
                  <TierBadge tier={data.tier} />
                  <StateBadge state={data.state} />
                </div>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {programme?.name ?? data.programmeId} · born {fmtDay(data.patient.birthDate)} · {humanize(data.patient.sex)} · {LOCALE_LABEL[data.patient.preferredLocale] ?? data.patient.preferredLocale} · case <span className="font-mono text-[12px]">{data.id.slice(0, 8)}</span>
                </p>
              </>
            ) : (
              <>
                <Skeleton className="h-6 w-56" />
                <Skeleton className="mt-2 h-3.5 w-80" />
              </>
            )}
          </div>
        </div>
        {data && <CaseActions c={data} programme={programme} onDone={refresh} />}
      </div>

      {/* Pathway */}
      <Card className="mt-6">
        <CardBody className="pt-5">
          {programme && data ? <PathwayStepper programme={programme} current={data.state} /> : <Skeleton className="h-12 w-full" />}
        </CardBody>
      </Card>

      {data && <AiProposalsCard c={data} onDone={refresh} />}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-5">
          {/* Ownership + SLA */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader title="Owner" description="Accountable for the current step" />
              <CardBody>
                {!data ? (
                  <Skeleton className="h-10 w-full" />
                ) : data.owner ? (
                  <div className="flex items-center gap-3">
                    <Avatar name={data.owner.displayName} size="lg" />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-[14px] font-medium text-ink">{data.owner.displayName.replace(/\s*\(.*\)/, '')}</div>
                      <div className="text-[12.5px] text-ink-muted">{roleLabel(data.owner.role)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-md bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
                    <Siren className="h-4 w-4 shrink-0" /> No owner. The step cannot progress until someone is accountable.
                  </div>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="SLA clock" description={data?.slaDeadlineAt ? `For ${stateLabel(data.state)}` : 'No clock in this state'} />
              <CardBody>
                {!data ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <SlaBlock enteredAt={data.enteredStateAt} deadline={data.slaDeadlineAt} warnAt={data.slaWarnAt} />
                )}
              </CardBody>
            </Card>
          </div>

          {/* Result */}
          <Card>
            <CardHeader
              title="Screening result"
              description={data ? `${data.result.loincCode} · issued ${fmtDate(data.result.issuedAt)}` : undefined}
              action={data?.result.fhirReportId ? <Badge tone="outline">FHIR DiagnosticReport ✓</Badge> : undefined}
            />
            <CardBody>
              {!data ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <div className="flex flex-wrap items-start gap-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-lg bg-danger-soft text-danger">
                      <TestTube2 className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-[15px] font-semibold text-ink">{data.result.valueText}</div>
                      <div className="text-[12.5px] text-ink-muted">Received {relative(data.result.receivedAt)} · ref {data.result.externalId}</div>
                    </div>
                  </div>
                  {data.result.flags.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">Flags</div>
                      <div className="flex flex-wrap gap-1.5">
                        {data.result.flags.map((f) => (
                          <Badge key={f} tone="warn">
                            {humanize(f)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Patient + risk */}
          <Card>
            <CardHeader title="Patient & barriers" description="Context used for outreach and the risk model" action={data ? <RiskPill tier={data.riskTier} score={data.riskScore} /> : undefined} />
            <CardBody>
              {!data ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
                  <Row icon={Phone} label="Phone" value={data.patient.phone ?? '—'} />
                  <Row icon={Mail} label="Email" value={data.patient.email ?? '—'} />
                  <Row icon={MapPin} label="Distance to care" value={data.patient.distanceKm != null ? `${data.patient.distanceKm} km${data.patient.transportBarrier ? ' · transport barrier' : ''}` : '—'} />
                  <Row icon={CalendarClock} label="Prior no-shows" value={String(data.patient.priorNoShows)} />
                  {Array.isArray(data.riskReasons) && data.riskReasons.length > 0 && (
                    <div className="sm:col-span-2">
                      <dt className="mb-1 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">
                        <Bot className="h-3.5 w-3.5" /> Why the model flagged this
                      </dt>
                      <dd className="space-y-1.5">
                        {(data.riskReasons as Array<RiskReason | string>).map((r, i) => {
                          const reason = typeof r === 'string' ? { label: humanize(r), contribution: 0 } : r;
                          return (
                            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/60 px-3 py-2">
                              <span className="flex items-center gap-2 text-ink">
                                <span className="h-1.5 w-1.5 rounded-full bg-ai" />
                                {reason.label}
                              </span>
                              {reason.suggestedAction && (
                                <Badge tone="ai" className="shrink-0">
                                  Suggest: {humanize(reason.suggestedAction)}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </CardBody>
          </Card>

          {/* Evidence & escalations */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader title="Evidence" description="What proves the outcome" />
              <CardBody>
                {!data ? (
                  <Skeleton className="h-10 w-full" />
                ) : data.evidence.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">None attached yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.evidence.map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5 text-[13px]">
                        <FileCheck2 className="mt-0.5 h-4 w-4 text-ok" />
                        <span>
                          <span className="font-medium text-ink">{humanize(e.type)}</span>
                          <span className="block text-[12px] text-ink-muted">
                            {e.reference} · {fmtDate(e.recordedAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Escalations" description="Open human escalations" />
              <CardBody>
                {!data ? (
                  <Skeleton className="h-10 w-full" />
                ) : data.escalations.length === 0 ? (
                  <p className="text-[13px] text-ink-muted">None open.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.escalations.map((e) => (
                      <li key={e.id} className="flex items-start gap-2.5 text-[13px]">
                        <Siren className={`mt-0.5 h-4 w-4 shrink-0 ${e.priority === 'urgent' ? 'text-danger' : 'text-warn'}`} />
                        <span className="min-w-0">
                          <span className="font-medium text-ink">{e.reason || humanize(e.ruleId)}</span>
                          <span className="block text-[12px] text-ink-muted">
                            To {roleLabel(e.targetRole)}
                            {e.priority === 'urgent' && <span className="font-semibold text-danger"> · urgent</span>}
                            {e.suggestedAction && <> · {humanize(e.suggestedAction)}</>} · {relative(e.createdAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>

        {/* Timeline */}
        <Card className="self-start lg:sticky lg:top-7">
          <CardHeader title="Audit timeline" description="Every change, who made it, and its FHIR Provenance" />
          <CardBody className="max-h-[calc(100vh-180px)] overflow-y-auto scroll-thin">
            <CaseTimeline events={timeline.data} loading={timeline.loading} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0">
        <dt className="text-[11.5px] text-ink-muted">{label}</dt>
        <dd className="truncate text-ink">{value}</dd>
      </div>
    </div>
  );
}

function SlaBlock({ enteredAt, deadline, warnAt }: { enteredAt: string; deadline: string | null; warnAt: string | null }) {
  if (!deadline) return <p className="text-[13px] text-ink-muted">This state has no SLA window.</p>;
  const status = slaStatus(enteredAt, deadline);
  const start = new Date(enteredAt).getTime();
  const end = new Date(deadline).getTime();
  const pct = Math.max(0, Math.min(100, ((Date.now() - start) / Math.max(1, end - start)) * 100));
  const bar = status === 'breached' ? 'bg-danger' : status === 'warn' ? 'bg-warn' : 'bg-brand';
  return (
    <div>
      <div className="flex items-center justify-between">
        <SlaChip enteredAt={enteredAt} deadline={deadline} />
        <span className="text-[12px] text-ink-muted tabular">due {fmtDate(deadline)}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full transition-[width] duration-700 ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint tabular">
        <span>entered {fmtDate(enteredAt)}</span>
        {warnAt && <span>warn {fmtDate(warnAt)}</span>}
      </div>
    </div>
  );
}

type RiskReason = { label: string; contribution: number; feature?: string; suggestedAction?: string };
