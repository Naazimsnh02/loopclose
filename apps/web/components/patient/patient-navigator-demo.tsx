'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BatteryFull,
  Bot,
  Check,
  CheckCheck,
  ChevronLeft,
  CircleAlert,
  HeartPulse,
  Languages,
  Lock,
  Play,
  Search,
  SendHorizontal,
  ShieldCheck,
  Signal,
  Sparkles,
  UserRound,
  Wifi,
  X,
} from 'lucide-react';
import { Cases, Messaging, Proposals, type CaseRow, type ChatMessage, type Locale, type NavigatorTurn } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { useAuth, roleLabel } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/toaster';
import { LOCALE_LABEL, StateBadge } from '@/components/domain';
import { INTENT_META, PHONE_COPY, intentFromTemplate, isRtl, quickReplies } from './navigator-copy';

const NAV_STATES = ['result_issued', 'patient_notified', 'patient_acknowledged'] as const;
const PROGRAMME_SHORT: Record<string, string> = { 'colorectal-fit': 'Bowel · FIT', 'breast-birads': 'Breast · BI-RADS' };
const COORDINATOR_ROLES = new Set(['coordinator', 'coordinator_lead', 'admin']);

type LocaleFilter = 'all' | Locale;

export function PatientNavigatorDemo() {
  const { user } = useAuth();
  const canCoordinate = !!user && COORDINATOR_ROLES.has(user.role);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [localeFilter, setLocaleFilter] = React.useState<LocaleFilter>('all');
  const [query, setQuery] = React.useState('');
  /** Session-only detail the API returns per turn (matched phrases); history alone can't show it. */
  const [turns, setTurns] = React.useState<Record<string, NavigatorTurn>>({});

  const cases = useQuery(
    'patient-cases',
    async () => {
      const lists = await Promise.all(NAV_STATES.map((state) => Cases.list({ tab: 'all', state })));
      return lists.flat();
    },
    { pollMs: 15000 },
  );

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const order = (s: string) => NAV_STATES.indexOf(s as (typeof NAV_STATES)[number]);
    return (cases.data ?? [])
      .filter((c) => localeFilter === 'all' || c.patient.preferredLocale === localeFilter)
      .filter((c) => !q || `${c.patient.givenName} ${c.patient.familyName}`.toLowerCase().includes(q))
      .sort((a, b) => order(a.state) - order(b.state) || a.patient.givenName.localeCompare(b.patient.givenName));
  }, [cases.data, localeFilter, query]);

  // Deep link from demo controls / case pages: /patient?case=<id>
  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('case');
    if (id) setSelectedId(id);
  }, []);

  React.useEffect(() => {
    if (!selectedId && rows.length) setSelectedId(rows.find((r) => r.state === 'result_issued')?.id ?? rows[0]!.id);
  }, [rows, selectedId]);

  const selected = (cases.data ?? []).find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
      {/* Patients */}
      <Card className="flex h-[780px] flex-col overflow-hidden">
        <CardHeader title="Patients" description="Open results before acknowledgement" />
        <div className="space-y-2.5 px-5 pb-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name"
              className="h-8 w-full rounded-md border border-line bg-surface ps-8 pe-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-ring/40"
            />
          </label>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by language">
            {(['all', 'ar', 'en', 'ur', 'hi'] as const).map((l) => (
              <button
                key={l}
                role="tab"
                aria-selected={localeFilter === l}
                onClick={() => setLocaleFilter(l)}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors',
                  localeFilter === l ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-ink-muted hover:bg-surface-2 hover:text-ink',
                )}
              >
                {l === 'all' ? 'All' : LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-line">
          {cases.loading && !cases.data ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-5 text-[13px] text-ink-muted">No open results match.</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={cn('flex w-full items-center gap-3 px-5 py-2.5 text-start transition-colors', c.id === selectedId ? 'bg-brand-soft/60' : 'hover:bg-surface-2')}
                  >
                    <Avatar name={`${c.patient.givenName} ${c.patient.familyName}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13.5px] font-medium text-ink">
                          {c.patient.givenName} {c.patient.familyName}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-ink-faint">{LOCALE_LABEL[c.patient.preferredLocale]}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-ink-muted">
                        <span className="truncate">{PROGRAMME_SHORT[c.programmeId] ?? c.programmeId}</span>
                        <StateDot state={c.state} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Phone */}
      <div className="flex justify-center">
        {selected ? (
          <Phone key={selected.id} row={selected} canCoordinate={canCoordinate} onTurn={(t) => setTurns((prev) => ({ ...prev, [t.inbound.id]: t }))} onStateChange={cases.refetch} />
        ) : (
          <PhoneShell>
            <div className="flex h-full items-center justify-center p-8 text-center text-[13px] text-ink-muted">{cases.loading ? 'Loading…' : 'Choose a patient to open their chat.'}</div>
          </PhoneShell>
        )}
      </div>

      {/* Behind the scenes */}
      {selected ? (
        <BehindTheScenes key={selected.id} row={selected} turns={turns} canCoordinate={canCoordinate} onDecided={cases.refetch} roleName={user ? roleLabel(user.role) : ''} />
      ) : (
        <Card className="h-[780px]">
          <CardHeader title="Behind the scenes" description="Every navigator decision, and what it handed to a person" />
        </Card>
      )}
    </div>
  );
}

function StateDot({ state }: { state: string }) {
  const tone = state === 'result_issued' ? 'bg-warn' : state === 'patient_notified' ? 'bg-info' : 'bg-ok';
  const label = state === 'result_issued' ? 'Not contacted' : state === 'patient_notified' ? 'Notified' : 'Acknowledged';
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span className={cn('h-1.5 w-1.5 rounded-full', tone)} />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Phone

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[780px] w-[392px] shrink-0 rounded-[48px] bg-[#0b1220] p-[11px] shadow-[0_30px_60px_-20px_rgba(15,23,42,0.45),0_0_0_1px_rgba(15,23,42,0.08)]">
      <div className="relative flex h-full flex-col overflow-hidden rounded-[38px] bg-[#f3f1ec]">
        <div className="absolute left-1/2 top-2.5 z-20 h-[26px] w-[104px] -translate-x-1/2 rounded-full bg-[#0b1220]" aria-hidden />
        <div className="flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[12.5px] font-semibold text-ink" dir="ltr" aria-hidden>
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <Signal className="h-3.5 w-3.5" />
            <Wifi className="h-3.5 w-3.5" />
            <BatteryFull className="h-4 w-4" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Phone({ row, canCoordinate, onTurn, onStateChange }: { row: CaseRow; canCoordinate: boolean; onTurn: (t: NavigatorTurn) => void; onStateChange: () => void }) {
  const locale = (row.patient.preferredLocale as Locale) ?? 'en';
  const copy = PHONE_COPY[locale] ?? PHONE_COPY.en;
  const rtl = isRtl(locale);
  const history = useQuery(`chat:${row.id}`, () => Messaging.history(row.id), { pollMs: 5000 });
  const [draft, setDraft] = React.useState('');
  const [pending, setPending] = React.useState<string | null>(null); // optimistic patient bubble
  const [typing, setTyping] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const scroller = React.useRef<HTMLDivElement>(null);

  const messages = React.useMemo(() => (history.data ?? []).filter((m) => m.channel === 'web_chat' && m.delivery !== 'failed'), [history.data]);
  const blocked = React.useMemo(() => (history.data ?? []).filter((m) => m.direction === 'outbound' && m.delivery === 'failed' && m.graderVerdict?.passed === false), [history.data]);
  const undelivered = React.useMemo(() => (history.data ?? []).filter((m) => m.direction === 'outbound' && m.delivery === 'failed' && m.graderVerdict?.passed !== false), [history.data]);

  React.useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending, typing]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || pending) return;
    setDraft('');
    setPending(t);
    setTyping(true);
    try {
      const [turn] = await Promise.all([Messaging.send(row.id, t), new Promise((r) => setTimeout(r, 900))]);
      onTurn(turn);
      if (turn.mode !== 'rules') toast.info(turn.mode === 'disabled' ? 'AI navigator is switched off. The message went to the team.' : 'Patient opted out of AI messaging. The message went to the team.');
      await history.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(null);
      setTyping(false);
    }
  }

  async function start() {
    setStarting(true);
    try {
      const res = await Messaging.startNavigator(row.id);
      if (res.blocked) toast.error(`Safety check blocked the message: ${res.verdict?.failedChecks.join(', ')}`);
      else if (res.undelivered) toast.error('Could not reach the patient by web chat or SMS. A coordinator has been asked to phone.');
      else if (res.fallback) toast.success(`Web chat failed; result sent by ${res.fallback.toUpperCase()} instead`);
      else toast.success('Result explained and teach-back question sent');
      await history.refetch();
      onStateChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const empty = !history.loading && messages.length === 0;
  const lastNav = [...messages].reverse().find((m) => m.direction === 'outbound');
  const suggestions = quickReplies(row.programmeId, locale);

  return (
    <div className="flex flex-col items-center gap-3">
      <PhoneShell>
        {/* App bar */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-black/5 bg-white/80 px-3 pb-2.5 pt-1 backdrop-blur" dir={rtl ? 'rtl' : 'ltr'}>
          <ChevronLeft className={cn('h-5 w-5 text-brand', rtl && 'rotate-180')} aria-hidden />
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white">
            <HeartPulse className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[14px] font-semibold text-ink">{copy.team[row.programmeId] ?? 'Screening team'}</div>
            <div className="flex items-center gap-1 truncate text-[11.5px] text-ink-muted">
              <Lock className="h-3 w-3 shrink-0" /> {copy.subtitle}
            </div>
          </div>
        </div>

        {/* Thread */}
        <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4" dir={rtl ? 'rtl' : 'ltr'}>
          {history.loading && !history.data ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-3/4" />
              <Skeleton className="ms-auto h-10 w-1/2" />
            </div>
          ) : empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center" dir="ltr">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand shadow-sm">
                <HeartPulse className="h-6 w-6" />
              </span>
              <p className="text-[13px] font-medium text-ink">{undelivered.length ? 'Message not delivered' : 'No messages yet'}</p>
              <p className="text-[12.5px] leading-5 text-ink-muted">
                {undelivered.length
                  ? 'Web chat and SMS both failed, so a coordinator has been asked to phone the patient. You can try again once the channel is back.'
                  : row.state === 'result_issued'
                  ? 'The result has arrived but the patient has not been told. Start the navigator to send the approved explanation in ' + (LOCALE_LABEL[locale] ?? locale) + '.'
                  : 'This patient was contacted on another channel.'}
              </p>
              {row.state === 'result_issued' &&
                (canCoordinate ? (
                  <Button size="sm" onClick={start} loading={starting}>
                    <Play className="h-3.5 w-3.5" /> {undelivered.length ? 'Try again' : 'Send result & start navigator'}
                  </Button>
                ) : (
                  <p className="text-[12px] text-ink-faint">Sign in as a coordinator to start it.</p>
                ))}
            </div>
          ) : (
            <>
              <div className="flex justify-center pb-1">
                <span className="rounded-full bg-black/5 px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">{copy.today}</span>
              </div>
              {messages.map((m, i) => (
                <Bubble key={m.id} m={m} grouped={messages[i - 1]?.direction === m.direction} />
              ))}
              {pending && <Bubble m={{ id: 'pending', direction: 'inbound', text: pending, locale, delivery: 'sent', graderVerdict: null, templateId: null, createdAt: new Date().toISOString(), sentAt: null } as unknown as ChatMessage} grouped={messages.at(-1)?.direction === 'inbound'} pending />}
              {typing && (
                <div className="flex items-center gap-2 ps-1 pt-1 animate-fade" aria-live="polite" aria-label={copy.typing}>
                  <span className="flex h-8 items-center gap-1 rounded-2xl rounded-ss-md bg-white px-3 shadow-sm">
                    <span className="typing-dot" />
                    <span className="typing-dot [animation-delay:150ms]" />
                    <span className="typing-dot [animation-delay:300ms]" />
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Composer */}
        <form
          className="flex shrink-0 items-center gap-2 border-t border-black/5 bg-white/90 px-3 py-2.5"
          dir={rtl ? 'rtl' : 'ltr'}
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            dir="auto"
            disabled={empty}
            placeholder={copy.placeholder}
            aria-label="Patient message"
            className="h-10 min-w-0 flex-1 rounded-full border border-black/10 bg-[#f6f5f2] px-4 text-[14px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!draft.trim() || !!pending}
            aria-label="Send"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm transition-[transform,opacity] active:scale-95 disabled:opacity-40"
          >
            <SendHorizontal className={cn('h-[18px] w-[18px]', rtl && 'rotate-180')} />
          </button>
        </form>
      </PhoneShell>

      {/* Operator tray: one-tap patient replies for the demo */}
      <div className="w-[392px]">
        <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Reply as the patient
          </span>
          <span className="flex items-center gap-1 normal-case tracking-normal">
            <Languages className="h-3.5 w-3.5" /> {LOCALE_LABEL[locale]}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <Tooltip key={s.label} content={<span dir="auto">{s.text}</span>}>
              <button
                disabled={empty || !!pending || !lastNav}
                onClick={() => void send(s.text)}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 shadow-sm transition-colors hover:border-brand hover:text-brand-strong disabled:opacity-40"
              >
                {s.label}
              </button>
            </Tooltip>
          ))}
        </div>
        {undelivered.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warn">
            <CircleAlert className="h-3.5 w-3.5" /> {undelivered.length} message{undelivered.length > 1 ? 's' : ''} not delivered ({[...new Set(undelivered.map((m) => m.channel.replace('_', ' ')))].join(', ')}); the team was asked to phone
          </p>
        )}
        {blocked.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-danger">
            <CircleAlert className="h-3.5 w-3.5" /> {blocked.length} message{blocked.length > 1 ? 's' : ''} blocked by the safety check and never sent
          </p>
        )}
      </div>
    </div>
  );
}

function Bubble({ m, grouped, pending }: { m: ChatMessage; grouped: boolean; pending?: boolean }) {
  const mine = m.direction === 'inbound'; // the patient is holding the phone
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(m.sentAt ?? m.createdAt));
  const v = m.graderVerdict;
  return (
    <div className={cn('flex animate-in-up', mine ? 'justify-end' : 'justify-start', grouped ? 'pt-0' : 'pt-1.5')}>
      <div
        className={cn(
          'max-w-[82%] px-3 pb-1.5 pt-2 text-[14px] leading-[1.45] shadow-sm',
          mine ? 'rounded-2xl rounded-ee-md bg-brand text-white' : 'rounded-2xl rounded-ss-md bg-white text-ink',
          pending && 'opacity-70',
        )}
      >
        <p dir="auto" className="whitespace-pre-line break-words text-start">
          {m.text.trim()}
        </p>
        <div className={cn('mt-1 flex items-center justify-end gap-1 text-[10.5px]', mine ? 'text-white/75' : 'text-ink-faint')} dir="ltr">
          {!mine && v && (
            <Tooltip
              content={
                <span className="block">
                  <span className="block font-semibold">Safety check passed ({v.checks.filter((c) => c.passed).length}/{v.checks.length})</span>
                  <span className="block text-white/80">{v.mode === 'rules' ? 'Rules' : 'Rules + model'} · {v.version}</span>
                  <span className="block text-white/80">{m.templateId?.startsWith('nav:') ? 'Navigator script' : 'Approved template'}: {m.templateId}</span>
                </span>
              }
            >
              <span className="inline-flex cursor-help items-center gap-0.5 text-ok">
                <ShieldCheck className="h-3 w-3" />
              </span>
            </Tooltip>
          )}
          <span>{time}</span>
          {mine && (pending ? <Check className="h-3 w-3" /> : <CheckCheck className="h-3 w-3" />)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Behind the scenes

function BehindTheScenes({ row, turns, canCoordinate, onDecided, roleName }: { row: CaseRow; turns: Record<string, NavigatorTurn>; canCoordinate: boolean; onDecided: () => void; roleName: string }) {
  const detail = useQuery(`case:${row.id}`, () => Cases.get(row.id), { pollMs: 5000 });
  const history = useQuery(`chat:${row.id}:trace`, () => Messaging.history(row.id), { pollMs: 5000 });
  const [deciding, setDeciding] = React.useState<string | null>(null);

  const decisions = React.useMemo(() => {
    const msgs = (history.data ?? []).filter((m) => m.channel === 'web_chat');
    const out: Array<{ inbound: ChatMessage; intent: ReturnType<typeof intentFromTemplate>; replyKeys: string[] }> = [];
    msgs.forEach((m, i) => {
      if (m.direction !== 'inbound') return;
      const replies: ChatMessage[] = [];
      for (let j = i + 1; j < msgs.length && msgs[j]!.direction === 'outbound'; j++) replies.push(msgs[j]!);
      out.push({ inbound: m, intent: replies.map((r) => intentFromTemplate(r.templateId)).find(Boolean) ?? null, replyKeys: replies.map((r) => r.templateId ?? '') });
    });
    return out.reverse();
  }, [history.data]);

  const d = detail.data;
  const pendingAck = d?.proposals.filter((p) => p.kind === 'acknowledgement' && p.status === 'pending') ?? [];

  async function decide(id: string, decision: 'accepted' | 'rejected') {
    setDeciding(id + decision);
    try {
      await Proposals.decide(id, decision);
      if (decision === 'accepted') toast.success('Acknowledgement confirmed. Case handed to primary care with a named owner.');
      else toast('Proposal rejected. The case stays with the coordinator.');
      await detail.refetch();
      onDecided();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeciding(null);
    }
  }

  return (
    <Card className="flex h-[780px] flex-col overflow-hidden">
      <CardHeader
        title="Behind the scenes"
        description="Each navigator decision and what it handed to a person"
        action={
          <Link href={`/coordinator/${row.id}`} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
            Case <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        {/* Case strip */}
        <div className="rounded-lg border border-line bg-surface-2/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13.5px] font-semibold text-ink">
              {row.patient.givenName} {row.patient.familyName}
            </span>
            {d ? <StateBadge state={d.state} /> : <Skeleton className="h-5 w-24" />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
            <span>{PROGRAMME_SHORT[row.programmeId]}</span>
            <span>{LOCALE_LABEL[row.patient.preferredLocale]}</span>
            <span className="flex items-center gap-1">
              <UserRound className="h-3 w-3" /> {d?.owner ? `${d.owner.displayName} · ${roleLabel(d.owner.role)}` : '—'}
            </span>
          </div>
        </div>

        {/* Human decision */}
        {pendingAck.length > 0 && (
          <section className="animate-in-up rounded-lg border border-ai/25 bg-ai-soft/60 p-3.5">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ai">
              <Bot className="h-4 w-4" /> Proposal awaiting a coordinator
            </div>
            {pendingAck.map((p) => {
              const tb = (p.payload as { teachBack?: { answer?: string; matched?: string[] } }).teachBack;
              return (
                <div key={p.id} className="mt-2 space-y-2.5">
                  <p className="text-[12.5px] leading-5 text-ink-2">
                    Teach-back passed. Proposed: move to <strong>Acknowledged</strong> and hand to primary care. The navigator cannot do this itself.
                  </p>
                  {tb?.answer && (
                    <blockquote dir="auto" className="rounded-md border-s-2 border-ai/40 bg-white/70 px-2.5 py-1.5 text-[12.5px] text-ink">
                      “{tb.answer}”
                    </blockquote>
                  )}
                  {tb?.matched && tb.matched.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tb.matched.map((k) => (
                        <Badge key={k} tone="ai" className="text-[11px]">
                          <span dir="auto">{k}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {canCoordinate ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decide(p.id, 'accepted')} loading={deciding === p.id + 'accepted'} disabled={!!deciding}>
                        <Check className="h-3.5 w-3.5" /> Confirm & hand off
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void decide(p.id, 'rejected')} loading={deciding === p.id + 'rejected'} disabled={!!deciding}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[12px] text-ink-muted">Signed in as {roleName}. A coordinator decides.</p>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {/* Escalations */}
        {d && d.escalations.length > 0 && (
          <section>
            <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">Open escalations</h4>
            <ul className="space-y-1.5">
              {d.escalations.map((e) => {
                const esc = e as unknown as { id: string; ruleId: string; reason: string; targetRole: string; priority: string; suggestedAction: string | null };
                return (
                  <li key={esc.id} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2">
                    <CircleAlert className={cn('mt-0.5 h-4 w-4 shrink-0', esc.priority === 'urgent' ? 'text-danger' : 'text-warn')} />
                    <span className="min-w-0 text-[12.5px] leading-5">
                      <span className="block font-medium text-ink">{esc.reason}</span>
                      <span className="block text-ink-muted">
                        → {roleLabel(esc.targetRole)}
                        {esc.priority === 'urgent' && <span className="font-semibold text-danger"> · urgent</span>}
                        {esc.suggestedAction && <> · {esc.suggestedAction.replace(/_/g, ' ')}</>}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Decision log */}
        <section>
          <h4 className="mb-2 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">Navigator decisions</h4>
          {decisions.length === 0 ? (
            <p className="text-[12.5px] leading-5 text-ink-muted">When the patient replies, each message is checked for emergencies and distress first, then graded for teach-back. Decisions appear here.</p>
          ) : (
            <ol className="relative space-y-3 border-s border-line ps-4">
              {decisions.map(({ inbound, intent }) => {
                const meta = intent ? INTENT_META[intent] : null;
                const turn = turns[inbound.id];
                return (
                  <li key={inbound.id} className="relative animate-in-up">
                    <span className={cn('absolute -start-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface', meta ? TONE_DOT[meta.tone] : 'bg-line-strong')} />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <Badge tone="neutral">Received</Badge>}
                      <span className="text-[11px] text-ink-faint">{new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(inbound.createdAt))}</span>
                    </div>
                    <p dir="auto" className="mt-1 line-clamp-2 text-start text-[12.5px] text-ink">
                      “{inbound.text}”
                    </p>
                    {meta && <p className="mt-0.5 text-[12px] text-ink-muted">{meta.outcome}</p>}
                    {turn && turn.matched.length > 0 && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="text-[11px] text-ink-faint">matched</span>
                        {turn.matched.map((k) => (
                          <span key={k} dir="auto" className="rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink-2">
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <p className="flex items-start gap-2 rounded-lg bg-surface-2/70 p-3 text-[12px] leading-5 text-ink-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          Every reply comes from a clinician-approved script and passes the safety check before it is sent. The navigator works without an AI model; it never diagnoses, and it cannot change the case.
        </p>
      </div>
    </Card>
  );
}

const TONE_DOT: Record<string, string> = {
  danger: 'bg-danger',
  warn: 'bg-warn',
  info: 'bg-info',
  ok: 'bg-ok',
  brand: 'bg-brand',
  neutral: 'bg-ink-faint',
  ai: 'bg-ai',
};
