# Architecture

Static, dependency-free PWA. No build step: the browser loads ES modules directly.

| Path | Holds |
|---|---|
| `app/index.html` | All markup: top bar, 4 views (overview, holdings, trades, settings), dialogs (trade, prices, holding detail), mobile bottom tabs |
| `app/js/portfolio.js` | **Pure maths** (no DOM): replay transactions, average-cost basis, P/L, weights, allocation, value history, validation, CSV. Unit-tested |
| `app/js/storage.js` | localStorage load/save, demo data, empty state, daily value snapshots |
| `app/js/charts.js` | Hand-written SVG donut and line chart (hover tooltip) |
| `app/js/app.js` | UI: hash routing, rendering, forms, dialogs, import/export |
| `app/css/styles.css` | Styles; light/dark via CSS variables; mobile layout below 860px |
| `app/sw.js`, `app/manifest.webmanifest`, `app/icons/` | Offline cache and install-to-home-screen |
| `tests/portfolio.test.mjs` | `node --test` tests for `portfolio.js` |
| `.github/workflows/pages.yml` | Runs tests; deploys `app/` to GitHub Pages on push to `main` |

## Data flow
State = `{ settings, trades[], prices{}, snapshots[] }` in localStorage key `portfolio-tracker:v1`.
`trades` is the single source of truth. Every render calls `summarize(trades, prices)`, which replays transactions in
date order to get holdings, cash and P/L. Price edits only change `prices`. One `{date, value}` snapshot per day is
saved when the app is opened or data changes, so the chart gains real history over time; earlier points are valued at
each holding's last trade price.

Transaction types: buy, sell (shares + price + fee), dividend (ticker + amount), deposit, withdraw (amount).
Sells can't exceed the shares held on that date (checked on add, edit, delete and CSV import).

## Build and deploy
None needed. `npm start` serves `app/` locally. GitHub Pages deploys via Actions once Pages source is set to
"GitHub Actions". Bump `CACHE` in `app/sw.js` when shipping changes so installed apps pick them up.
