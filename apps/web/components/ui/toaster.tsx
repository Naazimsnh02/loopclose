'use client';

import { Toaster as Sonner, toast } from 'sonner';

export { toast };

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast: '!rounded-lg !border !border-line !bg-surface !text-ink !shadow-pop',
          title: '!text-[13.5px] !font-medium',
          description: '!text-[12.5px] !text-ink-muted',
          success: '[&_svg]:!text-ok',
          error: '[&_svg]:!text-danger',
          warning: '[&_svg]:!text-warn',
        },
      }}
    />
  );
}
