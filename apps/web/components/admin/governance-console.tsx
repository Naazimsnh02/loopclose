'use client';

import * as React from 'react';
import {

  Bot,
  Building2,
  CheckCircle2,
  FileText,
  Gauge,

  Languages,
  MessageSquareHeart,
  Power,
  ShieldCheck,
  ShieldOff,
  Siren,

  Timer,
  UserRound,
  Users,
} from 'lucide-react';
import { Admin, Messaging, type AiFeature, type AuditEntry, type Programme } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useAuth, roleLabel } from '@/lib/auth';
import { cn, fmtDate, humanize, relative } from '@/lib/utils';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/toaster';
import { ActorIcon, stateLabel } from '@/components/domain';

type Tab = 'ai' | 'audit' | 'programmes' | 'content' | 'people';

const FEATURE_ICON: Record<string, typeof Bot> = { navigator: MessageSquareHeart, risk: Gauge, summariser: FileText };

export function GovernanceConsole() {
  const [tab, setTab] = React.useState<Tab>('ai');
  const features = useQuery('admin:features', Admin.features, { pollMs: 15000 });
  const activity = useQuery('admin:activity', Admin.activity, { pollMs: 15000 });
  const audit = useQuery('admin:audit', () => Admin.audit(80), { pollMs: 15000 });

  const refreshAll = async () => {
    await Promise.all([features.refetch(), activity.refetch(), audit.refetch()]);
  };

  return (
    <div className="space-y-5">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'ai', label: 'AI controls' },
          { value: 'audit', label: 'Audit trail', count: audit.data?.length },
          { value: 'programmes', label: 'Programmes & SLAs' },
          { value: 'content', label: 'Content approvals' },
          { value: 'people', label: 'People & organisations' },
        ]}
      />
      {tab === 'ai' && <AiControls features={features.data} activity={activity.data} loading={features.loading} onChanged={refreshAll} />}
      {tab === 'audit' && <AuditTrail rows={audit.data} loading={audit.loading} />}
      {tab === 'programmes' && <ProgrammesView />}
      {tab === 'content' && <ContentApprovals />}
      {tab === 'people' && <PeopleView />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function AiControls({ features, activity, loading, onChanged }: { features: AiFeature[] | undefined; activity: Awaited<ReturnType<typeof Admin.activity>> | undefined; loading: boolean; onChanged: () => Promise<void> }) {
  const { user } = useAuth();
  const canToggle = user?.role === 'admin';
  const [pending, setPending] = React.useState<AiFeature | null>(null);
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const nav = activity?.navigatorOutcomes ?? {};
  const handoffs = (nav.emergency ?? 0) + (nav.distress ?? 0) + (nav.human ?? 0) + (nav.question ?? 0);
  const ack = activity?.proposals.filter((p) => p.kind === 'acknowledgement') ?? [];
  const decided = ack.filter((p) => p.status !== 'pending').reduce((a, p) => a + p.count, 0);

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await Admin.toggle(pending.name, !pending.enabled, reason.trim() || undefined);
      toast.success(`${pending.label} ${pending.enabled ? 'switched off' : 'switched on'}. Recorded in the audit trail.`);
      setPending(null);
      setReason('');
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Guard-rails at work */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ShieldCheck} tone="brand" label="Patient messages safety-checked" value={activity?.messagesGraded} hint="Every outbound message passes the grader before send" />
        <Stat icon={ShieldOff} tone={activity?.messagesBlocked ? 'danger' : 'ok'} label="Blocked before sending" value={activity?.messagesBlocked} hint="Fail-closed: a blocked message is never delivered" />
        <Stat icon={Siren} tone="warn" label="Navigator hand-offs to people" value={activity ? handoffs : undefined} hint={`${nav.emergency ?? 0} emergency · ${nav.distress ?? 0} distress · ${nav.human ?? 0} asked for a person · ${nav.question ?? 0} forwarded`} />
        <Stat icon={UserRound} tone="ai" label="AI proposals decided by a person" value={activity ? decided : undefined} hint={`${ack.find((p) => p.status === 'pending')?.count ?? 0} acknowledgement proposals waiting`} />
      </div>

      <Card>
        <CardHeader
          title="AI features and kill switches"
          description="Each feature can be switched off instantly. The rest of the platform keeps working; the fallback is shown on each card."
          action={!canToggle ? <Badge tone="outline">View only · admin can change</Badge> : undefined}
        />
        <CardBody className="grid gap-4 lg:grid-cols-3">
          {loading && !features
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 w-full" />)
            : features?.map((f) => {
                const Icon = FEATURE_ICON[f.name] ?? Bot;
                return (
                  <div key={f.name} className={cn('flex flex-col rounded-lg border p-4 transition-colors', f.enabled ? 'border-line bg-surface' : 'border-danger/25 bg-danger-soft/40')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', f.enabled ? 'bg-ai-soft text-ai' : 'bg-surface-2 text-ink-faint')}>
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <div className="leading-tight">
                          <div className="text-[14px] font-semibold text-ink">{f.label}</div>
                          <div className="mt-0.5 text-[12px] text-ink-muted">Risk tier: {f.tier}</div>
                        </div>
                      </div>
                      <Switch checked={f.enabled} disabled={!canToggle} label={`${f.label} ${f.enabled ? 'on' : 'off'}`} onClick={() => setPending(f)} />
                    </div>

                    <dl className="mt-4 space-y-2.5 text-[12.5px]">
                      <div>
                        <dt className="text-ink-faint">Engine</dt>
                        <dd className="text-ink">{f.engine}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">When switched off</dt>
                        <dd className="text-ink-2">{f.offBehaviour}</dd>
                      </div>
                      <div>
                        <dt className="text-ink-faint">{f.name === 'risk' ? 'Assessments logged' : 'Proposals'}</dt>
                        <dd className="tabular text-ink">
                          {f.name === 'risk' ? (
                            f.proposals.pending + f.proposals.accepted + f.proposals.rejected
                          ) : (
                            <>
                              {f.proposals.accepted} accepted · {f.proposals.rejected} rejected · {f.proposals.pending} waiting
                            </>
                          )}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-[11.5px] text-ink-muted">
                      <span className={cn('inline-flex items-center gap-1.5 font-medium', f.enabled ? 'text-ok' : 'text-danger')}>
                        <Power className="h-3.5 w-3.5" /> {f.enabled ? 'Live' : 'Switched off'}
                      </span>
                      <span className="truncate">{f.updatedAt && f.updatedBy && f.updatedBy !== 'seed' ? `${f.updatedBy} · ${relative(f.updatedAt)}` : 'Default setting'}</span>
                    </div>
                  </div>
                );
              })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What AI is never allowed to do" description="Enforced in the case engine for every programme, whatever the switches say" />
        <CardBody>
          <ul className="grid gap-2.5 text-[13px] text-ink-2 sm:grid-cols-2">
            {[
              'Assign or change the accountable owner of a case',
              'Close a case or exit a patient from the pathway',
              'Move a case anywhere except the states the programme allows (patient acknowledged)',
              'Send text that has not passed the safety check',
              'Diagnose, give odds, or tell a patient a result is nothing to worry about',
              'Act on a proposal before a person accepts it',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> {t}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        {pending && (
          <DialogContent
            title={pending.enabled ? `Switch off ${pending.label.toLowerCase()}?` : `Switch on ${pending.label.toLowerCase()}?`}
            description={pending.enabled ? pending.offBehaviour : 'The feature resumes immediately for new activity.'}
            footer={
              <>
                <Button variant="secondary" onClick={() => setPending(null)}>
                  Cancel
                </Button>
                <Button variant={pending.enabled ? 'danger' : 'primary'} loading={saving} disabled={pending.enabled && reason.trim().length < 5} onClick={() => void confirm()}>
                  {pending.enabled ? 'Switch off' : 'Switch on'}
                </Button>
              </>
            }
          >
            <label className="block text-[12.5px] font-medium text-ink-2" htmlFor="toggle-reason">
              Reason {pending.enabled ? '(required, kept in the audit trail)' : '(optional)'}
            </label>
            <Textarea id="toggle-reason" className="mt-1.5" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={pending.enabled ? 'e.g. Unexpected reply reported by a coordinator; pausing while we review.' : ''} />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function Switch({ checked, disabled, onClick, label }: { checked: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  const el = (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ring disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-ok' : 'bg-line-strong',
      )}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-[22px] rtl:-translate-x-[22px]' : 'translate-x-0.5 rtl:-translate-x-0.5')} />
    </button>
  );
  return disabled ? <Tooltip content="Only an administrator can change this">{el}</Tooltip> : el;
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Bot; label: string; value: number | undefined; hint: string; tone: 'brand' | 'ok' | 'danger' | 'warn' | 'ai' }) {
  const tones = { brand: 'bg-brand-soft text-brand', ok: 'bg-ok-soft text-ok', danger: 'bg-danger-soft text-danger', warn: 'bg-warn-soft text-warn', ai: 'bg-ai-soft text-ai' };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2.5">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12.5px] font-medium leading-tight text-ink-muted">{label}</span>
      </div>
      <div className="tabular mt-3 text-[26px] font-semibold tracking-tight text-ink">{value === undefined ? <Skeleton className="h-8 w-14" /> : value.toLocaleString()}</div>
      <p className="mt-1 text-[12px] leading-5 text-ink-faint">{hint}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

const OUTCOME_LABEL: Record<string, { label: string; tone: 'danger' | 'warn' | 'info' | 'ok' | 'brand' | 'neutral' | 'ai' }> = {
  enabled: { label: 'Switched on', tone: 'ok' },
  disabled: { label: 'Switched off', tone: 'danger' },
  emergency: { label: 'Emergency hand-off', tone: 'danger' },
  distress: { label: 'Distress hand-off', tone: 'warn' },
  human: { label: 'Asked for a person', tone: 'info' },
  teach_back_pass: { label: 'Teach-back passed', tone: 'ok' },
  teach_back_fail: { label: 'Teach-back not yet', tone: 'warn' },
  faq: { label: 'Approved answer', tone: 'brand' },
  question: { label: 'Forwarded', tone: 'neutral' },
};

function AuditTrail({ rows, loading }: { rows: AuditEntry[] | undefined; loading: boolean }) {
  return (
    <Card>
      <CardHeader title="Audit trail" description="Kill-switch changes and every AI invocation: who or what acted, on which case, with which model or script version. Raw prompts are never stored." />
      {loading && !rows ? (
        <CardBody>
          <TableSkeleton rows={8} cols={5} />
        </CardBody>
      ) : !rows?.length ? (
        <CardBody>
          <p className="text-[13px] text-ink-muted">Nothing recorded yet.</p>
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2/60 text-start text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-2 text-start">When</th>
                <th className="px-3 py-2 text-start">Actor</th>
                <th className="px-3 py-2 text-start">Action</th>
                <th className="px-3 py-2 text-start">Outcome</th>
                <th className="px-3 py-2 text-start">Detail</th>
                <th className="px-5 py-2 text-start">Version</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const o = OUTCOME_LABEL[r.outcome ?? ''];
                const matched = (r.metadata?.matched as string[] | undefined) ?? [];
                return (
                  <tr key={r.id} className="align-top hover:bg-surface-2/40">
                    <td className="tabular whitespace-nowrap px-5 py-2.5 text-ink-muted">{fmtDate(r.at)}</td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <ActorIcon kind={r.actorKind} className="h-6 w-6" />
                        <span className="text-ink">{r.actorKind === 'ai' ? `${humanize(r.actorName)} (AI)` : r.actorName}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">
                      {r.action === 'toggle_feature' ? `Kill switch: ${r.resourceId}` : `${humanize(r.aiFeature ?? 'ai')} turn`}
                      {r.resource === 'Case' && r.resourceId && <span className="block font-mono text-[11.5px] text-ink-faint">case {r.resourceId.slice(0, 8)}</span>}
                    </td>
                    <td className="px-3 py-2.5">{o ? <Badge tone={o.tone}>{o.label}</Badge> : <Badge>{r.outcome ?? '—'}</Badge>}</td>
                    <td className="max-w-[320px] px-3 py-2.5 text-ink-2">
                      {r.purpose && <span className="block">“{r.purpose}”</span>}
                      {matched.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {matched.map((m) => (
                            <span key={m} dir="auto" className="rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px]">
                              {m}
                            </span>
                          ))}
                        </span>
                      )}
                      {!r.purpose && matched.length === 0 && <span className="text-ink-faint">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 font-mono text-[11.5px] text-ink-muted">{r.aiModel ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

function slaText(v: unknown): string {
  if (!v || typeof v !== 'object') return '—';
  const o = v as Record<string, number>;
  if (o.businessDays) return `${o.businessDays} business day${o.businessDays > 1 ? 's' : ''}`;
  if (o.days) return `${o.days} day${o.days > 1 ? 's' : ''}`;
  if (o.hours) return `${o.hours} h`;
  if (o.daysFromCaseCreation) return `${o.daysFromCaseCreation} d from result`;
  return Object.entries(o)
    .map(([k, n]) => `${n} ${humanize(k).toLowerCase()}`)
    .join(', ');
}

function ProgrammesView() {
  const programmes = useQuery('admin:programmes', Admin.programmes);
  if (programmes.loading && !programmes.data) return <TableSkeleton rows={10} cols={6} />;
  return (
    <div className="space-y-5">
      {programmes.data?.map((p: Programme) => (
        <Card key={p.id}>
          <CardHeader
            title={p.name}
            description={`Version ${p.version} · configured in config/programmes/${p.id}.yaml · SLA values are placeholders until clinically validated`}
            action={
              <Tooltip content="States an AI actor may move a case into. Enforced by the state machine.">
                <Badge tone="ai">
                  <Bot className="h-3 w-3" /> AI may enter: {p.aiPolicy.mayEnterStates.map(stateLabel).join(', ')}
                </Badge>
              </Tooltip>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-line bg-surface-2/60 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">
                  <th className="px-5 py-2 text-start">Step</th>
                  <th className="px-3 py-2 text-start">Accountable owner</th>
                  <th className="px-3 py-2 text-start">Routine</th>
                  <th className="px-3 py-2 text-start">Priority</th>
                  <th className="px-3 py-2 text-start">Urgent</th>
                  <th className="px-5 py-2 text-start">On breach, escalate to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {p.states
                  .filter((s) => !p.terminalStates.includes(s.id))
                  .map((s, i) => {
                    const sla = (s.sla ?? {}) as Record<string, unknown>;
                    return (
                      <tr key={s.id} className="hover:bg-surface-2/40">
                        <td className="px-5 py-2.5">
                          <span className="flex items-center gap-2.5">
                            <span className="tabular flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-strong">{i + 1}</span>
                            <span className="font-medium text-ink">{stateLabel(s.id)}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-ink-2">{roleLabel(s.ownerRole)}</td>
                        <td className="tabular px-3 py-2.5 text-ink-2">{slaText(sla.routine)}</td>
                        <td className="tabular px-3 py-2.5 text-ink-2">{slaText(sla.priority)}</td>
                        <td className="tabular px-3 py-2.5 text-ink-2">{slaText(sla.urgent)}</td>
                        <td className="px-5 py-2.5 text-ink-2">{s.escalateTo ? roleLabel(s.escalateTo) : '—'}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <CardBody className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-3 text-[12.5px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand" /> Closure needs evidence ({p.closure.evidenceTypes.map((e) => humanize(e).toLowerCase()).join(', ')}) or an authorised human decision
            </span>
            <span className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-brand" /> Warn at 70% of every SLA, escalate on breach
            </span>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ContentApprovals() {
  const templates = useQuery('admin:templates', Messaging.templates);
  const scripts = useQuery('admin:scripts', Messaging.navigatorScripts);
  const rows = [
    ...(templates.data ?? []).map((t) => ({ id: t.id, kind: 'Result message', programme: t.programme, detail: `Stage: ${stateLabel(t.stage)}`, status: t.approval.status, by: t.approval.approvedBy })),
    ...(scripts.data ?? []).map((s) => ({ id: s.version, kind: 'Navigator script', programme: s.programme, detail: `Teach-back, re-explain, hand-offs, ${s.faqs.length} FAQs`, status: s.approval.status, by: s.approval.approvedBy })),
  ];
  const drafts = rows.filter((r) => r.status !== 'approved').length;
  return (
    <div className="space-y-5">
      <div className={cn('flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px]', drafts ? 'border-warn/30 bg-warn-soft/60 text-ink-2' : 'border-ok/30 bg-ok-soft/60 text-ink-2')}>
        <Languages className={cn('mt-0.5 h-4 w-4 shrink-0', drafts ? 'text-warn' : 'text-ok')} />
        <span>
          {drafts
            ? `${drafts} of ${rows.length} patient-facing content sets are drafts. They can be sent only in demo mode. Before a pilot each needs a clinical lead and a native-speaker reviewer per language (Arabic, English, Urdu, Hindi).`
            : 'All patient-facing content is approved.'}
        </span>
      </div>
      <Card>
        <CardHeader title="Patient-facing content" description="The only text a patient can receive. Every message also passes the safety check at send time." />
        {templates.loading && !templates.data ? (
          <CardBody>
            <TableSkeleton rows={4} cols={5} />
          </CardBody>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2/60 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-2 text-start">Content</th>
                <th className="px-3 py-2 text-start">Programme</th>
                <th className="px-3 py-2 text-start">Languages</th>
                <th className="px-3 py-2 text-start">Status</th>
                <th className="px-5 py-2 text-start">Approved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/40">
                  <td className="px-5 py-2.5">
                    <span className="block font-medium text-ink">{r.kind}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {r.detail} · <span className="font-mono">{r.id}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{r.programme === 'colorectal-fit' ? 'Colorectal (FIT)' : 'Breast (BI-RADS)'}</td>
                  <td className="px-3 py-2.5">
                    <span className="flex gap-1">
                      {['ar', 'en', 'ur', 'hi'].map((l) => (
                        <Badge key={l} tone="outline" className="px-1.5 text-[11px] uppercase">
                          {l}
                        </Badge>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{r.status === 'approved' ? <Badge tone="ok">Approved</Badge> : <Badge tone="warn" dot>Draft · demo only</Badge>}</td>
                  <td className="px-5 py-2.5 text-ink-muted">{r.by ?? 'Awaiting sign-off'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function PeopleView() {
  const orgs = useQuery('admin:orgs', Admin.organizations);
  const users = useQuery('admin:users', Admin.users);
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <Card>
        <CardHeader title="Organisations" description="Every hand-off crosses one of these boundaries" />
        <CardBody className="space-y-2">
          {orgs.loading && !orgs.data
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            : orgs.data?.map((o) => (
                <div key={o.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-ink">{o.name}</span>
                    <span className="block text-[12px] text-ink-muted">{humanize(o.kind)}</span>
                  </span>
                  <span className="tabular text-end text-[12px] text-ink-muted">
                    {o._count.users} {o._count.users === 1 ? 'person' : 'people'}
                    <span className="block">{o._count.casesAsOwnerOrg} {o._count.casesAsOwnerOrg === 1 ? 'case' : 'cases'} owned</span>
                  </span>
                </div>
              ))}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="People and roles" description="Role-based access; production uses the organisation's identity provider with MFA" action={<Badge tone="outline"><Users className="h-3 w-3" /> {users.data?.length ?? '…'}</Badge>} />
        {users.loading && !users.data ? (
          <CardBody>
            <TableSkeleton rows={8} cols={3} />
          </CardBody>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2/60 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-2 text-start">Name</th>
                <th className="px-3 py-2 text-start">Role</th>
                <th className="px-5 py-2 text-start">Organisation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {users.data?.map((u) => (
                <tr key={u.id} className="hover:bg-surface-2/40">
                  <td className="px-5 py-2.5">
                    <span className="block font-medium text-ink">{u.displayName}</span>
                    <span className="block text-[12px] text-ink-faint">{u.email}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone="neutral">{roleLabel(u.role)}</Badge>
                  </td>
                  <td className="px-5 py-2.5 text-ink-2">{u.organization.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

