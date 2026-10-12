# Gridiron Edge — Architecture

## 1. Goals

One fast, dense, keyboard-friendly workspace for fantasy and betting research. Every
number on screen is a function of **(data snapshot × active league)**. When you switch
leagues, every valuation, ranking and recommendation is recomputed for that league.

## 2. Layers

```
┌────────────────────────────────────────────────────────────────────┐
│ UI (React + Tailwind + shadcn-style primitives + Recharts)         │
│   features/*  ── screens, each a folder with its own components    │
│   components/ui      ── primitives (Button, Card, Tabs, Dialog…)   │
│   components/common  ── domain atoms (PlayerAvatar, StatPill…)     │
│   components/layout  ── AppShell, Sidebar, TopBar, ⌘K palette      │
├────────────────────────────────────────────────────────────────────┤
│ State                                                              │
│   TanStack Query  ── server/data state, cache, "last updated"      │
│   Zustand (persisted to localStorage)                              │
│     leagues · ui (theme/density) · trades · bets · watchlist       │
├────────────────────────────────────────────────────────────────────┤
│ Hooks: useUniverse() → players + valuations for the active league  │
├────────────────────────────────────────────────────────────────────┤
│ Engine (pure TS, no React; unit-tested)                            │
│   valuation/  scoring · redraft · dynasty · picks · aging · config │
│   trade/      evaluate · suggest · timeline · lineupImpact         │
│   lineup/     optimizer (slot fill + confidence)                   │
│   betting/    odds math · model edges · bet tracker stats          │
├────────────────────────────────────────────────────────────────────┤
│ Data layer                                                         │
│   repository.ts  ── one façade the UI talks to                     │
│   sources/       ── MockSource · SleeperSource · EspnSource ·      │
│                     NflverseSource (all implement DataSource)      │
│   http.ts        ── fetch w/ TTL cache, token-bucket rate limiter, │
│                     429/5xx backoff, timestamps                    │
│   mock/          ── seeded, deterministic realistic dataset        │
└────────────────────────────────────────────────────────────────────┘
```

### Swappable sources

`DataSource` is a small interface (`getPlayers`, `getTeams`, `getSchedule`,
`getGameLogs`, `getOdds`, `getProps`, `getNews`, `getTrending`, …). The repository
asks the configured source first and **falls back to the mock source** on any
error, so the app always works without keys or network. Every response is wrapped
as `Sourced<T> = { data, source, fetchedAt, stale }` so screens can show a
"last updated" stamp and the source that produced it.

| Source   | Used for                                  | Auth |
|----------|-------------------------------------------|------|
| Mock     | everything (deterministic fallback)       | none |
| Sleeper  | league import, rosters, trending adds, headshots | none |
| ESPN     | scoreboard, news headlines                | none |
| nflverse | weekly player stats (CSV release assets)  | none |

## 3. Folder structure

```
src/
  main.tsx  App.tsx  routes.tsx
  styles/globals.css         design tokens (CSS variables) + base
  design/tokens.ts           JS mirror of tokens for charts
  lib/                       cn(), formatters, seeded RNG, stats helpers
  components/ui/             primitives (shadcn/ui pattern on Radix)
  components/common/         domain components
  components/charts/         chart wrappers with consistent theme
  components/layout/         shell, sidebar, top bar, mobile tab bar, ⌘K
  data/
    types.ts                 domain model
    http.ts                  cache + rate limit + retry
    repository.ts            façade used by hooks
    queries.ts               TanStack Query hooks
    sources/                 mock / sleeper / espn / nflverse adapters
    mock/                    seeded dataset (teams, players, schedule, logs, odds, news)
  engine/
    valuation/               config.ts scoring.ts aging.ts redraft.ts dynasty.ts picks.ts index.ts
    trade/                   evaluate.ts suggest.ts timeline.ts lineupImpact.ts
    lineup/                  optimizer.ts
    betting/                 odds.ts tracker.ts
  store/                     zustand stores (persisted)
  features/
    dashboard/ players/ matchups/ lineup/ trade/ betting/ waivers/ news/ leagues/
```

## 4. Valuation engine

All tunable numbers live in `engine/valuation/config.ts`. Both models output on the
same **0–10,000 market scale** so the trade chart, trade desk and rankings agree.

### 4.1 Shared inputs

| Input | Source |
|-------|--------|
| Per-game stat projection (pass/rush/rec yds, TDs, receptions, INT…) | data layer |
| League scoring (PPR 1 / 0.5 / 0, TE premium, pass TD pts) | active league |
| Starting slots, teams, Superflex | active league |
| Remaining schedule & defense-vs-position ranks | data layer |
| Injury status → availability & risk | data layer |
| Age, years of experience, contract years, draft capital | data layer |

`scoring.ts` converts the stat line into fantasy points per game under the league's
scoring, so a TE in TE-premium and a QB in 6-pt-pass-TD leagues are valued correctly.

### 4.2 Replacement level & scarcity (both models)

