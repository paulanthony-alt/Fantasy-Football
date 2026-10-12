import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import type { AssetRef, DraftPick, LeagueMode, TradeAsset } from '@/data/types';
import type { UniverseState } from '@/hooks/useUniverse';
import { useTrades } from '@/store/trades';
import { evaluateTrade, tradeValue, valueAsset, type TradeEngineInput, type ValuedAsset } from '@/engine/trade/evaluate';
import { suggestFairness } from '@/engine/trade/suggest';
import { effectiveSlots } from '@/engine/valuation';
import { uid } from '@/lib/utils';

export const assetId = (ref: AssetRef) => (ref.kind === 'player' ? ref.playerId : ref.pick.id);

export function useTradeDesk(u: UniverseState, mode: LeagueMode) {
  const draft = useTrades((s) => s.drafts[u.league.id]);
  const setDraft = useTrades((s) => s.setDraft);
  const league = u.league;
  const defaultPartner = league.rosters.find((t) => t.id !== league.myTeamId)?.id ?? league.myTeamId;
  const teamIds = useMemo(() => {
    const ids = draft?.teamIds?.filter((id) => league.rosters.some((t) => t.id === id)) ?? [];
    if (!ids.includes(league.myTeamId)) ids.unshift(league.myTeamId);
    if (ids.length < 2) ids.push(defaultPartner);
    return ids;
  }, [draft?.teamIds, league, defaultPartner]);
  const assets = useMemo(() => (draft?.assets ?? []).filter((a) => teamIds.includes(a.from) && teamIds.includes(a.to)), [draft?.assets, teamIds]);

  const update = useCallback((next: { teamIds?: string[]; assets?: TradeAsset[] }) => setDraft(league.id, { teamIds: next.teamIds ?? teamIds, assets: next.assets ?? assets }), [setDraft, league.id, teamIds, assets]);

  const ownerOf = useCallback(
    (ref: AssetRef) => {
      if (ref.kind === 'player') return u.rosteredBy.get(ref.playerId) ?? null;
      return league.rosters.find((t) => t.picks.some((p) => p.id === ref.pick.id))?.id ?? null;
    },
    [u.rosteredBy, league.rosters],
  );

  /** Add an asset to a team's outgoing side. Validates ownership. */
  const add = useCallback(
    (ref: AssetRef, fromTeam?: string, quiet = false) => {
      const owner = ownerOf(ref);
      const from = fromTeam ?? owner;
      if (!from || !teamIds.includes(from)) {
        if (!quiet) toast.error('That asset belongs to a team that is not in this trade', { description: 'Pick their team as the trade partner first.' });
        return false;
      }
      if (owner && owner !== from) {
        const name = league.rosters.find((t) => t.id === owner)?.name;
        if (!quiet) toast.error(`Belongs to ${name}`, { description: 'Drop it on its owner’s side of the desk.' });
        return false;
      }
      if (assets.some((a) => assetId(a.ref) === assetId(ref))) return false;
      const to = teamIds.length === 2 ? teamIds.find((t) => t !== from)! : from === league.myTeamId ? teamIds[1] : league.myTeamId;
      update({ assets: [...assets, { key: uid('a'), ref, from, to }] });
      return true;
    },
    [ownerOf, teamIds, assets, league, update],
  );

  const remove = useCallback((key: string) => update({ assets: assets.filter((a) => a.key !== key) }), [assets, update]);
  const setRecipient = useCallback((key: string, to: string) => update({ assets: assets.map((a) => (a.key === key ? { ...a, to } : a)) }), [assets, update]);
  const clear = useCallback(() => update({ assets: [] }), [update]);

  const setPartner = useCallback(
    (index: number, teamId: string) => {
      const next = [...teamIds];
      const old = next[index];
      next[index] = teamId;
      update({ teamIds: next, assets: assets.filter((a) => a.from !== old && a.to !== old) });
    },
    [teamIds, assets, update],
  );
  const addThirdTeam = useCallback(() => {
    const third = league.rosters.find((t) => !teamIds.includes(t.id));
    if (third) update({ teamIds: [...teamIds, third.id] });
  }, [league.rosters, teamIds, update]);
  const removeThirdTeam = useCallback(() => {
    const keep = teamIds.slice(0, 2);
    update({ teamIds: keep, assets: assets.filter((a) => keep.includes(a.from) && keep.includes(a.to)).map((a) => ({ ...a, to: keep.find((t) => t !== a.from)! })) });
  }, [teamIds, assets, update]);
  const load = useCallback((t: { teamIds: string[]; assets: TradeAsset[] }) => setDraft(league.id, { teamIds: t.teamIds, assets: t.assets.map((a) => ({ ...a, key: uid('a') })) }), [setDraft, league.id]);

  const input: TradeEngineInput = useMemo(
    () => ({
      mode,
      superflex: league.superflex,
      teamsInLeague: league.teams,
      slots: effectiveSlots(league),
      season: u.core.season,
      myTeamId: league.myTeamId,
      myStrategy: league.strategy,
      teamIds,
      assets,
      rosters: league.rosters,
      universe: u.universe,
      players: u.players,
      pickTierHints: u.pickTierHints,
    }),
    [mode, league, u, teamIds, assets],
  );
  const evaluation = useMemo(() => evaluateTrade(input), [input]);
  const suggestions = useCallback(() => suggestFairness(input, evaluation, 6), [input, evaluation]);

  /** Value an arbitrary asset for display (roster rails, picker). */
  const quickValue = useCallback(
    (ref: AssetRef, teamId: string): ValuedAsset & { value: number } | null => {
      const va = valueAsset({ key: assetId(ref), ref, from: teamId, to: teamId }, input);
      if (!va) return null;
      return { ...va, value: tradeValue(va, mode, teamId === league.myTeamId ? league.strategy : 'balanced') };
    },
    [input, mode, league.myTeamId, league.strategy],
  );

  return { teamIds, assets, add, remove, setRecipient, clear, setPartner, addThirdTeam, removeThirdTeam, load, evaluation, suggestions, quickValue, ownerOf, input };
}

export function pickRef(pick: DraftPick): AssetRef {
  return { kind: 'pick', pick };
}
