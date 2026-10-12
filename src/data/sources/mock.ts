import { getMockDataset } from '../mock/generate';
import type { DataSource } from './types';

/** Deterministic offline dataset. Simulates a little latency so loading states are exercised. */
const delay = <T,>(v: T, ms = 180) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export const mockSource = {
  id: 'mock',
  label: 'Gridiron Edge model (offline)',
  async getCore() {
    const d = getMockDataset();
    return delay({ season: d.season, week: d.week, teams: d.teams, players: d.players, games: d.games }, 220);
  },
  async getGameLogs(playerId: string) {
    return delay(getMockDataset().logs[playerId] ?? [], 120);
  },
  async getOdds(week: number) {
    return delay(getMockDataset().odds.filter((o) => o.gameId.includes(`-w${week}-`)));
  },
  async getProps(week: number) {
    return delay(getMockDataset().props.filter((p) => p.id.endsWith(`-w${week}`)));
  },
  async getNews() {
    return delay(getMockDataset().news);
  },
  async getTrending() {
    return delay(getMockDataset().trending);
  },
} satisfies DataSource;
