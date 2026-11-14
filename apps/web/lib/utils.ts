import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceStrict, formatDistanceToNowStrict, isPast } from 'date-fns';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');

export const humanize = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export const relative = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Math.abs(Date.now() - d.getTime()) < 45_000 ? 'just now' : formatDistanceToNowStrict(d, { addSuffix: true });
};

/** "in 3h" / "2d overdue" style SLA label. */
export function slaLabel(deadline: string | null | undefined) {
  if (!deadline) return { text: 'No SLA', status: 'none' as const };
  const d = new Date(deadline);
  const dist = formatDistanceStrict(d, new Date());
  if (isPast(d)) return { text: `${dist} overdue`, status: 'breached' as const };
  return { text: `${dist} left`, status: 'ok' as const };
}

export function slaStatus(enteredAt: string, deadline: string | null | undefined): 'none' | 'ok' | 'warn' | 'breached' {
  if (!deadline) return 'none';
  const start = new Date(enteredAt).getTime();
  const end = new Date(deadline).getTime();
  const now = Date.now();
  if (now >= end) return 'breached';
  if ((now - start) / Math.max(1, end - start) >= 0.7) return 'warn';
  return 'ok';
}

export const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

export const fmtDay = (iso: string) => new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
