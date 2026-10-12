import { HeartPulse } from 'lucide-react';
import type { InjuryStatus, Position, Team } from '@/data/types';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/tooltip';
import { agePhase, ageCurve, type AgePhase } from '@/engine/valuation/aging';
import { peakWindow } from '@/engine/valuation/config';

const POS_STYLE: Record<string, string> = {
  QB: 'bg-pos_qb/14 text-pos_qb',
  RB: 'bg-pos_rb/14 text-pos_rb',
  WR: 'bg-pos_wr/14 text-pos_wr',
  TE: 'bg-pos_te/14 text-pos_te',
  K: 'bg-surface-3 text-fg-muted',
  DST: 'bg-surface-3 text-fg-muted',
  PICK: 'bg-accent/12 text-accent',
};

export function PositionBadge({ pos, rank, className }: { pos: Position | 'PICK'; rank?: number; className?: string }) {
  return (
    <span className={cn('inline-flex h-[18px] min-w-[30px] items-center justify-center rounded px-1.5 text-2xs font-bold tracking-wide', POS_STYLE[pos], className)}>
      {pos}
      {rank ? <span className="num ml-0.5 font-semibold opacity-80">{rank}</span> : null}
    </span>
  );
}

export function TeamBadge({ team, className, showName }: { team?: Team; className?: string; showName?: boolean }) {
  if (!team) return <span className={cn('text-xs text-fg-subtle', className)}>FA</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted', className)}>
      <span className="size-2.5 rounded-sm" style={{ background: team.colors.primary, boxShadow: `inset 0 0 0 1px ${team.colors.secondary}55` }} />
      {showName ? `${team.city} ${team.name}` : team.id}
    </span>
  );
}

const INJ: Record<InjuryStatus, { label: string; cls: string; word: string }> = {
  HEALTHY: { label: '', cls: '', word: 'Healthy' },
  Q: { label: 'Q', cls: 'bg-warn/14 text-warn', word: 'Questionable' },
  D: { label: 'D', cls: 'bg-neg/12 text-neg', word: 'Doubtful' },
  O: { label: 'OUT', cls: 'bg-neg/12 text-neg', word: 'Out' },
  IR: { label: 'IR', cls: 'bg-neg/12 text-neg', word: 'Injured reserve' },
  PUP: { label: 'PUP', cls: 'bg-neg/12 text-neg', word: 'Physically unable to perform' },
  SUS: { label: 'SUS', cls: 'bg-neg/12 text-neg', word: 'Suspended' },
};

export function InjuryBadge({ status, detail, returnWeek, className, verbose }: { status: InjuryStatus; detail?: string; returnWeek?: number; className?: string; verbose?: boolean }) {
  if (status === 'HEALTHY') return null;
  const s = INJ[status];
  return (
    <Tooltip content={<span><b>{s.word}</b>{detail ? ` · ${detail}` : ''}{returnWeek ? ` · target Wk ${returnWeek}` : ''}</span>}>
      <span className={cn('inline-flex h-[18px] items-center gap-1 rounded px-1.5 text-2xs font-bold', s.cls, className)}>
        <HeartPulse className="size-3" aria-hidden />
        {verbose ? s.word : s.label}
      </span>
    </Tooltip>
  );
}

const PHASE: Record<AgePhase, { label: string; cls: string; dot: string }> = {
  rising: { label: 'Ascending', cls: 'text-pos', dot: 'bg-pos' },
  peak: { label: 'Prime', cls: 'text-accent', dot: 'bg-accent' },
  declining: { label: 'Declining', cls: 'text-warn', dot: 'bg-warn' },
  cliff: { label: 'Age cliff', cls: 'text-neg', dot: 'bg-neg' },
};

/** Age with a positional aging-curve indicator (mini curve in tooltip). */
export function AgeIndicator({ age, pos, className, showLabel }: { age: number; pos: Position; className?: string; showLabel?: boolean }) {
  if (pos === 'DST') return <span className="text-xs text-fg-subtle">—</span>;
  const phase = agePhase(pos, age);
  const p = PHASE[phase];
  const [lo, hi] = peakWindow[pos];
  const ages = Array.from({ length: 17 }, (_, i) => 21 + i);
  const pts = ages.map((a, i) => `${(i / (ages.length - 1)) * 120},${36 - ageCurve(pos, a) * 32}`).join(' ');
  const cx = ((Math.min(37, Math.max(21, age)) - 21) / 16) * 120;
  const cy = 36 - ageCurve(pos, age) * 32;
  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <div className="font-semibold">{pos} aging curve · peak {lo}–{hi}</div>
          <svg width="120" height="40" className="overflow-visible" aria-hidden>
            <polyline points={pts} fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="3.5" className={p.cls} fill="currentColor" />
          </svg>
          <div className={p.cls}>{p.label} · {Math.round(ageCurve(pos, age) * 100)}% of peak</div>
        </div>
      }
    >
      <span className={cn('num inline-flex items-center gap-1.5 text-xs text-fg-muted', className)}>
        <span className={cn('size-1.5 rounded-full', p.dot)} />
        {age.toFixed(1)}
        {showLabel && <span className={cn('text-2xs font-semibold', p.cls)}>{p.label}</span>}
      </span>
    </Tooltip>
  );
}
