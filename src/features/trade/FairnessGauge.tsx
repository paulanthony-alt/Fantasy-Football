import { gaugePosition, type Verdict } from '@/engine/trade/evaluate';
import { valuationConfig } from '@/engine/valuation/config';
import { useChartTheme } from '@/components/charts/theme';
import { fmt } from '@/lib/format';

const R = 92;
const CX = 110;
const CY = 108;

function arc(from: number, to: number, r = R) {
  // angles in degrees, -90 (left) … 90 (right), 0 = top
  const p = (a: number) => [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)];
  const [x1, y1] = p(from);
  const [x2, y2] = p(to);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

/** Semicircular fairness gauge. Left = you lose value, right = you win. */
export function FairnessGauge({ fairness, verdict, empty }: { fairness: number; verdict: Verdict; empty?: boolean }) {
  const t = useChartTheme();
  const band = (valuationConfig.trade.fairBand / 0.4) * 90;
  const angle = empty ? 0 : gaugePosition(fairness) * 90;
  const color = empty ? t.neutral : verdict === 'win' ? t.pos : verdict === 'lose' ? t.neg : t.accent;
  return (
    <div className="relative mx-auto w-full max-w-[240px]" role="meter" aria-label="Trade fairness" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(fairness * 100)}>
      <svg viewBox="0 0 220 128" className="w-full overflow-visible">
        <path d={arc(-90, 90)} stroke={t.grid} strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arc(-90, -band - 2)} stroke={t.neg} strokeOpacity={0.55} strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arc(band + 2, 90)} stroke={t.pos} strokeOpacity={0.55} strokeWidth={14} fill="none" strokeLinecap="round" />
        <path d={arc(-band, band)} stroke={t.accent} strokeOpacity={0.7} strokeWidth={14} fill="none" />
        {[-90, -45, 0, 45, 90].map((a) => {
          const r1 = R - 13;
          const r2 = R - 19;
          const s = Math.sin((a * Math.PI) / 180);
          const c = Math.cos((a * Math.PI) / 180);
          return <line key={a} x1={CX + r1 * s} y1={CY - r1 * c} x2={CX + r2 * s} y2={CY - r2 * c} stroke={t.textMuted} strokeOpacity={0.5} strokeWidth={1.5} />;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${CX}px ${CY}px`, transformBox: 'view-box', transition: 'transform 700ms cubic-bezier(.34,1.4,.64,1)' }}>
          <line x1={CX} y1={CY} x2={CX} y2={CY - R + 22} stroke={color} strokeWidth={3.5} strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={8} fill={t.surface} stroke={color} strokeWidth={3} />
        <text x={18} y={126} fill={t.textMuted} fontSize={10} textAnchor="middle">Lose</text>
        <text x={CX} y={10} fill={t.textMuted} fontSize={10} textAnchor="middle">Fair</text>
        <text x={202} y={126} fill={t.textMuted} fontSize={10} textAnchor="middle">Win</text>
      </svg>
      <div className="-mt-1 text-center">
        <div className="num text-2xl font-semibold tracking-tight" style={{ color }}>{empty ? '—' : fmt.signedPct(fairness, 1)}</div>
        <div className="text-2xs text-fg-subtle">value delta for your side</div>
      </div>
    </div>
  );
}
