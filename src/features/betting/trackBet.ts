import { toast } from 'sonner';
import { useBets } from '@/store/bets';
import type { BetType } from '@/data/types';
import { uid } from '@/lib/utils';

/** Quick-log a bet at 1u from a market row. */
export function trackBet(type: BetType, description: string, odds: number, edge?: number, gameId?: string) {
  useBets.getState().add({ id: uid('bet'), placedAt: Date.now(), type, description, odds, units: 1, result: 'pending', book: 'Model line', edge, gameId });
  toast.success('Bet added to tracker', { description: `${description} · ${odds > 0 ? '+' : ''}${odds} · 1u` });
}
