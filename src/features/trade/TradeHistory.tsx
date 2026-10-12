import { History, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UniverseState } from '@/hooks/useUniverse';
import { useTrades } from '@/store/trades';
import { evaluateTrade, type TradeEngineInput } from '@/engine/trade/evaluate';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/common/states';
import { fmt, timeAgo } from '@/lib/format';
import { MODE_LABEL } from '@/lib/league';
import type { SavedTrade } from '@/data/types';

const tone = (v: SavedTrade['verdict']) => (v === 'win' ? 'pos' : v === 'lose' ? 'neg' : 'accent');
const word = (v: SavedTrade['verdict']) => (v === 'win' ? 'Win' : v === 'lose' ? 'Lose' : 'Fair');

export function TradeHistory({ u, input, onLoad }: { u: UniverseState; input: TradeEngineInput; onLoad: (t: SavedTrade) => void }) {
  const history = useTrades((s) => s.history).filter((h) => h.leagueId === u.league.id);
  const remove = useTrades((s) => s.removeSaved);
  if (!history.length) return <Card><EmptyState icon={<History />} title="No saved trades yet" description="Save a trade from the desk to track how its value moves over the season." /></Card>;
  const label = (t: SavedTrade, team: string, dir: 'from' | 'to') =>
    t.assets.filter((a) => a[dir] === team).map((a) => (a.ref.kind === 'player' ? u.players.get(a.ref.playerId)?.name ?? 'Unknown' : `${a.ref.pick.season} Rd ${a.ref.pick.round}`)).join(', ') || '—';
  return (
    <Card className="divide-y divide-border/70">
      {history.map((t) => {
        const now = evaluateTrade({ ...input, mode: t.mode, teamIds: t.teamIds, assets: t.assets });
        const partner = t.teamIds.filter((id) => id !== u.league.myTeamId).map((id) => u.league.rosters.find((r) => r.id === id)?.name).join(' & ');
        return (
          <div key={t.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                With {partner}
                <Badge tone="outline">{MODE_LABEL[t.mode]}</Badge>
                <span className="text-2xs font-normal text-fg-subtle">{timeAgo(t.createdAt)}</span>
              </div>
              <div className="mt-1 text-xs text-fg-muted"><span className="text-fg-subtle">You send:</span> {label(t, u.league.myTeamId, 'from')}</div>
              <div className="text-xs text-fg-muted"><span className="text-fg-subtle">You get:</span> {label(t, u.league.myTeamId, 'to')}</div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xs text-fg-subtle">When saved</div>
                <Badge tone={tone(t.verdict)} size="md">{word(t.verdict)} {fmt.signedInt(t.delta)}</Badge>
              </div>
              <div className="text-center">
                <div className="text-2xs text-fg-subtle">Today</div>
                <Badge tone={tone(now.verdict)} size="md">{word(now.verdict)} {fmt.signedInt(now.delta)}</Badge>
              </div>
              <Tooltip content="Load into desk"><Button size="icon-sm" variant="secondary" onClick={() => onLoad(t)} aria-label="Load trade"><RotateCcw /></Button></Tooltip>
              <Tooltip content="Delete"><Button size="icon-sm" variant="ghost" onClick={() => { remove(t.id); toast('Trade deleted'); }} aria-label="Delete trade"><Trash2 /></Button></Tooltip>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
