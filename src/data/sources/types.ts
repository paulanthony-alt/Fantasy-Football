import type { Game, GameLog, GameOdds, NewsItem, Player, PlayerProp, Team, TrendingPlayer } from '../types';

export interface CoreData {
  season: number;
  week: number;
  teams: Team[];
  players: Player[];
  games: Game[];
}

/**
 * Every data provider implements (a subset of) this interface. The repository
 * calls the configured live source first and falls back to mock on failure,
 * so adding a provider is just implementing these methods.
 */
export interface DataSource {
  id: string;
  label: string;
  getCore?(): Promise<CoreData>;
  getGameLogs?(playerId: string, core: CoreData): Promise<GameLog[]>;
  getOdds?(week: number): Promise<GameOdds[]>;
  getProps?(week: number): Promise<PlayerProp[]>;
  getNews?(core: CoreData): Promise<NewsItem[]>;
  getTrending?(core: CoreData): Promise<TrendingPlayer[]>;
}
