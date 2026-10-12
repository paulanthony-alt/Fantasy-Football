import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded font-semibold leading-none [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'bg-surface-3 text-fg-muted',
      accent: 'bg-accent/12 text-accent',
      pos: 'bg-pos/12 text-pos',
      neg: 'bg-neg/12 text-neg',
      warn: 'bg-warn/14 text-warn',
      outline: 'border border-border text-fg-muted',
    },
    size: { sm: 'h-[18px] px-1.5 text-2xs', md: 'h-5 px-2 text-xs' },
  },
  defaultVariants: { tone: 'neutral', size: 'sm' },
});

export function Badge({ className, tone, size, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
