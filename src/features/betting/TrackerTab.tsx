import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, Plus, Receipt, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { useBets } from '@/store/bets';
import { trackerStats, betProfit } from '@/engine/betting/tracker';
import type { BetResult, BetType } from '@/data/types';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { KpiTile } from '@/components/common/metrics';
import { EmptyState } from '@/components/common/states';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { axisProps, useChartTheme } from '@/components/charts/theme';
import { fmt } from '@/lib/format';
import { cn, uid } from '@/lib/utils';

const RESULT_TONE: Record<BetResult, string> = { win: 'text-pos', loss: 'text-neg', push: 'text-fg-muted', pending: 'text-warn' };

export function TrackerTab() {
  const t = useChartTheme();
  const { bets, update, remove } = useBets();
  const s = useMemo(() => trackerStats(bets), [bets]);
  const [adding, setAdding] = useState(false);
  const sorted = [...bets].sort((a, b) => b.placedAt - a.placedAt);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiTile label="Profit" value={<span className={s.profit >= 0 ? 'text-pos' : 'text-neg'}>{fmt.units(s.profit)}</span>} sub={`${fmt.num(s.risked, 2)}u risked`} />
        <KpiTile label="ROI" value={<span className={s.roi >= 0 ? 'text-pos' : 'text-neg'}>{fmt.signedPct(s.roi)}</span>} sub="Profit / units risked" />
        <KpiTile label="Win rate" value={fmt.pct(s.winRate, 1)} sub={`${s.wins}–${s.losses}${s.pushes ? `–${s.pushes}` : ''} · ${s.pending} pending`} />
        <KpiTile label="Avg odds" value={fmt.odds(s.avgOdds)} sub="Settled bets" />
        <KpiTile label="Streak" value={s.streak.len ? `${s.streak.kind}${s.streak.len}` : '—'} sub="Current run" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<TrendingUp />} title="Cumulative profit" subtitle="Units won over settled bets" />
          <CardBody>
            {s.series.length < 2 ? <EmptyState title="Settle a bet to start the curve" /> : (
              <div className="h-[230px]">
                <ResponsiveContainer>
                  <LineChart data={s.series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="i" {...axisProps(t)} tickFormatter={(x) => (x === 0 ? '' : `#${x}`)} />
                    <YAxis {...axisProps(t)} axisLine={false} tickFormatter={(x) => `${x}u`} />
                    <ReferenceLine y={0} stroke={t.textMuted} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip labelFormat={(l) => s.series[Number(l)]?.label ?? ''} format={(v) => fmt.units(v)} />} />
                    <Line type="linear" dataKey="profit" name="Profit" stroke={t.accent} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: t.accent }} animationDuration={600} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader icon={<BarChart3 />} title="By bet type" subtitle="Units won" />
          <CardBody>
            <div className="h-[230px]">
              <ResponsiveContainer>
                <BarChart data={s.byType} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="type" {...axisProps(t)} />
                  <YAxis {...axisProps(t)} axisLine={false} />
                  <ReferenceLine y={0} stroke={t.textMuted} />
                  <Tooltip content={<ChartTooltip format={(v) => fmt.units(v)} />} />
                  <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={600}>
                    {s.byType.map((b) => <Cell key={b.type} fill={b.profit >= 0 ? t.pos : t.neg} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader icon={<Receipt />} title="Bets" subtitle={`${bets.length} logged`} actions={<Button size="sm" variant="primary" onClick={() => setAdding(true)}><Plus /> Log bet</Button>} />
        {sorted.length === 0 ? <EmptyState icon={<Receipt />} title="No bets logged" description="Track bets from the Games or Props tabs, or log one manually." /> : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60 text-2xs uppercase tracking-[0.06em] text-fg-subtle">
                <tr><th className="px-4 py-2 text-left font-semibold">Date</th><th className="px-3 py-2 text-left font-semibold">Bet</th><th className="px-3 py-2 text-left font-semibold">Type</th><th className="px-3 py-2 text-right font-semibold">Odds</th><th className="px-3 py-2 text-right font-semibold">Units</th><th className="px-3 py-2 text-right font-semibold">Edge</th><th className="px-3 py-2 text-left font-semibold">Result</th><th className="px-3 py-2 text-right font-semibold">P/L</th><th /></tr>
              </thead>
              <tbody>
                {sorted.map((b) => {
                  const pl = betProfit(b);
                  return (
                    <tr key={b.id} className="border-t border-border/70 hover:bg-surface-2/50">
                      <td className="num whitespace-nowrap px-4 py-2 text-xs text-fg-subtle">{new Date(b.placedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className="px-3 py-2"><div className="font-medium">{b.description}</div><div className="text-2xs text-fg-subtle">{b.book}</div></td>
                      <td className="px-3 py-2 text-xs capitalize text-fg-muted">{b.type}</td>
                      <td className="num px-3 py-2 text-right">{fmt.odds(b.odds)}</td>
                      <td className="num px-3 py-2 text-right">{b.units}</td>
                      <td className="num px-3 py-2 text-right text-xs text-fg-muted">{b.edge ? fmt.signedPct(b.edge) : '—'}</td>
                      <td className="px-3 py-2"><Select size="sm" className={cn('h-7 w-28 text-xs font-semibold', RESULT_TONE[b.result])} value={b.result} onValueChange={(v) => update(b.id, { result: v as BetResult })} options={[{ value: 'pending', label: 'Pending' }, { value: 'win', label: 'Win' }, { value: 'loss', label: 'Loss' }, { value: 'push', label: 'Push' }]} aria-label="Result" /></td>
                      <td className={cn('num px-3 py-2 text-right font-semibold', pl > 0 ? 'text-pos' : pl < 0 ? 'text-neg' : 'text-fg-subtle')}>{b.result === 'pending' ? '—' : fmt.units(pl)}</td>
                      <td className="px-2"><Button size="icon-sm" variant="ghost" onClick={() => { remove(b.id); toast('Bet removed'); }} aria-label="Delete bet"><Trash2 /></Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AddBetDialog open={adding} onOpenChange={setAdding} />
    </div>
  );
}

function AddBetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const add = useBets((s) => s.add);
  const [form, setForm] = useState({ description: '', type: 'spread' as BetType, odds: '-110', units: '1', book: 'DraftKings' });
  const odds = Number(form.odds);
  const units = Number(form.units);
  const valid = form.description.trim().length > 2 && Number.isFinite(odds) && Math.abs(odds) >= 100 && units > 0;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    add({ id: uid('bet'), placedAt: Date.now(), type: form.type, description: form.description.trim(), odds, units, result: 'pending', book: form.book });
    toast.success('Bet logged');
    onOpenChange(false);
    setForm({ ...form, description: '' });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Log a bet" description="Track units, odds and results to measure ROI.">
        <form onSubmit={submit} className="space-y-4 p-5">
          <div><Label htmlFor="bet-desc">Bet</Label><Input id="bet-desc" autoFocus placeholder="e.g. KC −3 vs DEN" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as BetType })} options={['spread', 'total', 'moneyline', 'prop', 'parlay'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} /></div>
            <div><Label htmlFor="bet-book">Book</Label><Input id="bet-book" value={form.book} onChange={(e) => setForm({ ...form, book: e.target.value })} /></div>
            <div><Label htmlFor="bet-odds">American odds</Label><Input id="bet-odds" inputMode="numeric" value={form.odds} onChange={(e) => setForm({ ...form, odds: e.target.value })} /></div>
            <div><Label htmlFor="bet-units">Units</Label><Input id="bet-units" inputMode="decimal" value={form.units} onChange={(e) => setForm({ ...form, units: e.target.value })} /></div>
          </div>
          {!valid && form.description && <p className="text-xs text-neg">Odds must be ≤ −100 or ≥ +100 and units above zero.</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" variant="primary" disabled={!valid}>Log bet</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
