import { useState } from 'react';
import type { League, LeagueMode, Slot, Strategy } from '@/data/types';
import { SLOT_ORDER } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { applySuperflex } from '@/lib/league';
import { uid } from '@/lib/utils';

export type LeagueDraft = Pick<League, 'name' | 'mode' | 'superflex' | 'scoring' | 'teams' | 'rosterSize' | 'slots' | 'strategy'>;

export const DEFAULT_DRAFT: LeagueDraft = {
  name: '',
  mode: 'redraft',
  superflex: false,
  scoring: { ppr: 1, tePremium: 0, passTd: 4, passYd: 0.04, int: -2 },
  teams: 12,
  rosterSize: 16,
  slots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, K: 1, DST: 1 },
  strategy: 'balanced',
};

/** Build an empty manual league from settings; rosters get filled in the roster editor. */
export function newManualLeague(d: LeagueDraft, season: number): League {
  const now = Date.now();
  const rosters = Array.from({ length: d.teams }, (_, i) => ({
    id: `m${i + 1}`,
    name: i === 0 ? 'My Team' : `Team ${i + 1}`,
    owner: i === 0 ? 'you' : `owner${i + 1}`,
    playerIds: [] as string[],
    picks: d.mode === 'redraft' ? [] : Array.from({ length: 3 }, (_, y) => Array.from({ length: d.mode === 'dynasty' ? 4 : 2 }, (_, r) => ({ id: `m${i + 1}-${season + y + 1}-${r + 1}`, season: season + y + 1, round: r + 1, originalTeamId: `m${i + 1}` }))).flat(),
  }));
  return { ...d, id: uid('league'), platform: 'manual', season, myTeamId: 'm1', rosters, createdAt: now, updatedAt: now };
}

export function LeagueForm({ initial, submitLabel, onSubmit, onCancel }: { initial: LeagueDraft; submitLabel: string; onSubmit: (d: LeagueDraft) => void; onCancel: () => void }) {
  const [d, setD] = useState<LeagueDraft>(initial);
  const setSlot = (s: Slot, v: number) => setD({ ...d, slots: { ...d.slots, [s]: Math.max(0, Math.min(4, v)) } });
  const valid = d.name.trim().length > 1 && d.teams >= 4 && d.teams <= 32;
  return (
    <form className="space-y-5 p-5" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit({ ...d, name: d.name.trim() }); }}>
      <div><Label htmlFor="lg-name">League name</Label><Input id="lg-name" autoFocus value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Thursday Night Degenerates" /></div>
      <div>
        <Label>Mode</Label>
        <Segmented<LeagueMode> value={d.mode} onChange={(mode) => setD({ ...d, mode })} layoutId="lf-mode" className="w-full [&>*]:flex-1" options={[{ value: 'redraft', label: 'Redraft' }, { value: 'dynasty', label: 'Dynasty' }, { value: 'keeper', label: 'Keeper' }]} />
      </div>
      <label className="flex items-center justify-between rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
        <div><div className="text-sm font-medium">Superflex / 2QB</div><div className="text-xs text-fg-subtle">QB-eligible flex slot — QBs gain significant value</div></div>
        <Switch checked={d.superflex} onCheckedChange={(v) => setD(applySuperflex(d, v))} />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><Label>Scoring</Label><Select value={String(d.scoring.ppr)} onValueChange={(v) => setD({ ...d, scoring: { ...d.scoring, ppr: Number(v) as 0 | 0.5 | 1 } })} options={[{ value: '1', label: 'PPR' }, { value: '0.5', label: 'Half PPR' }, { value: '0', label: 'Standard' }]} /></div>
        <div><Label>TE premium</Label><Select value={String(d.scoring.tePremium)} onValueChange={(v) => setD({ ...d, scoring: { ...d.scoring, tePremium: Number(v) } })} options={[{ value: '0', label: 'None' }, { value: '0.5', label: '+0.5' }, { value: '1', label: '+1.0' }]} /></div>
        <div><Label>Pass TD</Label><Select value={String(d.scoring.passTd)} onValueChange={(v) => setD({ ...d, scoring: { ...d.scoring, passTd: Number(v) as 4 | 5 | 6 } })} options={[{ value: '4', label: '4 pts' }, { value: '5', label: '5 pts' }, { value: '6', label: '6 pts' }]} /></div>
        <div><Label>Strategy</Label><Select value={d.strategy} onValueChange={(v) => setD({ ...d, strategy: v as Strategy })} options={[{ value: 'win-now', label: 'Win now' }, { value: 'balanced', label: 'Balanced' }, { value: 'rebuild', label: 'Rebuild' }]} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor="lg-teams">Teams</Label><Input id="lg-teams" type="number" min={4} max={32} value={d.teams} onChange={(e) => setD({ ...d, teams: Number(e.target.value) })} /></div>
        <div><Label htmlFor="lg-roster">Roster size</Label><Input id="lg-roster" type="number" min={8} max={60} value={d.rosterSize} onChange={(e) => setD({ ...d, rosterSize: Number(e.target.value) })} /></div>
      </div>
      <div>
        <Label>Starting lineup slots</Label>
        <div className="grid grid-cols-4 gap-2">
          {SLOT_ORDER.map((s) => (
            <div key={s} className="flex items-center justify-between rounded-md border border-border bg-surface-2/50 px-2 py-1.5">
              <span className="text-xs font-semibold text-fg-muted">{s === 'SUPERFLEX' ? 'SF' : s}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setSlot(s, d.slots[s] - 1)} className="grid size-5 place-items-center rounded text-fg-subtle hover:bg-surface-3" aria-label={`Fewer ${s}`}>−</button>
                <span className="num w-4 text-center text-sm font-semibold">{d.slots[s]}</span>
                <button type="button" onClick={() => setSlot(s, d.slots[s] + 1)} className="grid size-5 place-items-center rounded text-fg-subtle hover:bg-surface-3" aria-label={`More ${s}`}>+</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={!valid}>{submitLabel}</Button>
      </div>
    </form>
  );
}
