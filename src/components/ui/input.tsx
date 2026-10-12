import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }>(({ className, icon, ...props }, ref) => (
  <div className={cn('relative flex items-center', className)}>
    {icon && <span className="pointer-events-none absolute left-2.5 text-fg-subtle [&_svg]:size-4">{icon}</span>}
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-fg-subtle transition-colors hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
        icon && 'pl-8',
      )}
      {...props}
    />
  </div>
));
Input.displayName = 'Input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-fg-muted', className)} {...props} />;
}
