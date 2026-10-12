# Gridiron Edge

An NFL analytics workstation for fantasy football lineups, trades and betting research. It's dense with data, keyboard-first, and every number is priced for the league you have active.

> **Research only.** Trade verdicts, projections, start/sit calls and betting edges are model estimates for informational and entertainment purposes. They are not financial or gambling advice. If you bet, bet responsibly.

## Features

| Area | What you get |
|---|---|
| **Dashboard** | This week's slate (spreads, totals, implied team totals), your optimal lineup with confidence, top matchup plays, injury alerts, line movement, your leagues and saved players |
| **Players** | Sortable/filterable rankings table (virtualized, sticky headers, column toggles, density). Deep dive with redraft, dynasty and keeper values side by side, production vs projection, a weekly outcome distribution, usage trends, an efficiency grid, a percentile radar, game log, splits (home/away, defense tier, weather), rest-of-season schedule heat, a 5-year dynasty outlook and an aging curve |
| **Matchups** | Game-by-game implied totals, O-line vs pass-rush trench battle, pace and pass rate, starters vs positional defense rank, and a sortable defense-vs-position heat map |
| **Lineup optimizer** | Optimal start/sit with a 50–99 confidence score and plain-English reasoning, lock-in slots, floor/ceiling ranges, toughest calls, a roster editor, and a head-to-head player comparison tool |
| **Trade analyzer** | Two- or three-team trade desk with drag-and-drop, picks included, a Redraft/Dynasty toggle with animated values, a fairness gauge, a verdict banner, reasoning for each side, starting-lineup impact, a "who wins by when" timeline, a "what would make this fair?" suggester, a trade value chart that adjusts for mode and Superflex, and saved trade history that is re-priced with current values |
| **Betting hub** | Spreads, totals and moneylines vs the model with edge % and value flags; player props with model projections; line movement charts; a bet tracker (units, ROI, win rate, streak, cumulative P/L) |
| **Waivers** | Win-now pickups (rest-of-season value, next-4-week schedule), dynasty stashes (young, high-upside), and trending adds |
| **News & injuries** | Filter by your players, watchlist, team or type |

**League modes.** Each saved league is Redraft, Dynasty or Keeper, with a Superflex/2QB toggle on top. Each league also stores its own scoring (PPR / half / standard, TE premium, pass-TD points), team count, roster size, starting slots and your team strategy (win now / balanced / rebuild). Switch leagues from the top bar and every valuation, ranking and recommendation re-prices. The sliders icon in the top bar edits these settings in place.

## Getting started

