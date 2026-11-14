'use client';

import * as React from 'react';
import { Activity, ArrowRight, ShieldCheck } from 'lucide-react';
import { Auth, type DemoUser } from '@/lib/api';
import { useAuth, roleLabel } from '@/lib/auth';
import { useQuery } from '@/lib/use-query';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const GROUPS: Array<{ title: string; kinds: string[] }> = [
  { title: 'Programme', kinds: ['PROGRAMME_AUTHORITY'] },
  { title: 'Primary care', kinds: ['PRIMARY_CARE'] },
  { title: 'Specialists & hospital', kinds: ['SPECIALIST', 'HOSPITAL'] },
];

/** Persona picker (E2.5 demo auth). Production replaces this screen with the IdP redirect. */
export function LoginScreen() {
  const { signIn } = useAuth();
  const users = useQuery('demo-users', Auth.demoUsers);
  const [busy, setBusy] = React.useState<string | null>(null);

  async function pick(u: DemoUser) {
    setBusy(u.id);
    try {
      await signIn(u.email);
      toast.success(`Signed in as ${u.displayName}`, { description: roleLabel(u.role) });
    } catch (e) {
      toast.error('Sign-in failed', { description: e instanceof Error ? e.message : 'Is the API running on :4000?' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="relative hidden overflow-hidden bg-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(640px 640px at 100% 0%, color-mix(in oklab, var(--color-brand) 45%, transparent), transparent 70%), radial-gradient(520px 520px at 0% 100%, color-mix(in oklab, var(--color-ai) 35%, transparent), transparent 70%)' }}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Activity className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">LoopClose</span>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-tight">
            Every actionable result has an owner, a clock, and a documented ending.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            Closed-loop screening across labs, primary care and specialists. AI proposes; people decide.
          </p>
          <ul className="mt-8 space-y-3 text-[13.5px] text-white/80">
            {['Ownership that is never null', 'SLA clocks with human escalation', 'Evidence-gated closure', 'Audited, kill-switchable AI'].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-brand-ring" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-[12px] text-white/50">Prototype · synthetic data only · Future Health Digital Innovation Challenge 2026</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-2xl animate-in-up">
          <h2 className="text-[22px] font-semibold tracking-tight text-ink">Choose a persona</h2>
          <p className="mt-1 text-[13.5px] text-ink-muted">Demo sign-in — each persona sees the loop from a different seat.</p>

          {users.loading ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[68px]" />
              ))}
            </div>
          ) : users.error ? (
            <div className="mt-8 rounded-lg border border-danger/20 bg-danger-soft p-4 text-[13px] text-danger">
              Could not reach the API ({users.error.message}). Start it with <code className="font-mono">pnpm dev</code> and refresh.
            </div>
          ) : (
            <div className="mt-8 space-y-7">
              {GROUPS.map((g) => {
                const list = (users.data ?? []).filter((u) => g.kinds.includes(u.organization.kind));
                if (!list.length) return null;
                return (
                  <div key={g.title}>
                    <h3 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-faint">{g.title}</h3>
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {list.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => pick(u)}
                          disabled={!!busy}
                          className={cn(
                            'group flex items-center gap-3 rounded-lg border border-line bg-surface p-3 text-start shadow-card transition-all duration-150 hover:-translate-y-px hover:border-brand-ring hover:shadow-pop disabled:opacity-60',
                            busy === u.id && 'border-brand ring-2 ring-brand-ring/60',
                          )}
                        >
                          <Avatar name={u.displayName} size="lg" />
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate text-[13.5px] font-medium text-ink">{u.displayName.replace(/\s*\(.*\)/, '')}</span>
                            <span className="block truncate text-[12px] text-ink-2">{roleLabel(u.role)}</span>
                            <span className="block truncate text-[11.5px] text-ink-muted">{u.organization.name.replace(' (synthetic)', '')}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand rtl:rotate-180" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
