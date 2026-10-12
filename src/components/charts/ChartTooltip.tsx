import type { TooltipProps } from 'recharts';
import { cn } from '@/lib/utils';

type Row = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/** Consistent tooltip surface for every chart. */
export function ChartTooltip({ active, payload, label, format, labelFormat, className }: TooltipProps<number, string> & { format?: (v: number, row: Row) => string; labelFormat?: (l: unknown) => string; className?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn('min-w-[140px] rounded-md border border-border-strong bg-surface-1/95 px-3 py-2 text-xs shadow-e3 backdrop-blur', className)}>
      {label !== undefined && label !== '' && <div className="mb-1.5 font-semibold text-fg">{labelFormat ? labelFormat(label) : String(label)}</div>}
      <div className="space-y-1">
        {(payload as Row[]).map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="text-fg-muted">{p.name}</span>
            <span className="num ml-auto pl-3 font-semibold text-fg">{typeof p.value === 'number' ? (format ? format(p.value, p) : p.value.toFixed(1)) : p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
