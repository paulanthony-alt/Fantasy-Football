import { X } from 'lucide-react';
import type { UniverseState } from '@/hooks/useUniverse';
import { useLeagues } from '@/store/leagues';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PlayerCell } from '@/components/common/PlayerCell';
import { PlayerSearch } from '@/components/common/PlayerSearch';
import { Button } from '@/components/ui/button';
import { fmt } from '@/lib/format';

/** Manual roster entry: add any player (moves them from their current team) or drop. */
export function RosterEditor({ u, teamId, open, onOpenChange, onSaved }: { u: UniverseState; teamId: string; open: boolean; onOpenChange: (v: boolean) => void; onSaved?: () => void }) {
  const updateTeam = useLeagues((s) => s.updateTeam);
  const team = u.league.rosters.find((t) => t.id === teamId)!;
  const ids = [...team.playerIds].sort((a, b) => (u.universe.byId.get(b)?.value ?? 0) - (u.universe.byId.get(a)?.value ?? 0));
  const add = (id: string) => {
    const prev = u.rosteredBy.get(id);
    if (prev && prev !== teamId) {
      const other = u.league.rosters.find((t) => t.id === prev)!;
      updateTeam(u.league.id, prev, { playerIds: other.playerIds.filter((x) => x !== id) });
    }
    updateTeam(u.league.id, teamId, { playerIds: [...team.playerIds, id] });
    onSaved?.();
  };
  const drop = (id: string) => {
    updateTeam(u.league.id, teamId, { playerIds: team.playerIds.filter((x) => x !== id) });
    onSaved?.();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="right" title={`Edit roster — ${team.name}`} description={`${team.playerIds.length} of ${u.league.rosterSize} spots used. Adding a rostered player moves them to this team.`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <PlayerSearch u={u} onPick={add} exclude={team.playerIds} />
          <span className="num text-xs text-fg-subtle">{team.playerIds.length}/{u.league.rosterSize}</span>
        </div>
        <div className="divide-y divide-border/70">
          {ids.map((id) => {
            const p = u.players.get(id);
            const v = u.universe.byId.get(id);
            if (!p || !v) return null;
            return (
              <div key={id} className="flex items-center gap-3 px-5 py-2">
                <PlayerCell player={p} team={u.teams.get(p.team)} posRank={v.posRank} className="flex-1" />
                <span className="num text-xs text-fg-muted">{fmt.value(v.value)}</span>
                <Button size="icon-sm" variant="ghost" onClick={() => drop(id)} aria-label={`Drop ${p.name}`}><X /></Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
