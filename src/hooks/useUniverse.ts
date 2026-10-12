import { useMemo } from 'react';
import { useCore } from '@/data/queries';
import { useActiveLeague } from '@/store/leagues';
import { buildContext, valueUniverse, type PickTier, type Universe, type ValuationContext } from '@/engine/valuation';
import type { League, Player, Team } from '@/data/types';
import type { CoreData } from '@/data/sources/types';

export interface UniverseState {
  core: CoreData;
  league: League;
  universe: Universe;
  ctx: ValuationContext;
  players: Map<string, Player>;
  teams: Map<string, Team>;
  pickTierHints: Record<string, PickTier>;
  source: string;
  fetchedAt: number;
  myRoster: string[];
  rosteredBy: Map<string, string>;
}

/** Players + valuations for the active league. Re-prices whenever league settings change. */
export function useUniverse(): { data: UniverseState | null; isLoading: boolean; error: unknown } {
  const q = useCore();
  const league = useActiveLeague();
  const data = useMemo(() => {
    if (!q.data || !league) return null;
    const core = q.data.data;
    const allPlayers = league.extraPlayers?.length ? [...core.players, ...league.extraPlayers] : core.players;
    const ctx = buildContext(league, core);
    const universe = valueUniverse(allPlayers, ctx);
    const players = new Map(allPlayers.map((p) => [p.id, p]));
    const teams = new Map(core.teams.map((t) => [t.id, t]));
    // Projected finish → pick tier (weakest third pick early)
    const strength = league.rosters
      .map((t) => ({ id: t.id, s: t.playerIds.map((id) => universe.byId.get(id)?.redraftValue ?? 0).sort((a, b) => b - a).slice(0, 9).reduce((a, b) => a + b, 0) + (t.record ? (t.record.w - t.record.l) * 900 : 0) }))
      .sort((a, b) => a.s - b.s);
    const pickTierHints: Record<string, PickTier> = {};
    strength.forEach((t, i) => (pickTierHints[t.id] = i < strength.length / 3 ? 'early' : i < (2 * strength.length) / 3 ? 'mid' : 'late'));
    const rosteredBy = new Map<string, string>();
    league.rosters.forEach((t) => t.playerIds.forEach((id) => rosteredBy.set(id, t.id)));
    const myRoster = league.rosters.find((t) => t.id === league.myTeamId)?.playerIds ?? [];
    return { core, league, universe, ctx, players, teams, pickTierHints, source: q.data.source, fetchedAt: q.data.fetchedAt, myRoster, rosteredBy } satisfies UniverseState;
  }, [q.data, league]);
  return { data, isLoading: q.isLoading || (!!q.data && !league), error: q.error };
}
