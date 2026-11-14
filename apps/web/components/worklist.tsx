'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Inbox, RefreshCw, Search } from 'lucide-react';
import { Cases, Programmes, type CaseRow, type WorklistTab } from '@/lib/api';
import { useQuery } from '@/lib/use-query';
import { cn, relative } from '@/lib/utils';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { RiskPill, SlaChip, StateBadge, TierBadge, LOCALE_LABEL } from '@/components/domain';
import { roleLabel } from '@/lib/auth';

const TAB_META: Record<WorklistTab, { label: string; tone?: TabItem<WorklistTab>['tone']; empty: string }> = {
  overdue: { label: 'Overdue', tone: 'danger', empty: 'Nothing is past its SLA. The loop is holding.' },
  unassigned: { label: 'Unassigned', tone: 'warn', empty: 'Every open case has an owner.' },
  rejected: { label: 'Rejected referrals', tone: 'warn', empty: 'No referrals bounced back.' },
  stalled: { label: 'Stalled', empty: 'No case has gone quiet.' },
  at_risk: { label: 'At risk', tone: 'danger', empty: 'No patients currently flagged red by the risk model.' },
  all: { label: 'All open', empty: 'No open cases match these filters.' },
};
const TAB_DESCRIPTION: Record<WorklistTab, string> = {
  overdue: 'Past the SLA deadline for their current step. Escalations have been raised to the step owner’s lead.',
  unassigned: 'Open cases with no accountable owner. Ownership must never be null.',
  rejected: 'Referrals bounced back by the receiving specialist service.',
  stalled: 'No activity for longer than expected for the step.',
  at_risk: 'Patients the risk model predicts are likely to drop out of the pathway.',
  all: 'Every open case across programmes.',
};

export const shortProgramme = (id: string, name: string) => (id === 'colorectal-fit' ? 'FIT colorectal' : id === 'breast-birads' ? 'Mammography' : name);

const TAB_ORDER: WorklistTab[] = ['overdue', 'unassigned', 'rejected', 'stalled', 'at_risk', 'all'];

