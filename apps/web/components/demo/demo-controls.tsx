'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarX2,
  Clock3,
  FlaskConical,
  History,
  MessageSquareHeart,
  RotateCcw,
  Send,
  ServerCrash,
  Undo2,
  UserX,
  WifiOff,
} from 'lucide-react';
import { Demo, type Locale } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useAuth } from '@/lib/auth';
import { cn, fmtDate } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toaster';
import { LOCALE_LABEL } from '@/components/domain';

const LANG_EN: Record<string, string> = { ar: 'Arabic', en: 'English', ur: 'Urdu', hi: 'Hindi' };
const OPERATORS = new Set(['admin', 'coordinator', 'coordinator_lead', 'programme_manager']);

type Programme = 'colorectal-fit' | 'breast-birads';
type Tier = 'routine' | 'priority' | 'urgent';

interface LogEntry {
  id: number;
  at: Date;
  icon: typeof Send;
  tone: 'brand' | 'warn' | 'danger' | 'ok' | 'neutral';
  title: string;
  detail?: string;
  links?: Array<{ href: string; label: string }>;
}

const CLOCK_STEPS = [
  { label: '+4 hours', hours: 4 },
  { label: '+1 day', hours: 24 },
  { label: '+3 days', hours: 72 },
  { label: '+1 week', hours: 168 },
];

