/** Diverging heat for a 1–32 rank where 32 = softest (good for offense). */
export function rankHeat(rank: number) {
  if (rank >= 27) return 'bg-pos/30';
  if (rank >= 21) return 'bg-pos/14';
  if (rank >= 12) return 'bg-surface-3/70';
  if (rank >= 6) return 'bg-neg/14';
  return 'bg-neg/30';
}
