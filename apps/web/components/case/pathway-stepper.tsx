'use client';

import { Check } from 'lucide-react';
import type { Programme } from '@/lib/api';
import { cn } from '@/lib/utils';
import { stateLabel } from '@/components/domain';
import { roleLabel } from '@/lib/auth';
import { Tooltip } from '@/components/ui/tooltip';

/** Horizontal pathway stepper derived from the programme definition (not hard-coded). */
export function PathwayStepper({ programme, current }: { programme: Programme; current: string }) {
  const steps = programme.states.filter((s) => !programme.terminalStates.includes(s.id) || s.id === 'closed');
  const idx = steps.findIndex((s) => s.id === current);
  const exited = idx === -1;
  return (
    <ol className="flex items-center gap-1 overflow-x-auto scroll-thin pb-1" aria-label="Pathway progress">
      {steps.map((s, i) => {
        const done = !exited && i < idx;
        const active = s.id === current;
        return (
          <li key={s.id} className="flex items-center">
            <Tooltip content={`${stateLabel(s.id)}${s.ownerRole ? ` · ${roleLabel(s.ownerRole)}` : ''}`}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold transition-colors',
                    done && 'border-brand bg-brand text-white',
                    active && 'border-brand bg-surface text-brand ring-4 ring-brand-ring/40',
                    !done && !active && 'border-line bg-surface text-ink-faint',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn('w-[88px] text-center text-[10.5px] leading-[1.2] line-clamp-2', active ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-faint')}>{stateLabel(s.id)}</span>
              </div>
            </Tooltip>
            {i < steps.length - 1 && <span className={cn('mx-1 mb-4 h-px w-6 shrink-0 sm:w-8', done ? 'bg-brand' : 'bg-line')} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
