/**
 * "What would make this fair?" — searches single-asset additions and removals that
 * pull the trade inside the fair band, ranked by how close to even they land.
 */
import type { TradeAsset } from '@/data/types';
import { valuationConfig as cfg } from '../valuation/config';
import { valuePick } from '../valuation/picks';
import { evaluateTrade, type TradeEngineInput, type TradeEvaluation } from './evaluate';

export interface FairSuggestion {
  id: string;
  action: 'add' | 'remove';
  asset: TradeAsset;
  label: string;
  description: string;
  fairnessAfter: number;
  deltaAfter: number;
}

export function suggestFairness(input: TradeEngineInput, current: TradeEvaluation, limit = 5): FairSuggestion[] {
  if (current.empty || current.verdict === 'fair') return [];
  const me = input.myTeamId;
  const partners = input.teamIds.filter((t) => t !== me);
  if (!partners.length) return [];
  const iWin = current.fairness > 0;
  const inDeal = new Set(input.assets.map((a) => (a.ref.kind === 'player' ? a.ref.playerId : a.ref.pick.id)));
  const pickLabel = (pick: import('@/data/types').DraftPick) =>
    valuePick(pick, { teams: input.teamsInLeague, superflex: input.superflex, nextDraftSeason: input.season + 1, tierHint: input.pickTierHints?.[pick.originalTeamId] }).label;
  const candidates: { asset: TradeAsset; label: string; action: 'add' | 'remove' }[] = [];

  // Additions: when I'm losing, ask a partner to add; when I'm winning, I add.
  const givers = iWin ? [me] : partners;
  for (const from of givers) {
    const to = iWin ? partners[0] : me;
    const team = input.rosters.find((t) => t.id === from);
    if (!team) continue;
    const players = team.playerIds
      .filter((id) => !inDeal.has(id))
      .map((id) => ({ id, v: input.universe.byId.get(id) }))
      .filter((x) => x.v)
      .sort((a, b) => b.v!.value - a.v!.value)
      .slice(0, 60);
    for (const { id } of players) {
      const p = input.players.get(id)!;
      candidates.push({ asset: { key: `sug-${id}`, ref: { kind: 'player', playerId: id }, from, to }, label: p.name, action: 'add' });
    }
    if (input.mode !== 'redraft') {
      for (const pick of team.picks) {
        if (inDeal.has(pick.id)) continue;
        candidates.push({ asset: { key: `sug-${pick.id}`, ref: { kind: 'pick', pick }, from, to }, label: pickLabel(pick), action: 'add' });
      }
    }
  }

  // Removals: drop one asset from the side that's overpaying.
  for (const a of input.assets) {
    const overpayer = iWin ? a.from !== me : a.from === me;
    if (overpayer) candidates.push({ asset: a, label: a.ref.kind === 'player' ? input.players.get(a.ref.playerId)?.name ?? 'Player' : pickLabel(a.ref.pick), action: 'remove' });
  }

  const results: FairSuggestion[] = [];
  for (const c of candidates) {
    const assets = c.action === 'add' ? [...input.assets, c.asset] : input.assets.filter((a) => a.key !== c.asset.key);
    if (!assets.some((a) => a.from === me) || !assets.some((a) => a.to === me)) continue;
    const ev = evaluateTrade({ ...input, assets });
    if (Math.abs(ev.fairness) > cfg.trade.fairBand * 1.5) continue;
    const label = c.label;
    results.push({
      id: `${c.action}-${c.asset.key}`,
      action: c.action,
      asset: c.asset,
      label,
      description: c.action === 'add'
        ? `${c.asset.from === me ? 'You add' : 'They add'} ${c.label}`
        : `Remove ${c.label} from the ${c.asset.from === me ? 'your' : 'their'} side`,
      fairnessAfter: ev.fairness,
      deltaAfter: ev.delta,
    });
  }
  return results.sort((a, b) => Math.abs(a.fairnessAfter) - Math.abs(b.fairnessAfter)).slice(0, limit);
}
