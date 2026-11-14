import { cn, initials } from '@/lib/utils';

const palette = ['bg-brand-soft text-brand-strong', 'bg-info-soft text-info', 'bg-ai-soft text-ai', 'bg-warn-soft text-warn', 'bg-ok-soft text-ok'];

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const hue = palette[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight',
        size === 'sm' && 'h-6 w-6 text-[10px]',
        size === 'md' && 'h-8 w-8 text-[12px]',
        size === 'lg' && 'h-10 w-10 text-[14px]',
        hue,
        className,
      )}
      title={name}
      aria-label={name}
    >
      {initials(name)}
    </span>
  );
}
