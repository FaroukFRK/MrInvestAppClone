// Persistence in the browser (localStorage) plus demo data. All data stays on the user's device.
import { isoDate, summarize } from './portfolio.js';

const KEY = 'portfolio-tracker:v1';

export function demoState() {
  let seq = 0;
  const t = (date, type, rest) => ({ id: `demo-${++seq}`, seq, date, type, fee: 0, ...rest });
  return {
    version: 1,
    settings: { name: 'My Portfolio', currency: 'USD', locale: 'en-US', allocBy: 'ticker', isDemo: true },
    trades: [
      t('2025-01-06', 'deposit', { amount: 60000 }),
      t('2025-01-07', 'buy', { ticker: 'VT', shares: 120, price: 116.4, fee: 1 }),
      t('2025-01-07', 'buy', { ticker: 'MSFT', shares: 30, price: 424.5, fee: 1 }),
      t('2025-02-12', 'buy', { ticker: 'NVDA', shares: 80, price: 132.8, fee: 1 }),
      t('2025-03-18', 'buy', { ticker: 'ASML', shares: 10, price: 712.0, fee: 2 }),
      t('2025-04-09', 'buy', { ticker: 'AMZN', shares: 40, price: 182.3, fee: 1 }),
      t('2025-05-21', 'deposit', { amount: 20000 }),
      t('2025-05-22', 'buy', { ticker: 'NU', shares: 600, price: 12.4, fee: 1 }),
      t('2025-06-16', 'dividend', { ticker: 'MSFT', amount: 24.9 }),
      t('2025-07-03', 'buy', { ticker: 'GOOGL', shares: 45, price: 178.6, fee: 1 }),
      t('2025-08-14', 'sell', { ticker: 'NVDA', shares: 20, price: 182.0, fee: 1 }),
      t('2025-09-10', 'buy', { ticker: 'COST', shares: 6, price: 915.0, fee: 1 }),
      t('2025-11-04', 'buy', { ticker: 'MELI', shares: 3, price: 2010.0, fee: 2 }),
      t('2025-12-15', 'dividend', { ticker: 'VT', amount: 118.2 }),
      t('2026-02-02', 'deposit', { amount: 10000 }),
      t('2026-02-03', 'buy', { ticker: 'VT', shares: 40, price: 132.1, fee: 1 }),
      t('2026-04-22', 'sell', { ticker: 'AMZN', shares: 15, price: 214.0, fee: 1 }),
      t('2026-06-11', 'buy', { ticker: 'MSFT', shares: 8, price: 468.0, fee: 1 }),
      t('2026-09-08', 'buy', { ticker: 'NU', shares: 300, price: 16.2, fee: 1 }),
    ],
    // Demo prices only. Edit them in the app ("Update prices"); there is no live price feed.
    prices: {
      VT: { name: 'Vanguard Total World Stock ETF', sector: 'ETF', price: 138.42, prevClose: 137.9 },
      MSFT: { name: 'Microsoft', sector: 'Technology', price: 482.1, prevClose: 485.6 },
      NVDA: { name: 'NVIDIA', sector: 'Technology', price: 196.3, prevClose: 192.75 },
      ASML: { name: 'ASML Holding', sector: 'Technology', price: 845.0, prevClose: 838.2 },
      AMZN: { name: 'Amazon', sector: 'Consumer', price: 226.4, prevClose: 228.1 },
      NU: { name: 'Nu Holdings', sector: 'Financials', price: 17.05, prevClose: 16.88 },
      GOOGL: { name: 'Alphabet', sector: 'Communication', price: 251.7, prevClose: 249.3 },
      COST: { name: 'Costco', sector: 'Consumer', price: 948.0, prevClose: 951.4 },
      MELI: { name: 'MercadoLibre', sector: 'Consumer', price: 2188.0, prevClose: 2161.5 },
    },
    snapshots: [],
  };
}

export function emptyState() {
  return {
    version: 1,
    settings: { name: 'My Portfolio', currency: 'USD', locale: 'en-US', allocBy: 'ticker', isDemo: false },
    trades: [],
    prices: {},
    snapshots: [],
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* private mode or corrupt data: fall through to demo */ }
  return demoState();
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch { return false; }
}

export function normalize(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.trades)) throw new Error('Not a portfolio backup file.');
  const base = emptyState();
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...(s.settings || {}) },
    prices: s.prices || {},
    snapshots: Array.isArray(s.snapshots) ? s.snapshots : [],
  };
}

/** Record one value snapshot per day so the chart gets real history going forward. */
export function recordSnapshot(state, today = isoDate(new Date())) {
  if (!state.trades.length) return;
  const value = summarize(state.trades, state.prices).total;
  const i = state.snapshots.findIndex((x) => x.date === today);
  if (i >= 0) state.snapshots[i].value = value;
  else state.snapshots.push({ date: today, value });
  if (state.snapshots.length > 3650) state.snapshots.splice(0, state.snapshots.length - 3650);
}
