import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3 grid size-11 place-items-center rounded-xl border border-border bg-surface-2 text-fg-subtle [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** "Updated 3m ago · Source" with an optional refresh. Re-renders every 30s. */
export function LastUpdated({ at, source, onRefresh, refreshing, className }: { at?: number; source?: string; onRefresh?: () => void; refreshing?: boolean; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!at) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-2xs text-fg-subtle', className)}>
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full rounded-full bg-pos opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-pos" />
      </span>
      <Tooltip content={new Date(at).toLocaleString()}>
        <span>Updated {timeAgo(at)}</span>
      </Tooltip>
      {source && <span className="hidden truncate sm:inline">· {source}</span>}
      {onRefresh && (
        <button onClick={onRefresh} className="rounded p-0.5 transition-colors hover:bg-surface-2 hover:text-fg" aria-label="Refresh">
          <RefreshCw className={cn('size-3', refreshing && 'animate-spin')} />
        </button>
      )}
    </span>
  );
}

export function CardSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-1/4" />
          </div>
          <Skeleton className="h-5 w-12" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
