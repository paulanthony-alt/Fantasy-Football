import type { Team, SkillPosition } from '../types';
import { rng } from '@/lib/utils';

type Row = [id: string, city: string, name: string, conf: 'AFC' | 'NFC', div: Team['division'], primary: string, secondary: string, bye: number, off: number, def: number, pace: number, passRate: number, dome: boolean];

// Ratings are illustrative 2026 priors (pts/game vs league average).
const ROWS: Row[] = [
  ['ARI', 'Arizona', 'Cardinals', 'NFC', 'West', '#97233F', '#FFB612', 8, -1.0, -1.5, 63.5, 0.58, true],
  ['ATL', 'Atlanta', 'Falcons', 'NFC', 'South', '#A71930', '#A5ACAF', 5, 1.0, -1.0, 64.0, 0.56, true],
  ['BAL', 'Baltimore', 'Ravens', 'AFC', 'North', '#241773', '#9E7C0C', 7, 4.5, 1.0, 63.0, 0.5, false],
  ['BUF', 'Buffalo', 'Bills', 'AFC', 'East', '#00338D', '#C60C30', 7, 5.5, 1.5, 64.5, 0.55, false],
  ['CAR', 'Carolina', 'Panthers', 'NFC', 'South', '#0085CA', '#BFC0BF', 11, -1.5, -1.0, 62.0, 0.55, false],
  ['CHI', 'Chicago', 'Bears', 'NFC', 'North', '#0B162A', '#C83803', 5, 2.0, 0.5, 64.5, 0.57, false],
  ['CIN', 'Cincinnati', 'Bengals', 'AFC', 'North', '#FB4F14', '#000000', 10, 3.5, -3.5, 65.5, 0.64, false],
  ['CLE', 'Cleveland', 'Browns', 'AFC', 'North', '#311D00', '#FF3C00', 9, -4.0, 2.5, 63.0, 0.6, false],
  ['DAL', 'Dallas', 'Cowboys', 'NFC', 'East', '#003594', '#869397', 10, 3.0, -3.0, 65.0, 0.62, true],
  ['DEN', 'Denver', 'Broncos', 'AFC', 'West', '#FB4F14', '#002244', 12, 1.5, 4.0, 65.5, 0.58, false],
  ['DET', 'Detroit', 'Lions', 'NFC', 'North', '#0076B6', '#B0B7BC', 8, 5.0, 1.5, 63.5, 0.55, true],
  ['GB', 'Green Bay', 'Packers', 'NFC', 'North', '#203731', '#FFB612', 6, 2.5, 2.0, 62.5, 0.53, false],
  ['HOU', 'Houston', 'Texans', 'AFC', 'South', '#03202F', '#A71930', 6, 0.5, 3.5, 64.0, 0.57, true],
  ['IND', 'Indianapolis', 'Colts', 'AFC', 'South', '#002C5F', '#A2AAAD', 11, 3.0, -0.5, 63.0, 0.53, true],
  ['JAX', 'Jacksonville', 'Jaguars', 'AFC', 'South', '#006778', '#D7A22A', 8, 1.5, 1.5, 64.0, 0.57, false],
  ['KC', 'Kansas City', 'Chiefs', 'AFC', 'West', '#E31837', '#FFB81C', 10, 2.5, 1.0, 63.5, 0.6, false],
  ['LV', 'Las Vegas', 'Raiders', 'AFC', 'West', '#000000', '#A5ACAF', 13, -3.5, -2.0, 62.5, 0.6, true],
  ['LAC', 'Los Angeles', 'Chargers', 'AFC', 'West', '#0080C6', '#FFC20E', 12, 1.0, 2.5, 63.0, 0.56, true],
  ['LAR', 'Los Angeles', 'Rams', 'NFC', 'West', '#003594', '#FFA300', 9, 4.5, 2.0, 64.5, 0.6, true],
  ['MIA', 'Miami', 'Dolphins', 'AFC', 'East', '#008E97', '#FC4C02', 14, -2.0, -2.5, 62.0, 0.58, false],
  ['MIN', 'Minnesota', 'Vikings', 'NFC', 'North', '#4F2683', '#FFC62F', 6, 0.0, 1.5, 63.5, 0.58, true],
  ['NE', 'New England', 'Patriots', 'AFC', 'East', '#002244', '#C60C30', 14, 3.5, 2.0, 64.0, 0.56, false],
  ['NO', 'New Orleans', 'Saints', 'NFC', 'South', '#D3BC8D', '#101820', 12, -3.0, -1.5, 62.5, 0.6, true],
  ['NYG', 'New York', 'Giants', 'NFC', 'East', '#0B2265', '#A71930', 9, -1.0, -1.0, 64.0, 0.58, false],
  ['NYJ', 'New York', 'Jets', 'AFC', 'East', '#125740', '#B9C4C0', 9, -3.0, -2.0, 61.5, 0.54, false],
  ['PHI', 'Philadelphia', 'Eagles', 'NFC', 'East', '#004C54', '#A5ACAF', 13, 2.0, 3.0, 62.5, 0.48, false],
  ['PIT', 'Pittsburgh', 'Steelers', 'AFC', 'North', '#FFB612', '#101820', 6, -0.5, 1.5, 62.0, 0.55, false],
  ['SF', 'San Francisco', '49ers', 'NFC', 'West', '#AA0000', '#B3995D', 14, 2.5, 1.0, 64.0, 0.55, false],
  ['SEA', 'Seattle', 'Seahawks', 'NFC', 'West', '#002244', '#69BE28', 12, 3.5, 4.5, 63.5, 0.55, false],
  ['TB', 'Tampa Bay', 'Buccaneers', 'NFC', 'South', '#D50A0A', '#34302B', 8, 2.0, 0.0, 64.5, 0.6, false],
  ['TEN', 'Tennessee', 'Titans', 'AFC', 'South', '#0C2340', '#4B92DB', 10, -4.5, -2.5, 62.0, 0.58, false],
  ['WAS', 'Washington', 'Commanders', 'NFC', 'East', '#5A1414', '#FFB612', 14, 1.5, -1.5, 65.0, 0.56, false],
];

