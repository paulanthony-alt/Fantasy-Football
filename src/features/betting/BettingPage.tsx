import { useSearchParams } from 'react-router-dom';
import { Info, LineChart, ListChecks, Target, TrendingUp } from 'lucide-react';
import { useUniverse } from '@/hooks/useUniverse';
import { useOdds, useProps } from '@/data/queries';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/common/PageHeader';
import { LastUpdated, PageSkeleton } from '@/components/common/states';
import { GamesTab } from './GamesTab';
import { PropsTab } from './PropsTab';
import { MovementTab } from './MovementTab';
import { TrackerTab } from './TrackerTab';

export default function BettingPage() {
  const { data: u, isLoading } = useUniverse();
  const odds = useOdds(u?.core.week);
  const props = useProps(u?.core.week);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'games';
  if (isLoading || !u) return <PageSkeleton />;
  return (
    <div>
      <PageHeader
        title="Betting Hub"
        subtitle={`Week ${u.core.week} markets vs the Gridiron Edge model`}
        actions={<LastUpdated at={odds.dataUpdatedAt || undefined} source={odds.data?.source} onRefresh={() => { odds.refetch(); props.refetch(); }} refreshing={odds.isFetching} />}
      />
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/[0.06] px-3 py-2 text-xs text-fg-muted">
        <Info className="mt-0.5 size-3.5 shrink-0 text-warn" />
        For research and entertainment only. Lines shown are model-generated demo markets unless an odds provider is connected. Edges are estimates, not guarantees — bet responsibly.
      </div>
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'games' ? {} : { tab: v }, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="games"><Target /> Games</TabsTrigger>
          <TabsTrigger value="props"><ListChecks /> Player props</TabsTrigger>
          <TabsTrigger value="movement"><TrendingUp /> Line movement</TabsTrigger>
          <TabsTrigger value="tracker"><LineChart /> Bet tracker</TabsTrigger>
        </TabsList>
        <TabsContent value="games"><GamesTab u={u} odds={odds.data?.data} loading={odds.isLoading} /></TabsContent>
        <TabsContent value="props"><PropsTab u={u} props={props.data?.data} loading={props.isLoading} /></TabsContent>
        <TabsContent value="movement"><MovementTab u={u} odds={odds.data?.data} loading={odds.isLoading} /></TabsContent>
        <TabsContent value="tracker"><TrackerTab /></TabsContent>
      </Tabs>
    </div>
  );
}
