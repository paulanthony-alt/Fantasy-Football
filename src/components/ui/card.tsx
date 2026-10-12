import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }>(({ className, interactive, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-lg border border-border bg-surface-1 shadow-e1', interactive && 'card-hover', className)} {...props} />
));
Card.displayName = 'Card';

export function CardHeader({ className, title, subtitle, icon, actions, children }: { className?: string; title?: React.ReactNode; subtitle?: React.ReactNode; icon?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cn('flex min-h-[52px] items-center gap-3 border-b border-border px-4 py-3', className)}>
      {icon && <div className="grid size-7 shrink-0 place-items-center rounded-md bg-accent/10 text-accent [&_svg]:size-4">{icon}</div>}
      <div className="min-w-0 flex-1">
        {title && <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>}
        {subtitle && <p className="truncate text-xs text-fg-subtle">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export const CardBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn('p-4', className)} {...props} />;
