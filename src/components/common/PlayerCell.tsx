import { Link } from 'react-router-dom';
import type { Player, Team } from '@/data/types';
import { PlayerAvatar } from './PlayerAvatar';
import { InjuryBadge, PositionBadge } from './badges';
import { cn } from '@/lib/utils';

export function PlayerCell({ player, team, posRank, sub, link = true, size = 'sm', className, right }: { player: Player; team?: Team; posRank?: number; sub?: React.ReactNode; link?: boolean; size?: 'xs' | 'sm' | 'md'; className?: string; right?: React.ReactNode }) {
  const name = <span className="truncate font-medium text-fg">{player.name}</span>;
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <PlayerAvatar player={player} team={team} size={size} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {link ? (
            <Link to={`/players/${player.id}`} onClick={(e) => e.stopPropagation()} className="min-w-0 truncate hover:text-accent hover:underline hover:underline-offset-2">
              {name}
            </Link>
          ) : (
            name
          )}
          <InjuryBadge status={player.injury.status} detail={player.injury.detail} returnWeek={player.injury.returnWeek} />
        </div>
        <div className="flex items-center gap-1.5 text-2xs text-fg-subtle">
          <PositionBadge pos={player.position} rank={posRank} className="h-4 min-w-0 px-1 text-[10px]" />
          <span className="font-semibold">{player.team}</span>
          {sub && <span className="truncate">· {sub}</span>}
        </div>
      </div>
      {right}
    </div>
  );
}