export function DemoControls() {
  const { user } = useAuth();
  const state = useQuery('demo:state', Demo.state, { pollMs: 10000 });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogEntry[]>([]);
  const [lastPatient, setLastPatient] = React.useState<{ id: string; name: string; caseId: string | null } | null>(null);
  const [programme, setProgramme] = React.useState<Programme>('colorectal-fit');
  const [locale, setLocale] = React.useState<Locale>('ar');
  const [tier, setTier] = React.useState<Tier>('priority');
  const [confirmReset, setConfirmReset] = React.useState(false);

  if (user && !OPERATORS.has(user.role)) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-[13.5px] text-ink-muted">Demo controls are available to coordinators, the programme manager and administrators.</CardBody>
      </Card>
    );
  }

  const add = (e: Omit<LogEntry, 'id' | 'at'>) => setLog((l) => [{ ...e, id: Date.now() + Math.random(), at: new Date() }, ...l].slice(0, 30));

  async function run<T>(key: string, fn: () => Promise<T>, after: (r: T) => void) {
    setBusy(key);
    try {
      const r = await fn();
      after(r);
      await state.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const offset = state.data?.offsetHours ?? 0;
  const setClock = (hours: number) =>
    run(`clock${hours}`, () => Demo.setClock(hours), (r) => {
      toast.success(r.newBreaches ? `Clock moved. ${r.newBreaches} new SLA breach${r.newBreaches === 1 ? '' : 'es'} escalated.` : 'Clock moved. No new breaches.');
      add({
        icon: Clock3,
        tone: r.newBreaches ? 'warn' : 'neutral',
        title: hours === 0 ? 'Clock back to real time' : `Clock moved to ${offsetLabel(hours)}`,
        detail: r.newBreaches ? `${r.newBreaches} cases passed their deadline; each owner's lead was alerted` : 'No case passed its deadline',
        links: r.newBreaches ? [{ href: '/coordinator', label: 'See the worklist' }, { href: '/dashboard', label: 'Dashboard' }] : undefined,
      });
    });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        {/* Clock */}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-5 px-5 py-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Clock3 className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium uppercase tracking-wider text-ink-faint">Demo clock</div>
              <div className="tabular mt-0.5 flex flex-wrap items-baseline gap-2 text-[20px] font-semibold tracking-tight text-ink">
                {state.data ? fmtDate(state.data.now) : <Skeleton className="h-7 w-44" />}
                {offset !== 0 && <Badge tone="warn">{offsetLabel(offset)}</Badge>}
              </div>
              <p className="mt-0.5 text-[12.5px] text-ink-muted">
                Moving time forward runs every SLA check at once, so you can show breaches and escalations without waiting.
                {state.data ? ` ${state.data.overdue} open cases are past their deadline right now.` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {CLOCK_STEPS.map((s) => (
                <Button key={s.hours} size="sm" variant="secondary" loading={busy === `clock${offset + s.hours}`} disabled={!!busy} onClick={() => void setClock(offset + s.hours)}>
                  {s.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" disabled={!!busy || offset === 0} onClick={() => void setClock(0)}>
                <Undo2 className="h-3.5 w-3.5" /> Real time
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* New result */}
          <Scenario icon={FlaskConical} title="A new screening result arrives" description="Creates a synthetic patient and sends the lab report through the same FHIR intake the real lab would use.">
            <div className="space-y-3">
              <Segmented label="Programme" value={programme} onChange={setProgramme} options={[{ value: 'colorectal-fit', label: 'Bowel · FIT' }, { value: 'breast-birads', label: 'Breast · BI-RADS' }]} />
              <Segmented label="Language" value={locale} onChange={setLocale} options={(['ar', 'en', 'ur', 'hi'] as Locale[]).map((l) => ({ value: l, label: LOCALE_LABEL[l]! }))} />
              <Segmented
                label="Urgency"
                value={tier}
                onChange={setTier}
                options={[
                  { value: 'routine', label: 'Routine' },
                  { value: 'priority', label: programme === 'colorectal-fit' ? 'Priority · anaemia' : 'Priority · 4C' },
                  { value: 'urgent', label: programme === 'colorectal-fit' ? 'Urgent · alarm signs' : 'Urgent · BI-RADS 5' },
                ]}
              />
            </div>
            <Button
              className="mt-4 w-full"
              loading={busy === 'result'}
              disabled={!!busy}
              onClick={() =>
                void run('result', () => Demo.pushResult({ programmeId: programme, locale, tier }), (r) => {
                  setLastPatient({ id: r.patient.id, name: r.patient.name, caseId: r.caseId });
                  toast.success(`${r.patient.name}'s result is in the worklist`);
                  add({
                    icon: FlaskConical,
                    tone: tier === 'urgent' ? 'danger' : 'brand',
                    title: `Result received for ${r.patient.name}`,
                    detail: `${programme === 'colorectal-fit' ? 'FIT positive' : 'BI-RADS'} · ${tier} · speaks ${LANG_EN[r.patient.locale]}. Case opened with a named owner and SLA clock.`,
                    links: r.caseId ? [{ href: `/coordinator/${r.caseId}`, label: 'Open case' }, { href: `/patient?case=${r.caseId}`, label: 'Patient chat' }] : undefined,
                  });
                })
              }
            >
              <Send className="h-4 w-4" /> Push result
            </Button>
          </Scenario>

          {/* Channel failure */}
          <Scenario icon={WifiOff} title="The patient can't be reached" description="Makes every message channel fail for one patient. The navigator falls back to SMS, then asks a coordinator to phone.">
            {lastPatient ? (
              <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[13px]">
                <div className="font-medium text-ink">{lastPatient.name}</div>
                <div className="text-[12px] text-ink-muted">Last patient you pushed</div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-line px-3 py-3 text-[12.5px] text-ink-muted">Push a result first; the failure applies to that patient.</p>
            )}
            {(state.data?.failingPatients.length ?? 0) > 0 && (
              <ul className="mt-3 space-y-1.5">
                {state.data!.failingPatients.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-md bg-danger-soft/60 px-3 py-1.5 text-[12.5px]">
                    <span className="flex items-center gap-1.5 text-danger">
                      <ServerCrash className="h-3.5 w-3.5" /> Channels down for {p.givenName} {p.familyName}
                    </span>
                    <button
                      className="font-medium text-ink-2 hover:text-ink hover:underline"
                      onClick={() => void run(`restore${p.id}`, () => Demo.channelFailure(p.id, false), () => add({ icon: WifiOff, tone: 'ok', title: `Channels restored for ${p.givenName} ${p.familyName}` }))}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                disabled={!lastPatient || !!busy || !!state.data?.failingPatients.some((p) => p.id === lastPatient?.id)}
                loading={busy === 'fail'}
                onClick={() =>
                  void run('fail', () => Demo.channelFailure(lastPatient!.id, true), () => {
                    toast.success(`Messages to ${lastPatient!.name} will now fail`);
                    add({
                      icon: WifiOff,
                      tone: 'warn',
                      title: `Channels down for ${lastPatient!.name}`,
                      detail: 'Now send the result from the patient chat to see the fallback and the hand-off',
                      links: lastPatient!.caseId ? [{ href: `/patient?case=${lastPatient!.caseId}`, label: 'Patient chat' }] : undefined,
                    });
                  })
                }
              >
                <WifiOff className="h-4 w-4" /> Make channels fail
              </Button>
            </div>
          </Scenario>

          {/* No-show */}
          <Scenario icon={UserX} title="The patient misses the appointment" description="Picks the most urgent case with a booked appointment, records a no-show and alerts the scheduler to rebook and reach out.">
            <Candidates n={state.data?.noShowCandidates} label="cases with a booked appointment" />
            <Button
              className="mt-4 w-full"
              variant="secondary"
              loading={busy === 'noshow'}
              disabled={!!busy || state.data?.noShowCandidates === 0}
              onClick={() =>
                void run('noshow', () => Demo.noShow(), (r) => {
                  toast.success('No-show recorded and escalated');
                  add({ icon: CalendarX2, tone: 'warn', title: 'Patient did not attend', detail: `No-show ${r.noShowCount} on this case. The case stays open and goes back to the scheduler.`, links: [{ href: `/coordinator/${r.caseId}`, label: 'Open case' }] });
                })
              }
            >
              <CalendarX2 className="h-4 w-4" /> Simulate a no-show
            </Button>
          </Scenario>

          {/* Referral declined */}
          <Scenario icon={RotateCcw} title="The specialist declines the referral" description="The receiving clinic says it has no capacity. Instead of disappearing, the referral comes back to the coordinator to redirect.">
            <Candidates n={state.data?.referralCandidates} label="cases with an open referral" />
            <Button
              className="mt-4 w-full"
              variant="secondary"
              loading={busy === 'decline'}
              disabled={!!busy || state.data?.referralCandidates === 0}
              onClick={() =>
                void run('decline', () => Demo.referralDecline(), (r) => {
                  toast.success('Referral declined and sent back to the coordinator');
                  add({ icon: RotateCcw, tone: 'warn', title: 'Referral declined: no capacity', detail: 'Escalated to the coordinator with "redirect referral" as the next step.', links: [{ href: `/coordinator/${r.caseId}`, label: 'Open case' }] });
                })
              }
            >
              <RotateCcw className="h-4 w-4" /> Decline a referral
            </Button>
          </Scenario>
        </div>

        <Card>
          <CardBody className="flex flex-wrap items-center gap-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-ink-muted">
              <History className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold text-ink">Reset the demo</div>
              <p className="text-[12.5px] text-ink-muted">
                Removes the {state.data?.demoCases ?? 0} patient{state.data?.demoCases === 1 ? '' : 's'} pushed here and all patient-chat conversations, and turns the clock, channels and AI switches back to normal. The seeded population stays.
              </p>
            </div>
            <Button variant="secondary" disabled={!!busy} onClick={() => setConfirmReset(true)}>
              <RotateCcw className="h-4 w-4" /> Reset
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Session log */}
      <aside className="space-y-5">
        <Card className="xl:sticky xl:top-6">
          <CardHeader title="What just happened" description="Each action runs through the real case engine, so the worklist, case timeline and dashboard all react." />
          <CardBody className="pt-0">
            {log.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
                <MessageSquareHeart className="mx-auto h-5 w-5 text-ink-faint" />
                <p className="mt-2 text-[12.5px] leading-5 text-ink-muted">Suggested run: push an Arabic FIT result, open the patient chat and send it, then move the clock forward a week.</p>
              </div>
            ) : (
              <ol className="relative space-y-4 before:absolute before:inset-y-1 before:start-[15px] before:w-px before:bg-line">
                {log.map((e) => (
                  <li key={e.id} className="relative flex gap-3 animate-in-up">
                    <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-surface', TONE[e.tone])}>
                      <e.icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-ink">{e.title}</span>
                        <span className="tabular shrink-0 text-[11px] text-ink-faint">{e.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                      {e.detail && <p className="mt-0.5 text-[12.5px] leading-5 text-ink-muted">{e.detail}</p>}
                      {e.links && (
                        <div className="mt-1.5 flex flex-wrap gap-3">
                          {e.links.map((l) => (
                            <Link key={l.href} href={l.href} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                              {l.label} <ArrowRight className="h-3 w-3" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </aside>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent
          title="Reset the demo?"
          description="Pushed patients and their cases are deleted, every patient-chat conversation is cleared, the clock returns to real time, failing channels are restored and all AI features are switched back on."
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={busy === 'reset'}
                onClick={() =>
                  void run('reset', () => Demo.reset(), (r) => {
                    setConfirmReset(false);
                    setLastPatient(null);
                    setLog([]);
                    toast.success(`Demo reset. ${r.removedDemoCases} pushed case${r.removedDemoCases === 1 ? '' : 's'} removed.`);
                  })
                }
              >
                Reset demo
              </Button>
            </>
          }
        >
          <p className="text-[13px] text-ink-muted">This cannot be undone, but it only touches demo activity.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const TONE: Record<LogEntry['tone'], string> = {
  brand: 'bg-brand-soft text-brand',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  ok: 'bg-ok-soft text-ok',
  neutral: 'bg-surface-2 text-ink-muted',
};

function offsetLabel(h: number) {
  if (h === 0) return 'real time';
  const sign = h > 0 ? '+' : '−';
  const a = Math.abs(h);
  if (a % 24 === 0) return `${sign}${a / 24} day${a === 24 ? '' : 's'}`;
  return `${sign}${a} h`;
}

function Scenario({ icon: Icon, title, description, children }: { icon: typeof Send; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h3 className="text-[14.5px] font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-[12.5px] leading-5 text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-1 flex-col justify-end">{children}</div>
    </Card>
  );
}

function Candidates({ n, label }: { n: number | undefined; label: string }) {
  return (
    <div className="flex items-baseline gap-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <span className="tabular text-[20px] font-semibold text-ink">{n ?? '…'}</span>
      <span className="text-[12.5px] text-ink-muted">{label}</span>
    </div>
  );
}

function Segmented<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }> }) {
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">{label}</div>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring',
              value === o.value ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
