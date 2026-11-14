'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-fade" />
      <DialogPrimitive.Content
        className={cn(
          'fixed start-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-surface shadow-pop outline-none data-[state=open]:animate-in-up rtl:translate-x-1/2',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <div>
            <DialogPrimitive.Title className="text-[16px] font-semibold tracking-tight text-ink">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] text-ink-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">Dialog</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="-me-2 -mt-1 rounded-md p-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink" aria-label="Close">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </div>
        {children && <div className="px-6 py-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/60 px-6 py-3 rounded-b-xl">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
