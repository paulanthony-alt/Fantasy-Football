import { chartThemes, type ChartTheme } from '@/design/tokens';
import { useUi } from '@/store/ui';

export function useChartTheme(): ChartTheme {
  const theme = useUi((s) => s.theme);
  return chartThemes[theme];
}

export const axisProps = (t: ChartTheme) => ({
  tick: { fill: t.textMuted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: t.axis },
});
