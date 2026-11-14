'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  tone?: 'neutral' | 'danger' | 'warn' | 'brand';
}

/** Underline tabs with optional count pills; accessible (roving tab index via arrow keys). */
export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div role="tablist" aria-orientation="horizontal" className={cn('flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line scroll-thin', className)}>
      {items.map((it, i) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const dir = e.key === 'ArrowRight' ? 1 : -1;
              const next = (i + dir + items.length) % items.length;
              refs.current[next]?.focus();
              onChange(items[next]!.value);
            }}
            className={cn(
              'relative -mb-px flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium transition-colors',
              active ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {it.label}
            {it.count !== undefined && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 py-px text-[11px] font-semibold leading-4',
                  it.tone === 'danger' && it.count > 0 ? 'bg-danger-soft text-danger' : it.tone === 'warn' && it.count > 0 ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-ink-muted',
                )}
              >
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