Requires Node 18+ (tested on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # valuation, trade, lineup and betting engine tests
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build
```

No API keys are needed. On first launch the app seeds three demo leagues (redraft, dynasty Superflex, keeper) and a sample bet history so every screen has data. All of it is stored in `localStorage`. **Settings → Reset everything** restores the demo data.

### Keyboard

| Keys | Action |
|---|---|
| `⌘K` / `Ctrl K` / `/` | Command palette: search players, switch leagues, jump to tools |
| `G` then `D P M N L T W B` | Go to Dashboard, Players, Matchups, News, Lineup, Trade, Waivers, Betting |
| `[` | Collapse/expand the sidebar |

## Data sources

The UI talks to one façade, `src/data/repository.ts`. Each call tries the configured live source and falls back to the offline model, and every response carries its source and fetch time, which the screens show as "Updated … · Source".

| Source | Used for | Notes |
|---|---|---|
| **Offline model** (`sources/mock.ts`) | Everything (fallback) | Seeded and deterministic: 2026 schedule, game logs, odds, props, news. Values are illustrative priors, not official data |
| **Sleeper** (`sources/sleeper.ts`) | League import by username, rosters, traded picks, trending adds, headshots | Public, keyless API. The 5 MB player dump is fetched at most daily and reduced to a compact index |
| **ESPN** (`sources/espn.ts`) | News headlines | Public site API |
| **nflverse** (`sources/nflverse.ts`) | Real weekly game logs | Opt-in under Settings (season CSV is a few MB) |

`src/data/http.ts` provides TTL caching (memory + `localStorage` for small payloads), per-host token-bucket rate limiting, retries with exponential backoff on 429/5xx (it honors `Retry-After`), request de-duplication and timeouts.

To add a provider, such as an odds API, implement the relevant methods of `DataSource` (`src/data/sources/types.ts`) and wire it into `repository.ts`.

**Importing a league:** open **Leagues → Import from Sleeper**, enter a username and pick a league. Mode, scoring, slots, rosters and traded picks come across. Players the model doesn't cover are added with baseline projections. You can also **create a league manually** and enter rosters in **Lineup → Edit roster**.

## Valuation engine

`src/engine/` is plain TypeScript with no React. Each part can be tuned and tested on its own:

```
engine/
  valuation/  config.ts   ← every tunable number lives here
              scoring.ts  league scoring → fantasy points
              redraft.ts  rest-of-season model (matchups, byes, injuries, playoff weeks)
              dynasty.ts  5-year model (aging curves, contract control, role growth)
              aging.ts    positional aging curves + attrition
              picks.ts    draft pick values by year / slot / Superflex
              index.ts    valueUniverse(): replacement levels, VORP, 0–10k market scale
  trade/      evaluate.ts verdicts, consolidation premium, reasons, lineup impact, timeline
              suggest.ts  "what would make this fair?"
  lineup/     optimizer.ts slot filling + start/sit confidence
  betting/    odds.ts, model.ts, tracker.ts
```

Redraft and dynasty are separate models on the same 0–10,000 scale. Superflex is not special-cased: it raises QB demand, which lowers the QB replacement level. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the formulas.

To retune, edit `src/engine/valuation/config.ts`. For example:

- `trade.fairBand` sets how close counts as Fair.
- `dynasty.discount` sets how much each strategy discounts future seasons.
- `agingCurves` sets the positional aging curves.
- `picks.top` / `picks.decay` set the pick value curve.

Then run `npm test`. `npx vite-node scripts/inspect-values.ts dynasty sf` prints the top of the board for a quick sanity check.

### Tests

`src/engine/__tests__/` has 46 tests covering scoring, aging curves, Superflex, aging and injured stars, players with no projection, draft picks (slot, year, Superflex, redraft = 0), trade symmetry and verdicts, the consolidation premium, strategy weighting, three-team trades, the fair suggester, lineup optimizer edge cases, odds math and bet tracker stats.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS with shadcn/ui-style primitives on Radix, Recharts, TanStack Table + Virtual + Query, Zustand (persisted), dnd-kit, Framer Motion, cmdk, Sonner and Lucide icons. Fonts are Inter and JetBrains Mono, with tabular numerals on stat columns.

## Design system

Tokens are defined before any screen, in `src/styles/globals.css` (HSL CSS variables, dark default with a light theme) and mirrored for charts in `src/design/tokens.ts`:

- **Colors:** navy/charcoal surfaces, one sky-blue accent. Green and red are reserved for positive and negative values, amber for injuries and warnings.
- **Type scale:** 11–38 px.
- **Spacing:** 4 px base.
- **Radii:** 6, 8, 12 and 16 px.
- **Shadows:** three elevation levels.

Chart series colors use a CVD-validated categorical order.

## Project layout

```
src/
  components/ui        primitives (button, card, dialog, select, segmented, tabs, …)
  components/common    domain components (PlayerAvatar, badges, DataTable, metrics, states)
  components/charts    chart theme, tooltip, sparkline
  components/layout    app shell, sidebar, top bar, ⌘K palette, mobile tab bar
  data/                types, http, repository, queries, sources/, mock/, demo leagues
  engine/              valuation, trade, lineup, betting (pure, tested)
  features/            one folder per screen
  hooks/ store/ lib/
docs/ARCHITECTURE.md   architecture + valuation formulas
```
