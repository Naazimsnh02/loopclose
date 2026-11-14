import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[12px] font-medium leading-5 whitespace-nowrap', {
  variants: {
    tone: {
      neutral: 'border-line bg-surface-2 text-ink-2',
      brand: 'border-transparent bg-brand-soft text-brand-strong',
      ok: 'border-transparent bg-ok-soft text-ok',
      warn: 'border-transparent bg-warn-soft text-warn',
      danger: 'border-transparent bg-danger-soft text-danger',
      info: 'border-transparent bg-info-soft text-info',
      ai: 'border-transparent bg-ai-soft text-ai',
      outline: 'border-line-strong bg-transparent text-ink-2',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />}
      {children}
    </span>
  );
}
