import { useState } from 'react';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import type { Player, Team } from '@/data/types';

const SIZES = { xs: 'size-6 text-[9px]', sm: 'size-8 text-[11px]', md: 'size-10 text-xs', lg: 'size-14 text-base', xl: 'size-20 text-xl' };

/** Headshot with team-color ring; falls back to initials on a team gradient. */
export function PlayerAvatar({ player, team, size = 'sm', className }: { player: Pick<Player, 'name' | 'headshotUrl' | 'position'>; team?: Team; size?: keyof typeof SIZES; className?: string }) {
  const [failed, setFailed] = useState(false);
  const primary = team?.colors.primary ?? '#334155';
  const secondary = team?.colors.secondary ?? '#64748b';
  const showImg = player.headshotUrl && !failed;
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden rounded-full font-semibold text-white ring-2 ring-offset-1 ring-offset-surface-1', SIZES[size], className)}
      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})`, ['--tw-ring-color' as string]: `${primary}aa` }}
      aria-hidden
    >
      {showImg ? (
        <img src={player.headshotUrl} alt="" loading="lazy" onError={() => setFailed(true)} className={cn('size-full object-cover', player.position === 'DST' ? 'bg-white/90 p-1' : 'bg-surface-3')} />
      ) : (
        <span className="grid size-full place-items-center tracking-tight [text-shadow:0_1px_2px_rgb(0_0_0/.35)]">{player.position === 'DST' ? player.name.split(' ')[0].slice(0, 3).toUpperCase() : initials(player.name)}</span>
      )}
    </div>
  );
}
