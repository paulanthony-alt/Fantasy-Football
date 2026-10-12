import { Area, AreaChart, Tooltip, YAxis } from 'recharts';
import { useChartTheme } from './theme';
import { ChartTooltip } from './ChartTooltip';
import { useEffect, useId, useRef, useState } from 'react';

/** Compact trend line with soft fill. Color defaults to accent; pass tone for semantic color. */
export function Sparkline({ data, height = 32, tone = 'accent', showTooltip = false, label = 'Value', domain }: { data: number[]; height?: number; tone?: 'accent' | 'pos' | 'neg' | 'neutral'; showTooltip?: boolean; label?: string; domain?: [number, number] }) {
  const t = useChartTheme();
  const id = useId().replace(/:/g, '');
  const color = tone === 'pos' ? t.pos : tone === 'neg' ? t.neg : tone === 'neutral' ? t.neutral : t.accent;
  const rows = data.map((v, i) => ({ i: i + 1, v }));
  // Self-measure so sparklines inside hidden/collapsed containers don't render at 0×0.
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ height }} className="w-full min-w-0">
      {data.length >= 2 && width > 0 && (
        <AreaChart width={width} height={height} data={rows} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`sp-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={domain ?? ['dataMin - 1', 'dataMax + 1']} />
          {showTooltip && <Tooltip cursor={false} content={<ChartTooltip labelFormat={(l) => `#${l}`} />} />}
          <Area type="monotone" dataKey="v" name={label} stroke={color} strokeWidth={1.75} fill={`url(#sp-${id})`} isAnimationActive animationDuration={600} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
        </AreaChart>
      )}
    </div>
  );
}
