import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftRight, BarChart3, History } from 'lucide-react';
import { useUniverse } from '@/hooks/useUniverse';
import { useLeagues } from '@/store/leagues';
import { useTrades } from '@/store/trades';
import type { LeagueMode, Strategy } from '@/data/types';
import { PageHeader } from '@/components/common/PageHeader';
import { PageSkeleton } from '@/components/common/states';
import { Segmented } from '@/components/ui/segmented';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ModeChips } from '@/components/layout/LeagueSwitcher';
import { uid } from '@/lib/utils';
import { TradeDesk } from './TradeDesk';
import { useTradeDesk } from './useTradeDesk';
import { LineupImpactCard, ReasonsCard, SuggestionsCard, TimelineCard } from './Analysis';
import { ValueChart } from './ValueChart';
import { TradeHistory } from './TradeHistory';
import type { UniverseState } from '@/hooks/useUniverse';

export default function TradePage() {
  const { data: u, isLoading } = useUniverse();
  if (isLoading || !u) return <PageSkeleton />;
  return <TradeScreen u={u} key={u.league.id} />;
}

function TradeScreen({ u }: { u: UniverseState }) {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'desk';
  const [mode, setMode] = useState<LeagueMode>(u.league.mode === 'keeper' ? 'keeper' : u.league.mode);
  const setStrategy = useLeagues((s) => s.setStrategy);
  const save = useTrades((s) => s.save);
  const desk = useTradeDesk(u, mode);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestions = useMemo(() => (showSuggest ? desk.suggestions() : []), [showSuggest, desk]);
  const ev = desk.evaluation;

  const onSave = () => {
    save({ id: uid('trade'), leagueId: u.league.id, teamIds: desk.teamIds, assets: desk.assets, createdAt: Date.now(), verdict: ev.verdict, delta: ev.delta, mode });
    toast.success('Trade saved', { description: 'Find it under History — values update as the season moves.' });
  };
  const onSuggest = () => {
    setShowSuggest(true);
    setTimeout(() => document.getElementById('fair-suggestions')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };

  const modeOptions = [{ value: 'redraft' as const, label: 'Redraft' }, { value: 'dynasty' as const, label: 'Dynasty' }, ...(u.league.mode === 'keeper' ? [{ value: 'keeper' as const, label: 'Keeper' }] : [])];

  return (
    <div>
      <PageHeader
        title="Trade Analyzer"
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">{u.league.name} <ModeChips mode={u.league.mode} superflex={u.league.superflex} /> <span className="text-fg-subtle">· values for research only</span></span>}
        actions={
          <>
            <Segmented<LeagueMode> value={mode} onChange={(m) => { setMode(m); setShowSuggest(false); }} options={modeOptions} layoutId="trade-mode" aria-label="Valuation mode" />
            <Segmented<Strategy> value={u.league.strategy} onChange={(s) => { setStrategy(u.league.id, s); setShowSuggest(false); }} options={[{ value: 'win-now', label: 'Win now' }, { value: 'balanced', label: 'Balanced' }, { value: 'rebuild', label: 'Rebuild' }]} layoutId="trade-strat" aria-label="Team strategy" />
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'desk' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="desk"><ArrowLeftRight /> Trade desk</TabsTrigger>
          <TabsTrigger value="chart"><BarChart3 /> Value chart</TabsTrigger>
          <TabsTrigger value="history"><History /> History</TabsTrigger>
        </TabsList>
        <TabsContent value="desk">
          <TradeDesk u={u} desk={desk} mode={mode} onSave={onSave} onSuggest={onSuggest} />
          {!ev.empty && (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <SuggestionsCard open={showSuggest && ev.verdict !== 'fair'} suggestions={suggestions} onApply={(s) => { if (s.action === 'add') desk.add(s.asset.ref, s.asset.from); else desk.remove(s.asset.key); toast.success('Applied suggestion'); }} />
              {ev.sides.map((s) => <ReasonsCard key={s.teamId} u={u} side={s} />)}
              <TimelineCard u={u} ev={ev} />
              <LineupImpactCard side={ev.mine} title="Your starting lineup" />
              {ev.sides.filter((s) => s.teamId !== u.league.myTeamId).slice(0, 1).map((s) => <LineupImpactCard key={s.teamId} side={s} title={`${u.league.rosters.find((r) => r.id === s.teamId)?.name} lineup`} />)}
            </div>
          )}
        </TabsContent>
        <TabsContent value="chart"><ValueChart u={u} /></TabsContent>
        <TabsContent value="history"><TradeHistory u={u} input={desk.input} onLoad={(t) => { desk.load(t); setMode(t.mode); setParams({}, { replace: true }); toast('Trade loaded into the desk'); }} /></TabsContent>
      </Tabs>
    </div>
  );
}
