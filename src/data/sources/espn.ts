/**
 * ESPN public site API adapter (undocumented, keyless). Used for news headlines.
 */
import { cachedGet } from '../http';
import type { NewsItem } from '../types';
import type { CoreData, DataSource } from './types';
import { normalizeName } from './sleeper';

interface EspnArticle {
  id?: number;
  headline: string;
  description?: string;
  published: string;
  links?: { web?: { href?: string } };
  categories?: { type: string; description?: string; athlete?: { description?: string }; team?: { description?: string; abbreviation?: string } }[];
}

const NEGATIVE = /(injur|out for|ruled out|questionable|doubtful|ir\b|surgery|torn|sprain|strain|concussion|suspend|release|benched)/i;
const POSITIVE = /(return|activated|cleared|signs|extension|breakout|career-high|promot|starter)/i;

export const espnSource: DataSource = {
  id: 'espn',
  label: 'ESPN',
  async getNews(core: CoreData) {
    const { data } = await cachedGet<{ articles: EspnArticle[] }>('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=60', { ttlMs: 10 * 60_000, persist: true });
    const byName = new Map(core.players.map((p) => [normalizeName(p.name), p]));
    const teamNames = new Map(core.teams.map((t) => [t.name.toLowerCase(), t.id]));
    const items: NewsItem[] = (data.articles ?? []).map((a, i) => {
      const athlete = a.categories?.find((c) => c.type === 'athlete')?.athlete?.description ?? a.categories?.find((c) => c.type === 'athlete')?.description;
      const player = athlete ? byName.get(normalizeName(athlete)) : undefined;
      const teamDesc = a.categories?.find((c) => c.type === 'team')?.description?.toLowerCase() ?? '';
      const team = player?.team ?? [...teamNames.entries()].find(([n]) => teamDesc.includes(n))?.[1];
      const text = `${a.headline} ${a.description ?? ''}`;
      const negative = NEGATIVE.test(text);
      return {
        id: `espn-${a.id ?? i}`,
        ts: Date.parse(a.published) || Date.now(),
        playerId: player?.id,
        team,
        headline: a.headline,
        body: a.description ?? '',
        type: negative ? 'injury' : /trade|sign|release|waive|claim/i.test(text) ? 'transaction' : 'performance',
        impact: negative ? 'negative' : POSITIVE.test(text) ? 'positive' : 'neutral',
        source: 'ESPN',
        url: a.links?.web?.href,
      } satisfies NewsItem;
    });
    if (!items.length) throw new Error('ESPN returned no articles');
    return items.sort((a, b) => b.ts - a.ts);
  },
};
