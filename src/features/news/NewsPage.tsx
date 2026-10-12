import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, HeartPulse, Newspaper, Search, Star } from 'lucide-react';
import { useUniverse } from '@/hooks/useUniverse';
import { useNews } from '@/data/queries';
import { useWatchlist } from '@/store/watchlist';
import type { NewsItem, NewsType } from '@/data/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { PageHeader } from '@/components/common/PageHeader';
import { CardSkeleton, EmptyState, LastUpdated, PageSkeleton } from '@/components/common/states';
import { PlayerCell } from '@/components/common/PlayerCell';
import { TeamBadge } from '@/components/common/badges';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';

type Scope = 'all' | 'mine' | 'watch';
const TYPE_LABEL: Record<NewsType, string> = { injury: 'Injury', practice: 'Practice', transaction: 'Transaction', depth: 'Depth chart', performance: 'Performance' };

export default function NewsPage() {
  const { data: u, isLoading } = useUniverse();
  const news = useNews(u?.core);
  const watch = useWatchlist((s) => s.ids);
  const [params] = useSearchParams();
  const [scope, setScope] = useState<Scope>('all');
  const [type, setType] = useState<'all' | 'injury' | 'transaction' | 'depth' | 'performance'>(params.get('filter') === 'injury' ? 'injury' : 'all');
  const [team, setTeam] = useState('all');
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    if (!u) return [];
    const mine = new Set(u.myRoster);
    const myTeams = new Set(u.myRoster.map((id) => u.players.get(id)?.team));
    return (news.data?.data ?? []).filter((n) => {
      if (scope === 'mine' && !(n.playerId ? mine.has(n.playerId) : n.team && myTeams.has(n.team))) return false;
      if (scope === 'watch' && !(n.playerId && watch.includes(n.playerId))) return false;
      if (type !== 'all' && !(type === 'injury' ? n.type === 'injury' || n.type === 'practice' : n.type === type)) return false;
      if (team !== 'all' && n.team !== team) return false;
      if (q && !`${n.headline} ${n.body}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [u, news.data, scope, type, team, q, watch]);

  if (isLoading || !u) return <PageSkeleton />;
  return (
    <div>
      <PageHeader title="News & Injuries" subtitle="Filter by your roster, watchlist, team or type" actions={<LastUpdated at={news.dataUpdatedAt || undefined} source={news.data?.source} onRefresh={() => news.refetch()} refreshing={news.isFetching} />} />
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <Segmented<Scope> size="sm" value={scope} onChange={setScope} layoutId="news-scope" aria-label="Scope" options={[{ value: 'all', label: 'All' }, { value: 'mine', label: 'My players' }, { value: 'watch', label: 'Watchlist', icon: <Star /> }]} />
        <Segmented size="sm" value={type} onChange={setType} layoutId="news-type" aria-label="Type" options={[{ value: 'all' as const, label: 'All types' }, { value: 'injury' as const, label: 'Injuries', icon: <HeartPulse /> }, { value: 'transaction' as const, label: 'Moves' }, { value: 'depth' as const, label: 'Depth' }, { value: 'performance' as const, label: 'Performance' }]} />
        <Select size="sm" className="w-44" value={team} onValueChange={setTeam} options={[{ value: 'all', label: 'All teams' }, ...[...u.teams.values()].sort((a, b) => a.id.localeCompare(b.id)).map((t) => ({ value: t.id, label: `${t.city} ${t.name}` }))]} aria-label="Team" />
        <Input icon={<Search />} placeholder="Search headlines…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto w-full sm:w-60" aria-label="Search news" />
      </Card>
      <Card className="overflow-hidden">
        {news.isLoading ? <CardSkeleton rows={8} /> : items.length === 0 ? (
          <EmptyState icon={<Newspaper />} title="No news matches these filters" description="Try widening the scope or clearing the search." />
        ) : (
          <ul className="divide-y divide-border/70">
            {items.map((n) => <NewsRow key={n.id} n={n} u={u} mine={!!n.playerId && u.myRoster.includes(n.playerId)} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NewsRow({ n, u, mine }: { n: NewsItem; u: NonNullable<ReturnType<typeof useUniverse>['data']>; mine: boolean }) {
  const p = n.playerId ? u.players.get(n.playerId) : undefined;
  return (
    <li className="relative flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-surface-2/40 sm:flex-row">
      <span className={cn('absolute inset-y-3 left-0 w-[3px] rounded-r', n.impact === 'negative' ? 'bg-neg' : n.impact === 'positive' ? 'bg-pos' : 'bg-border-strong')} aria-hidden />
      <div className="w-full shrink-0 sm:w-56">
        {p ? <PlayerCell player={p} team={u.teams.get(p.team)} posRank={u.universe.byId.get(p.id)?.posRank} /> : <TeamBadge team={n.team ? u.teams.get(n.team) : undefined} showName />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{n.headline}</h3>
          {mine && <Badge tone="accent">My team</Badge>}
        </div>
        <p className="mt-1 text-sm text-fg-muted">{n.body}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-fg-subtle">
          <Badge tone={n.type === 'injury' ? 'neg' : n.type === 'practice' ? 'warn' : 'neutral'}>{TYPE_LABEL[n.type]}</Badge>
          <span>{n.source}</span>·<span title={new Date(n.ts).toLocaleString()}>{timeAgo(n.ts)}</span>
          {n.url && <a href={n.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">Read <ExternalLink className="size-3" /></a>}
        </div>
      </div>
    </li>
  );
}
