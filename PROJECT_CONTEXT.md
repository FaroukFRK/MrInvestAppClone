# PROJECT_CONTEXT.md: where the project stands now

> **The single context file.** It's auto-loaded at session start and after compaction (`.claude/settings.json` hook).
> Keep it current and under about 150 lines. How to work: `CLAUDE.md`. Durable knowledge: `docs/` (index `docs/README.md`).
> Last updated: 2026-11-11

## Goal
A portfolio-tracker app modelled on what mrinvestapp.com/portfolio does (holdings, weights, every buy/sell, total value),
built as an original installable web app with the owner's own data. Free to host, no API keys.

## Status
- v1 works: overview (KPIs, value chart, allocation donut by holding/sector, top movers, recent trades), sortable holdings
  table, trade history with edit/delete, add buy/sell/dividend/deposit/withdraw, manual price updates, holding detail,
  JSON backup + CSV import/export, demo data, light/dark, mobile layout, offline/PWA install.
- 8 unit tests pass (`npm test`); checked in Chromium at desktop and iPhone sizes with no console errors.
- Branch `ccr-dc6a3142-amabou`. Not deployed yet (see Next).

## Current session (2026-11-11)
- Built v1 from scratch. The original site was blocked from the container, so the feature set comes from a web search
  of its public pages (portfolio value, positions with weights, buy/sell history).

## Done
1. v1 app in `app/`, tests in `tests/`, Pages workflow, docs filled in.

## In progress
- None.

## Next (only after the owner says "okay")
- Merge to `main` and turn on GitHub Pages (Settings → Pages → Source: GitHub Actions).
- Ideas: a free price source (would need the owner's OK), multi-currency holdings with FX, a public read-only "share"
  view like the original site, benchmark comparison (e.g. vs. an index), sell using FIFO lots.

## Open problems and caveats
- Past chart points use last trade prices (no historical price feed); real daily snapshots accumulate from first use.
- Single currency per portfolio; no FX.
- Data lives in one browser: use Export backup to move it.

## Quick commands
`npm test` · `npm start` (http://localhost:8080)
