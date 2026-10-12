import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Download, Loader2, Pencil, Plus, RefreshCw, Trash2, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useUniverse } from '@/hooks/useUniverse';
import { useLeagues } from '@/store/leagues';
import type { League } from '@/data/types';
import { fetchUser, fetchUserLeagues, importSleeperLeague, type SleeperLeague } from '@/data/sources/sleeper';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState, PageSkeleton } from '@/components/common/states';
import { ModeChips } from '@/components/layout/LeagueSwitcher';
import { leagueFormat, STRATEGY_LABEL } from '@/lib/league';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DEFAULT_DRAFT, LeagueForm, newManualLeague } from './LeagueForm';

export default function LeaguesPage() {
  const { data: u, isLoading } = useUniverse();
  const { leagues, activeId, setActive, upsert, remove, patch } = useLeagues();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [importing, setImporting] = useState(params.get('import') === 'sleeper');
  const [editing, setEditing] = useState<League | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<League | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (params.get('new') === '1') setCreating(true);
    if (params.get('import') === 'sleeper') setImporting(true);
  }, [params]);
  const close = () => { setCreating(false); setImporting(false); setParams({}, { replace: true }); };

  if (isLoading || !u) return <PageSkeleton />;
  return (
    <div>
      <PageHeader
        title="Leagues"
        subtitle="Every valuation, ranking and recommendation is priced for the active league"
        actions={<><Button variant="secondary" onClick={() => setImporting(true)}><Download /> Import from Sleeper</Button><Button variant="primary" onClick={() => setCreating(true)}><Plus /> New league</Button></>}
      />
      {leagues.length === 0 ? (
        <Card><EmptyState icon={<Trophy />} title="No leagues yet" description="Import from Sleeper or create one manually to get personalized values." action={<Button variant="primary" onClick={() => setCreating(true)}><Plus /> New league</Button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {leagues.map((l) => {
            const me = l.rosters.find((t) => t.id === l.myTeamId);
            const active = l.id === activeId;
            return (
              <Card key={l.id} className={cn('flex flex-col p-4 transition-shadow', active && 'border-accent/50 shadow-glow')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-md font-semibold">{l.name}</div>
                    <div className="text-xs text-fg-subtle">{l.platform === 'sleeper' ? 'Sleeper import' : l.platform === 'demo' ? 'Demo league' : 'Manual'} · {l.season} · updated {timeAgo(l.updatedAt)}</div>
                  </div>
                  <ModeChips mode={l.mode} superflex={l.superflex} />
                </div>
                <div className="mt-3 text-sm text-fg-muted">{leagueFormat(l)}</div>
                <div className="mt-1 text-xs text-fg-subtle">Starters: {Object.entries(l.slots).filter(([, n]) => n).map(([s, n]) => `${n > 1 ? n : ''}${s === 'SUPERFLEX' ? 'SF' : s}`).join(' · ')} · {l.rosterSize} roster spots</div>
                <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-2/60 px-3 py-2 text-sm">
                  <Users className="size-4 text-fg-subtle" />
                  <span className="min-w-0 flex-1 truncate">{me?.name ?? '—'}</span>
                  <span className="num text-xs text-fg-subtle">{me?.playerIds.length ?? 0} players · {STRATEGY_LABEL[l.strategy]}</span>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {active ? <Button size="sm" variant="secondary" disabled><Check /> Active</Button> : <Button size="sm" variant="primary" onClick={() => { setActive(l.id); toast.success(`Switched to ${l.name}`); }}>Make active</Button>}
                  {me && me.playerIds.length === 0 && <Button size="sm" variant="ghost" onClick={() => { setActive(l.id); nav('/lineup'); }}>Add roster</Button>}
                  <div className="ml-auto flex gap-1">
                    {l.platform === 'sleeper' && l.externalId && <Tooltip content="Re-sync from Sleeper"><Button size="icon-sm" variant="ghost" aria-label="Re-sync" onClick={async () => {
                      try {
                        const { league } = await importSleeperLeague(l.externalId!, '', u.core.players);
                        upsert({ ...league, id: l.id, strategy: l.strategy, myTeamId: l.myTeamId, createdAt: l.createdAt });
                        toast.success('Rosters synced from Sleeper');
                      } catch (e) { toast.error('Sync failed', { description: (e as Error).message }); }
                    }}><RefreshCw /></Button></Tooltip>}
                    <Tooltip content="Edit settings"><Button size="icon-sm" variant="ghost" onClick={() => setEditing(l)} aria-label="Edit league"><Pencil /></Button></Tooltip>
                    <Tooltip content="Delete"><Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(l)} aria-label="Delete league"><Trash2 /></Button></Tooltip>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={creating} onOpenChange={(v) => !v && close()}>
        <DialogContent title="New league" description="Enter your league settings; add rosters afterwards in Lineup → Edit roster.">
          <LeagueForm initial={DEFAULT_DRAFT} submitLabel="Create league" onCancel={close} onSubmit={(d) => { const l = newManualLeague(d, u.core.season); upsert(l); close(); toast.success(`${l.name} created`, { description: 'Add your roster to get start/sit and trade advice.', action: { label: 'Add roster', onClick: () => nav('/lineup') } }); }} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        {editing && (
          <DialogContent title={`Edit ${editing.name}`} description="Changes re-price every player instantly.">
            <LeagueForm initial={editing} submitLabel="Save changes" onCancel={() => setEditing(null)} onSubmit={(d) => { patch(editing.id, d); setEditing(null); toast.success('League updated'); }} />
          </DialogContent>
        )}
      </Dialog>
      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        {confirmDelete && (
          <DialogContent title="Delete league?" description={`${confirmDelete.name} and its saved settings will be removed from this browser.`}>
            <div className="flex justify-end gap-2 p-5"><Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button><Button variant="danger" onClick={() => { remove(confirmDelete.id); setConfirmDelete(null); toast('League deleted'); }}><Trash2 /> Delete</Button></div>
          </DialogContent>
        )}
      </Dialog>
      <SleeperImport open={importing} onClose={close} season={u.core.season} players={u.core.players} onImported={(l, unmatched) => { upsert(l); close(); toast.success(`Imported ${l.name}`, { description: unmatched ? `${unmatched} deep-roster players added with baseline projections.` : 'All players matched.' }); }} />
    </div>
  );
}

function SleeperImport({ open, onClose, season, players, onImported }: { open: boolean; onClose: () => void; season: number; players: import('@/data/types').Player[]; onImported: (l: League, unmatched: number) => void }) {
  const [username, setUsername] = useState('');
  const [state, setState] = useState<{ step: 'user' | 'pick'; loading: boolean; error?: string; userId?: string; leagues?: SleeperLeague[] }>({ step: 'user', loading: false });
  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setState({ step: 'user', loading: true });
    try {
      const user = await fetchUser(username);
      let leagues = await fetchUserLeagues(user.user_id, season);
      if (!leagues.length) leagues = await fetchUserLeagues(user.user_id, season - 1);
      if (!leagues.length) throw new Error('No NFL leagues found for this user.');
      setState({ step: 'pick', loading: false, userId: user.user_id, leagues });
    } catch (err) {
      setState({ step: 'user', loading: false, error: (err as Error).message.includes('fetch') ? 'Could not reach Sleeper — check your connection.' : (err as Error).message });
    }
  };
  const pick = async (lg: SleeperLeague) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const { league, unmatched } = await importSleeperLeague(lg.league_id, state.userId!, players);
      onImported(league, unmatched);
      setState({ step: 'user', loading: false });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
    }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Import from Sleeper" description="Read-only import using Sleeper's public API — no password needed.">
        {state.step === 'user' ? (
          <form onSubmit={find} className="space-y-4 p-5">
            <div><Label htmlFor="slp-user">Sleeper username</Label><Input id="slp-user" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" /></div>
            {state.error && <p className="rounded-md bg-neg/10 px-3 py-2 text-sm text-neg">{state.error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!username.trim() || state.loading}>{state.loading ? <Loader2 className="animate-spin" /> : <Download />} Find leagues</Button></div>
          </form>
        ) : (
          <div className="p-3">
            {state.error && <p className="mx-2 mb-2 rounded-md bg-neg/10 px-3 py-2 text-sm text-neg">{state.error}</p>}
            <ul className="space-y-1">
              {state.leagues!.map((l) => (
                <li key={l.league_id}>
                  <button disabled={state.loading} onClick={() => pick(l)} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-surface-2 disabled:opacity-50">
                    <Trophy className="size-4 text-accent" />
                    <div className="min-w-0 flex-1"><div className="truncate font-medium">{l.name}</div><div className="text-xs text-fg-subtle">{l.season} · {l.total_rosters} teams · {l.settings?.type === 2 ? 'Dynasty' : l.settings?.type === 1 ? 'Keeper' : 'Redraft'}</div></div>
                    {state.loading ? <Loader2 className="size-4 animate-spin text-fg-subtle" /> : <span className="text-xs text-accent">Import</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-start px-2 pt-2"><Button size="sm" variant="ghost" onClick={() => setState({ step: 'user', loading: false })}>Back</Button></div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
