'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Activity, BarChart3, ChevronsUpDown, ClipboardList, FlaskConical, LogOut, MessageSquareHeart, Settings2, Stethoscope, CalendarClock } from 'lucide-react';
import { useAuth, roleLabel } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { LoginScreen } from '@/components/login-screen';

const nav = [
  { href: '/coordinator', label: 'Worklist', icon: ClipboardList, roles: ['coordinator', 'coordinator_lead', 'programme_manager', 'admin', 'on_call_clinician'] },
  { href: '/clinician', label: 'Clinician inbox', icon: Stethoscope, roles: ['phc_clinician', 'phc_lead', 'specialist', 'specialist_lead', 'breast_radiologist', 'breast_clinic', 'treating_clinician', 'admin', 'programme_manager'] },
  { href: '/scheduler', label: 'Scheduler', icon: CalendarClock, roles: ['specialist_scheduler', 'breast_clinic_scheduler', 'specialist_lead', 'admin', 'programme_manager'] },
  { href: '/patient', label: 'Patient chat', icon: MessageSquareHeart, roles: ['*'] },
  { href: '/dashboard', label: 'Dashboard', icon: BarChart3, roles: ['*'] },
  { href: '/admin', label: 'Admin', icon: Settings2, roles: ['admin', 'programme_manager'] },
  { href: '/demo', label: 'Demo controls', icon: FlaskConical, roles: ['*'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const pathname = usePathname();

  if (!ready) return <div className="min-h-screen bg-paper" aria-busy />;
  if (!user) return <LoginScreen />;

  const visible = nav.filter((n) => n.roles.includes('*') || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-e border-line bg-surface">
        <Link href="/" className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white shadow-sm">
            <Activity className="h-4.5 w-4.5" strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-ink">LoopClose</span>
            <span className="block text-[11px] text-ink-muted">Screening-to-care</span>
          </span>
        </Link>

        <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-3" aria-label="Primary">
          {visible.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/');
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium transition-colors',
                  active ? 'bg-brand-soft text-brand-strong' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                )}
              >
                <n.icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand' : 'text-ink-faint group-hover:text-ink-muted')} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-md p-2 text-start transition hover:bg-surface-2" aria-label="Account menu">
                <Avatar name={user.displayName} />
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-medium text-ink">{user.displayName.replace(/\s*\(.*\)/, '')}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{roleLabel(user.role)}</span>
                </span>
                <ChevronsUpDown className="h-4 w-4 text-ink-faint" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content side="top" align="start" sideOffset={8} className="z-50 w-[216px] rounded-lg border border-line bg-surface p-1 shadow-pop animate-in-up">
                <div className="px-2.5 py-2 text-[12px] text-ink-muted">
                  Signed in as <span className="font-medium text-ink">{user.displayName}</span>
                </div>
                <DropdownMenu.Separator className="my-1 h-px bg-line" />
                <DropdownMenu.Item onSelect={signOut} className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink">
                  <LogOut className="h-4 w-4" /> Switch persona
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <p className="mt-2 px-2 text-[10.5px] leading-4 text-ink-faint">Synthetic data · demo environment</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1400px] px-8 py-7">{children}</div>
      </main>
    </div>
  );
}
