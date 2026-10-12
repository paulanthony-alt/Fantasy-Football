import { Database, Monitor, Moon, RotateCcw, ShieldAlert, Sun, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useUi } from '@/store/ui';
import { clearHttpCache } from '@/data/http';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common/PageHeader';
import { valuationConfig } from '@/engine/valuation';

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3.5 first:border-t-0">
      <div><div className="text-sm font-medium">{title}</div><div className="text-xs text-fg-subtle">{desc}</div></div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const ui = useUi();
  const qc = useQueryClient();
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Settings" subtitle="Display, data sources and local storage" />
      <Card>
        <CardHeader icon={<Monitor />} title="Display" />
        <CardBody className="py-1">
          <Row title="Theme" desc="Dark is tuned for long research sessions">
            <Segmented value={ui.theme} onChange={ui.setTheme} layoutId="st-theme" options={[{ value: 'dark', label: 'Dark', icon: <Moon /> }, { value: 'light', label: 'Light', icon: <Sun /> }]} />
          </Row>
          <Row title="Table density" desc="Row height for every data table">
            <Segmented value={ui.density} onChange={ui.setDensity} layoutId="st-density" options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]} />
          </Row>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={<Database />} title="Data sources" subtitle="Live sources fall back to the offline model automatically" />
        <CardBody className="py-1">
          <Row title="Live data (Sleeper + ESPN)" desc="Headshots, trending adds and news headlines. No API keys required.">
            <Switch checked={ui.liveData} onCheckedChange={(v) => { ui.setLiveData(v); toast(v ? 'Live data enabled' : 'Using offline model data'); }} />
          </Row>
          <Row title="nflverse weekly stats" desc="Real game logs from nflverse release files (a few MB download).">
            <Switch checked={ui.nflverseStats} onCheckedChange={ui.setNflverseStats} />
          </Row>
          <Row title="Clear response cache" desc="Forces fresh requests on next load (respects rate limits).">
            <Button variant="secondary" size="sm" onClick={() => { clearHttpCache(); qc.invalidateQueries(); toast.success('Cache cleared'); }}><Trash2 /> Clear</Button>
          </Row>
        </CardBody>
      </Card>
      <Card>
        <CardHeader icon={<ShieldAlert />} title="Your data" subtitle="Leagues, rosters, trades and bets are stored only in this browser (localStorage)" />
        <CardBody className="py-1">
          <Row title="Reset everything" desc="Removes saved leagues, trades, bets and preferences, then reloads demo data.">
            <Button variant="danger" size="sm" onClick={() => { if (window.confirm('Reset all local data? This cannot be undone.')) { Object.keys(localStorage).filter((k) => k.startsWith('ge:')).forEach((k) => localStorage.removeItem(k)); window.location.assign('/'); } }}><RotateCcw /> Reset</Button>
          </Row>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Model parameters" subtitle="Tune in src/engine/valuation/config.ts" />
        <CardBody className="num grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          {[
            ['Fair band', `±${valuationConfig.trade.fairBand * 100}%`],
            ['Dynasty horizon', `${valuationConfig.dynasty.years} seasons`],
            ['Discount (bal.)', valuationConfig.dynasty.discount.balanced.toFixed(2)],
            ['Playoff weeks', valuationConfig.fantasyPlayoffWeeks.join(', ')],
          ].map(([k, v]) => <div key={k} className="rounded-md bg-surface-2 p-3"><div className="text-fg-subtle">{k}</div><div className="mt-0.5 text-sm font-semibold">{v}</div></div>)}
        </CardBody>
      </Card>
      <p className="text-xs text-fg-subtle">Gridiron Edge is a research tool. Trade verdicts, projections and betting edges are estimates for informational and entertainment purposes only — not financial or gambling advice.</p>
    </div>
  );
}