```
demand[pos] = teams × starters[pos] + teams × flexShare[pos] × flexSlots
            (+ teams × superflexShare[pos] for SF; QB ≈ 0.9 of every SF slot)
replacement[pos] = value of the (demand[pos] + 1)-th player at that position
VORP = points − replacement
```
Superflex therefore raises QB demand from ~12 to ~23 in a 12-team league, which
lowers the QB replacement level and lifts every QB's VORP — no special-casing.

### 4.3 Redraft model (rest of season)

```
for each remaining week w (skip bye):
  m_w     = matchupMultiplier(defRankVsPos_w)        // 0.85 … 1.15
  a_w     = availability_w(injury status, risk)      // out weeks = 0
  wt_w    = 1 + playoffBoost if w ∈ fantasy playoffs // weeks 15–17
  pts_w   = ppg × m_w × a_w
ROS       = Σ pts_w × wt_w
VORP_ros  = ROS − replacementROS[pos]
value     = scale(VORP_ros) × (1 − riskHaircut × injuryRisk)
```
`scale()` maps VORP to the 0–10k market scale with a convex curve
(`10000 × (v / vmax)^0.8`) so elite players separate from the pack, as real
market charts do. Draft picks have **no** redraft value (shown as "dynasty only").

### 4.4 Dynasty model (multi-year)

```
for year y = 0…4:
  ageFactor_y  = curve[pos](age + y) / curve[pos](age)   // positional aging curve
  control_y    = y < contractYears ? 1 : 0.94            // contract / years of control
  survival_y   = Π (1 − attrition[pos](age + k))          // career-ending risk
  ppg_y        = talentPPG × ageFactor_y × control_y × survival_y
  VORP_y       = 17 × ppg_y − replacementSeason[pos]
dynastyRaw = Σ VORP_y × discount^y  (current season × 0.7)   // discount by strategy
value      = scale(dynastyRaw) + rookie/draft-capital premium
```
Aging curves (peak plateaus): RB 23–26, WR 25–28, TE 26–29, QB 27–33 with
position-specific decline slopes. A 30-year-old RB keeps redraft value but loses most
dynasty value; a 22-year-old WR gets the reverse.

Discount rate by team strategy: **win-now 0.55**, **balanced 0.75**, **rebuild 0.90**.

### 4.5 Keeper

`keeper = redraft + keeperWeight × next-season value`. A two-season horizon between
redraft and dynasty.

### 4.6 Draft picks

```
slotValue(pick#) = 7600 × e^(−0.055 × (pick#−1)) + floor   // 1.01 ≈ 7.6k
projectedSlot    = from owner's projected finish (early/mid/late) or explicit slot
yearDiscount     = 0.88^(yearsOut)                           // future-pick haircut
Superflex        = 1.10× on 1st-round picks (QBs in class)
```

### 4.7 Trade evaluation

1. Each asset's **mode value** = redraft (redraft), keeper (keeper) or
   `w × redraft + (1−w) × dynasty` (dynasty, `w` from strategy: win-now 0.45,
   balanced 0.25, rebuild 0.10).
2. **Consolidation adjustment**: within a side, assets sorted by value receive
   weights `1, 0.88, 0.78, 0.70, …` — the side getting the best player is paid for
   the roster spot it frees.
3. `delta = received − sent`, `fairness = delta / max(received, sent)`.
   `|fairness| ≤ 6%` → **Fair**; above → **Win**; below → **Lose**.
4. Redraft lineup impact: optimal lineup before/after, weekly projected points delta.
5. Timeline: cumulative VORP for 1 week, rest of season, 3 seasons.
6. "What would make this fair?" searches the counter-party roster and pick pool for
   single assets (or a removal) that bring `|fairness|` inside the fair band.

### 4.8 Lineup optimizer

Fill most-restrictive slots first (QB, RB, WR, TE, K, DST), then FLEX, then SUPERFLEX
from the remaining pool by projected points. Confidence for each start/sit:
`Φ(gap / √(σ₁² + σ₂²))` between the started player and the best benched alternative,
reported 50–99, plus reasons (matchup rank, implied total, trend, injury).

### 4.9 Betting

Model spread/total from team power ratings and pace; win probability via
`Φ(margin / 13.5)`; implied probability from American odds with the vig removed.
`edge = modelProb − impliedProb`; value flag at ≥ 3%. Props use a normal model around
the player projection. Tracker computes units, ROI, win rate and running P/L.

## 5. Design system

Tokens live in `src/styles/globals.css` as HSL CSS variables and are exposed through
`tailwind.config.ts`; charts read the same tokens via `design/tokens.ts`.

- **Color**: navy/charcoal surfaces (`--bg`, `--surface-1..3`), one accent (sky blue),
  `--pos`/`--neg` reserved for positive/negative values, warning for injury.
- **Type scale**: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 30 px. Inter for UI, JetBrains
  Mono / tabular numerals for stat columns.
- **Spacing**: 4px base (Tailwind scale); cards use 16/20px padding.
- **Radii**: 6 / 8 / 12 / 16 px. **Shadows**: three elevation levels + accent glow.
