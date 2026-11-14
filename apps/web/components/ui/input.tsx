'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-sm transition placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand-ring/60 focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-[88px] w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm transition placeholder:text-ink-faint hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand-ring/60 focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span> : hint ? <span className="mt-1 block text-[12px] text-ink-muted">{hint}</span> : null}
    </label>
  );
}

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink shadow-sm transition hover:border-line-strong focus:border-brand focus:ring-2 focus:ring-brand-ring/60 focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
