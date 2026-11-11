# Portfolio Tracker

An installable web app (PWA) for tracking a stock portfolio: holdings with weights, buy/sell history, cash, dividends,
returns, an allocation donut and a value-over-time chart. Inspired by the public portfolio page of
mrinvestapp.com, but it's an original app with its own design and your own data.

- **No build step, no dependencies, no API keys.** Plain HTML/CSS/JS modules in `app/`.
- **Private:** data lives only in your browser (localStorage). Export/import a JSON backup or a CSV of trades.
- **Works offline and installs to your phone** ("Add to Home Screen") via the service worker and manifest.
- Prices are entered by hand ("Update prices"); there is no live price feed.

## Run locally
```bash
npm start        # serves app/ at http://localhost:8080
npm test         # unit tests for the portfolio maths (Node 20+)
```

## Publish it (free, GitHub Pages)
1. Merge this branch into `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/pages.yml` tests and deploys `app/`. The site appears at
   `https://<your-username>.github.io/MrInvestAppClone/`.

## CSV format
`date,type,ticker,shares,price,amount,fee,note`. `type` is `buy`, `sell`, `dividend`, `deposit` or `withdraw`.
Buys and sells use `shares` and `price`; the other types use `amount`.

## Context files
`CLAUDE.md` (how to work), `PROJECT_CONTEXT.md` (status), `docs/` (architecture and decisions).

_For personal record-keeping and education only. Not investment advice._
