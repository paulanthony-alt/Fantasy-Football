import { motion } from 'framer-motion';
import { CalendarClock, X } from 'lucide-react';
import type { Team } from '@/data/types';
import type { ValuedAsset } from '@/engine/trade/evaluate';
import type { UniverseState } from '@/hooks/useUniverse';
import { PlayerAvatar } from '@/components/common/PlayerAvatar';
import { AgeIndicator, InjuryBadge, PositionBadge } from '@/components/common/badges';
import { AnimatedNumber } from '@/components/common/metrics';
import { Select } from '@/components/ui/select';
import { fmt } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function AssetCard({ asset, u, value, onRemove, recipients, onRecipient, compact, className }: {
  asset: ValuedAsset & { weight?: number };
  u: UniverseState;
  value: number;
  onRemove?: () => void;
  recipients?: { id: string; name: string }[];
  onRecipient?: (to: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const p = asset.playerId ? u.players.get(asset.playerId) : undefined;
  const team: Team | undefined = p ? u.teams.get(p.team) : undefined;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      className={cn('group relative flex items-center gap-3 rounded-lg border border-border bg-surface-2/70 p-2.5 pr-3 transition-colors hover:border-border-strong', className)}
      style={team ? { boxShadow: `inset 3px 0 0 ${team.colors.primary}` } : undefined}
    >
      {p ? (
        <PlayerAvatar player={p} team={team} size={compact ? 'sm' : 'md'} />
      ) : (
        <div className={cn('grid shrink-0 place-items-center rounded-full bg-accent/12 text-accent', compact ? 'size-8' : 'size-10')}>
          <CalendarClock className="size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {p ? (
            <Link to={`/players/${p.id}`} className="truncate text-sm font-semibold hover:text-accent">{p.name}</Link>
          ) : (
            <span className="truncate text-sm font-semibold">{asset.label}</span>
          )}
          {p && <InjuryBadge status={p.injury.status} detail={p.injury.detail} returnWeek={p.injury.returnWeek} />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-fg-subtle">
          <PositionBadge pos={asset.position} className="h-4 min-w-0 px-1 text-[10px]" />
          {p ? <span className="font-semibold">{p.team}</span> : <span>Pick #{asset.pick?.overall} proj.</span>}
          {p && p.position !== 'DST' && <AgeIndicator age={p.age} pos={p.position} />}
          {!compact && <span className="num">R {fmt.value(asset.redraft)} · D {fmt.value(asset.dynasty)}</span>}
        </div>
        {recipients && onRecipient && (
          <div className="mt-1.5 flex items-center gap-1.5 text-2xs text-fg-subtle">
            to
            <Select size="sm" className="h-6 w-36 text-xs" value={asset.asset.to} onValueChange={onRecipient} options={recipients.map((r) => ({ value: r.id, label: r.name }))} aria-label="Recipient" />
          </div>
        )}
      </div>
      <div className="text-right">
        <AnimatedNumber value={value} className="text-md font-semibold" />
        {asset.weight !== undefined && asset.weight < 1 && <div className="num text-2xs text-fg-subtle">×{asset.weight.toFixed(2)}</div>}
      </div>
      {onRemove && (
        <button onClick={onRemove} className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-border-strong bg-surface-1 text-fg-subtle opacity-0 shadow-e2 transition-opacity hover:text-neg focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100" aria-label={`Remove ${asset.label}`}>
          <X className="size-3.5" />
        </button>
      )}
    </motion.div>
  );
}