export function Worklist({ basePath, defaultTab = 'overdue', title }: { basePath: string; defaultTab?: WorklistTab; title?: string }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<WorklistTab>(defaultTab);
  const [programmeId, setProgramme] = React.useState('');
  const [tier, setTier] = React.useState('');
  const [q, setQ] = React.useState('');

  const filters = React.useMemo(() => ({ programmeId: programmeId || undefined, tier: tier || undefined }), [programmeId, tier]);
  const programmes = useQuery('programmes', Programmes.list);
  const summary = useQuery(`summary:${programmeId}:${tier}`, () => Cases.summary(filters), { pollMs: 30_000 });
  const rows = useQuery(`cases:${tab}:${programmeId}:${tier}`, () => Cases.list({ tab, ...filters }), { pollMs: 30_000 });

  const filtered = React.useMemo(() => {
    const data = rows.data ?? [];
    if (!q.trim()) return data;
    const needle = q.trim().toLowerCase();
    return data.filter((c) => `${c.patient.givenName} ${c.patient.familyName} ${c.id} ${c.owner?.displayName ?? ''} ${c.state}`.toLowerCase().includes(needle));
  }, [rows.data, q]);

  const items: TabItem<WorklistTab>[] = TAB_ORDER.map((t) => ({ value: t, label: TAB_META[t].label, count: summary.data?.[t], tone: TAB_META[t].tone }));

  function refresh() {
    void summary.refetch();
    void rows.refetch();
  }

  return (
    <div className="animate-fade">
      <Tabs items={items} value={tab} onChange={setTab} />

      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <p className="text-[13px] text-ink-muted">{TAB_DESCRIPTION[tab]}</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patient, owner, case…" className="h-8 w-[240px] ps-8 text-[13px]" aria-label="Search worklist" />
            </div>
            <NativeSelect value={programmeId} onChange={(e) => setProgramme(e.target.value)} className="h-8 w-[160px] text-[13px]" aria-label="Programme">
              <option value="">All programmes</option>
              {(programmes.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {shortProgramme(p.id, p.name)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={tier} onChange={(e) => setTier(e.target.value)} className="h-8 w-[110px] text-[13px]" aria-label="Tier">
              <option value="">All tiers</option>
              <option value="urgent">Urgent</option>
              <option value="priority">Priority</option>
              <option value="routine">Routine</option>
            </NativeSelect>
            <Button variant="secondary" size="icon-sm" onClick={refresh} aria-label="Refresh" title="Refresh">
              <RefreshCw className={cn('h-3.5 w-3.5', (rows.refreshing || summary.refreshing) && 'animate-spin')} />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-[minmax(200px,1.5fr)_minmax(150px,1.1fr)_90px_minmax(120px,0.9fr)_minmax(150px,1fr)_110px_32px] items-center gap-4 border-b border-line bg-surface-2/60 px-5 py-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">
          <span>Patient</span>
          <span>State</span>
          <span>Tier</span>
          <span>SLA</span>
          <span>Owner</span>
          <span>Risk</span>
          <span />
        </div>

        {rows.loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : rows.error ? (
          <EmptyState icon={Inbox} title="Could not load the worklist" description={rows.error.message} action={<Button variant="secondary" onClick={refresh}>Try again</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Inbox} title={q ? 'No matches' : TAB_META[tab].empty} description={q ? `Nothing in “${TAB_META[tab].label}” matches “${q}”.` : title ? undefined : 'Switch tabs or clear filters to see more.'} />
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((c, i) => (
              <WorklistRow key={c.id} c={c} programmeName={shortProgramme(c.programmeId, programmes.data?.find((p) => p.id === c.programmeId)?.name ?? c.programmeId)} href={`${basePath}/${c.id}`} index={i} onOpen={() => router.push(`${basePath}/${c.id}`)} />
            ))}
          </ul>
        )}
        {!rows.loading && !rows.error && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[12px] text-ink-muted">
            <span className="tabular">
              {filtered.length} case{filtered.length === 1 ? '' : 's'}
              {rows.data && filtered.length !== rows.data.length ? ` of ${rows.data.length}` : ''} · sorted by SLA deadline
            </span>
            <span className={cn('transition-opacity', rows.refreshing ? 'opacity-100' : 'opacity-0')}>Refreshing…</span>
          </div>
        )}
      </Card>
    </div>
  );
}

function WorklistRow({ c, programmeName, href, index, onOpen }: { c: CaseRow; programmeName: string; href: string; index: number; onOpen: () => void }) {
  return (
    <li
      className="group grid cursor-pointer grid-cols-[minmax(200px,1.5fr)_minmax(150px,1.1fr)_90px_minmax(120px,0.9fr)_minmax(150px,1fr)_110px_32px] items-center gap-4 px-5 py-3 transition-colors hover:bg-brand-soft/40 animate-in-up"
      style={{ animationDelay: `${Math.min(index, 12) * 18}ms` }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open case for ${c.patient.givenName} ${c.patient.familyName}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={`${c.patient.givenName} ${c.patient.familyName}`} />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13.5px] font-medium text-ink">
            {c.patient.givenName} {c.patient.familyName}
          </div>
          <div className="truncate text-[12px] text-ink-muted">
            {LOCALE_LABEL[c.patient.preferredLocale] ?? c.patient.preferredLocale} · {programmeName} · {relative(c.createdAt)}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <StateBadge state={c.state} />
        {(c.referralDeclineCount > 0 || c.noShowCount > 0) && (
          <div className="mt-1 text-[11.5px] text-ink-muted">
            {c.referralDeclineCount > 0 && `${c.referralDeclineCount} referral decline${c.referralDeclineCount > 1 ? 's' : ''}`}
            {c.referralDeclineCount > 0 && c.noShowCount > 0 && ' · '}
            {c.noShowCount > 0 && `${c.noShowCount} no-show${c.noShowCount > 1 ? 's' : ''}`}
          </div>
        )}
      </div>
      <div>
        <TierBadge tier={c.tier} />
      </div>
      <div>
        <SlaChip enteredAt={c.enteredStateAt} deadline={c.slaDeadlineAt} />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        {c.owner ? (
          <>
            <Avatar name={c.owner.displayName} size="sm" />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] text-ink">{c.owner.displayName.replace(/\s*\(.*\)/, '')}</div>
              <div className="truncate text-[11.5px] text-ink-muted">{roleLabel(c.owner.role)}</div>
            </div>
          </>
        ) : (
          <span className="rounded-md bg-warn-soft px-2 py-0.5 text-[12px] font-medium text-warn">Unassigned</span>
        )}
      </div>
      <div>
        <RiskPill tier={c.riskTier} score={c.riskScore} />
      </div>
      <Link href={href} className="justify-self-end text-ink-faint transition group-hover:text-brand" aria-hidden tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <ChevronRight className="h-4 w-4 rtl:rotate-180" />
      </Link>
    </li>
  );
}
