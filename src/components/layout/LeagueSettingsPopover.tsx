import { SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveLeague, useLeagues } from '@/store/leagues';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { applySuperflex, MODE_LABEL } from '@/lib/league';
import type { LeagueMode, Strategy } from '@/data/types';
import { Tooltip } from '@/components/ui/tooltip';

/** Quick global valuation settings for the active league — everything re-prices instantly. */
export function LeagueSettingsPopover() {
  const league = useActiveLeague();
  const patch = useLeagues((s) => s.patch);
  if (!league) return null;
  const set = (p: Parameters<typeof patch>[1], msg?: string) => {
    patch(league.id, p);
    if (msg) toast.success(msg, { description: 'Valuations, rankings and recommendations updated.' });
  };
  return (
    <Popover>
      <Tooltip content="Valuation settings">
        <PopoverTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Valuation settings">
            <SlidersHorizontal />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" className="w-[300px] space-y-4">
        <div>
          <div className="label-caps mb-2">League mode</div>
          <Segmented<LeagueMode>
            value={league.mode}
            onChange={(m) => set({ mode: m }, `Switched to ${MODE_LABEL[m]} valuations`)}
            options={[{ value: 'redraft', label: 'Redraft' }, { value: 'dynasty', label: 'Dynasty' }, { value: 'keeper', label: 'Keeper' }]}
            className="w-full [&>*]:flex-1"
            layoutId="pop-mode"
          />
        </div>
        <label className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Superflex / 2QB</div>
            <div className="text-xs text-fg-subtle">Adds a QB-eligible flex slot</div>
          </div>
          <Switch checked={league.superflex} onCheckedChange={(v) => set(applySuperflex(league, v), v ? 'Superflex on' : 'Superflex off')} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label-caps mb-1.5">Scoring</div>
            <Select
              size="sm"
              value={String(league.scoring.ppr)}
              onValueChange={(v) => set({ scoring: { ...league.scoring, ppr: Number(v) as 0 | 0.5 | 1 } }, 'Scoring updated')}
              options={[{ value: '1', label: 'PPR' }, { value: '0.5', label: 'Half PPR' }, { value: '0', label: 'Standard' }]}
            />
          </div>
          <div>
            <div className="label-caps mb-1.5">TE premium</div>
            <Select
              size="sm"
              value={String(league.scoring.tePremium)}
              onValueChange={(v) => set({ scoring: { ...league.scoring, tePremium: Number(v) } }, 'TE premium updated')}
              options={[{ value: '0', label: 'None' }, { value: '0.5', label: '+0.5' }, { value: '1', label: '+1.0' }]}
            />
          </div>
        </div>
        <div>
          <div className="label-caps mb-2">My team strategy</div>
          <Segmented<Strategy>
            size="sm"
            value={league.strategy}
            onChange={(s) => set({ strategy: s }, 'Strategy updated')}
            options={[{ value: 'win-now', label: 'Win now' }, { value: 'balanced', label: 'Balanced' }, { value: 'rebuild', label: 'Rebuild' }]}
            className="w-full [&>*]:flex-1"
            layoutId="pop-strat"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