function rankBy(values: number[], desc = true) {
  const idx = values.map((v, i) => [v, i] as const).sort((a, b) => (desc ? b[0] - a[0] : a[0] - b[0]));
  const ranks = new Array(values.length);
  idx.forEach(([, i], r) => (ranks[i] = r + 1));
  return ranks as number[];
}

export function buildTeams(): Team[] {
  const r = rng(2026);
  const base = ROWS.map((row) => ({ row, noise: { pb: r(), rb: r(), pr: r(), qb: r(), rbp: r(), wr: r(), te: r() } }));
  const pbRank = rankBy(base.map((b) => b.row[8] + (b.noise.pb - 0.5) * 6));
  const rbRank = rankBy(base.map((b) => b.row[8] + (b.noise.rb - 0.5) * 7));
  const prRank = rankBy(base.map((b) => b.row[9] + (b.noise.pr - 0.5) * 6));
  const vs = (k: 'qb' | 'rbp' | 'wr' | 'te') => rankBy(base.map((b) => b.row[9] + (b.noise[k] - 0.5) * 7));
  const vsPos: Record<SkillPosition, number[]> = { QB: vs('qb'), RB: vs('rbp'), WR: vs('wr'), TE: vs('te') };
  return base.map(({ row }, i) => {
    const [id, city, name, conference, division, primary, secondary, bye, off, def, pace, passRate, dome] = row;
    return {
      id, city, name, conference, division, bye, offRating: off, defRating: def, pace, passRate, dome,
      colors: { primary, secondary },
      oLinePassBlockRank: pbRank[i],
      oLineRunBlockRank: rbRank[i],
      passRushRank: prRank[i],
      defVsPos: { QB: vsPos.QB[i], RB: vsPos.RB[i], WR: vsPos.WR[i], TE: vsPos.TE[i] },
    };
  });
}
