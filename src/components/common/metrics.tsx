import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export function TrendArrow({ value, format = (v) => v.toFixed(1), className, threshold = 0.05, suffix }: { value: number; format?: (v: number) => string; className?: string; threshold?: number; suffix?: string }) {
  const dir = value > threshold ? 'up' : value < -threshold ? 'down' : 'flat';
  const Icon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  return (
    <span className={cn('num inline-flex items-center gap-0.5 text-xs font-semibold', dir === 'up' ? 'text-pos' : dir === 'down' ? 'text-neg' : 'text-fg-subtle', className)}>
      <Icon className="size-3.5" aria-hidden />
      {dir === 'up' ? '+' : dir === 'down' ? '−' : ''}
      {format(Math.abs(value))}
      {suffix}
      <span className="sr-only">{dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'flat'}</span>
    </span>
  );
}

export function StatPill({ label, value, tone = 'neutral', className, title }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'pos' | 'neg' | 'accent' | 'warn'; className?: string; title?: string }) {
  return (
    <div title={title} className={cn('inline-flex h-7 items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-xs', className)}>
      <span className="text-fg-subtle">{label}</span>
      <span className={cn('num font-semibold', tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : tone === 'accent' ? 'text-accent' : tone === 'warn' ? 'text-warn' : 'text-fg')}>{value}</span>
    </div>
  );
}

/** 50–99 confidence bar. */
export function ConfidenceMeter({ value, className, compact }: { value: number; className?: string; compact?: boolean }) {
  const tone = value >= 80 ? 'bg-pos' : value >= 65 ? 'bg-accent' : 'bg-warn';
  const word = value >= 80 ? 'High' : value >= 65 ? 'Medium' : 'Toss-up';
  return (
    <div className={cn('flex items-center gap-2', className)} role="meter" aria-valuenow={value} aria-valuemin={50} aria-valuemax={99} aria-label="Confidence">
      <div className={cn('relative h-1.5 overflow-hidden rounded-full bg-surface-3', compact ? 'w-12' : 'w-20')}>
        <motion.div className={cn('absolute inset-y-0 left-0 rounded-full', tone)} initial={{ width: 0 }} animate={{ width: `${((value - 50) / 49) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
      <span className="num text-xs font-semibold text-fg">{value}</span>
      {!compact && <span className="text-2xs text-fg-subtle">{word}</span>}
    </div>
  );
}

/** Number that springs to its new value (used for value changes on mode toggles). */
export function AnimatedNumber({ value, format = (v) => Math.round(v).toLocaleString('en-US'), className }: { value: number; format?: (v: number) => string; className?: string }) {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 });
  const text = useTransform(spring, (v) => format(v));
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);
  return <motion.span className={cn('num', className)}>{text}</motion.span>;
}

/** Horizontal value bar against a max. */
export function ValueBar({ value, max = 10000, tone = 'accent', className }: { value: number; max?: number; tone?: 'accent' | 'pos' | 'neg' | 'neutral'; className?: string }) {
  const color = tone === 'pos' ? 'bg-pos' : tone === 'neg' ? 'bg-neg' : tone === 'neutral' ? 'bg-fg-subtle' : 'bg-accent';
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <motion.div className={cn('h-full rounded-full', color)} initial={false} animate={{ width: `${Math.max(1.5, Math.min(100, (value / max) * 100))}%` }} transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  );
}

export function KpiTile({ label, value, sub, delta, icon, className, children }: { label: string; value: React.ReactNode; sub?: React.ReactNode; delta?: React.ReactNode; icon?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-surface-1 p-4 shadow-e1', className)}>
      <div className="flex items-center gap-2">
        {icon && <span className="text-fg-subtle [&_svg]:size-4">{icon}</span>}
        <span className="label-caps truncate">{label}</span>
        {delta && <span className="ml-auto">{delta}</span>}
      </div>
      <div className="num truncate text-xl font-semibold tracking-tight text-fg">{value}</div>
      {sub && <div className="truncate text-xs text-fg-subtle">{sub}</div>}
      {children}
    </div>
  );
}
