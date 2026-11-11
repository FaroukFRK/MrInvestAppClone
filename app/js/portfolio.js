// Pure portfolio maths. No DOM, no storage: everything here is unit-tested (tests/portfolio.test.mjs).
//
// Transactions (state.trades) are the single source of truth. Holdings, cash and P/L are derived from them.
//   { id, date: 'YYYY-MM-DD', type: 'buy'|'sell'|'dividend'|'deposit'|'withdraw',
//     ticker?, shares?, price?, amount?, fee? }
// Cost basis uses the average-cost method.

export const TYPES = ['buy', 'sell', 'dividend', 'deposit', 'withdraw'];

const EPS = 1e-9;

export function sortTrades(trades) {
  return [...trades].sort((a, b) => (a.date === b.date ? (a.seq ?? 0) - (b.seq ?? 0) : a.date < b.date ? -1 : 1));
}

/** Check one transaction; returns an error message or null. `positions` = shares held before it. */
export function validateTrade(t, positions = {}) {
  if (!TYPES.includes(t.type)) return 'Unknown transaction type.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date || '')) return 'Date must be YYYY-MM-DD.';
  if (t.type === 'buy' || t.type === 'sell') {
    if (!t.ticker) return 'Ticker is required.';
    if (!(t.shares > 0)) return 'Shares must be greater than 0.';
    if (!(t.price >= 0)) return 'Price must be 0 or more.';
    if (t.type === 'sell' && (positions[t.ticker] ?? 0) + EPS < t.shares) {
      return `You only hold ${round(positions[t.ticker] ?? 0, 6)} ${t.ticker} on ${t.date}.`;
    }
  } else {
    if (!(t.amount > 0)) return 'Amount must be greater than 0.';
    if (t.type === 'dividend' && !t.ticker) return 'Ticker is required for a dividend.';
  }
  if (t.fee != null && t.fee < 0) return 'Fee cannot be negative.';
  return null;
}

/** Replay transactions in date order. Returns per-ticker lots plus cash and P/L totals. */
export function replay(trades) {
  const lots = {}; // ticker -> { shares, cost, realized, dividends, lastPrice, firstDate }
  let cash = 0, deposits = 0, withdrawals = 0, fees = 0, realized = 0, dividends = 0;
  for (const t of sortTrades(trades)) {
    const fee = t.fee || 0;
    fees += fee;
    const lot = t.ticker ? (lots[t.ticker] ??= { shares: 0, cost: 0, realized: 0, dividends: 0, lastPrice: 0, firstDate: t.date }) : null;
    switch (t.type) {
      case 'buy':
        lot.shares += t.shares;
        lot.cost += t.shares * t.price + fee;
        lot.lastPrice = t.price;
        cash -= t.shares * t.price + fee;
        break;
      case 'sell': {
        const avg = lot.shares > EPS ? lot.cost / lot.shares : 0;
        const pnl = t.shares * t.price - fee - avg * t.shares;
        lot.realized += pnl;
        realized += pnl;
        lot.cost -= avg * t.shares;
        lot.shares -= t.shares;
        if (lot.shares < EPS) { lot.shares = 0; lot.cost = 0; }
        lot.lastPrice = t.price;
        cash += t.shares * t.price - fee;
        break;
      }
      case 'dividend':
        lot.dividends += t.amount - fee;
        dividends += t.amount - fee;
        cash += t.amount - fee;
        break;
      case 'deposit':
        deposits += t.amount;
        cash += t.amount - fee;
        break;
      case 'withdraw':
        withdrawals += t.amount;
        cash -= t.amount + fee;
        break;
    }
  }
  return { lots, cash, deposits, withdrawals, fees, realized, dividends };
}

/**
 * Full portfolio summary at current prices.
 * prices: { TICKER: { price, prevClose?, name?, sector? } }
 */
export function summarize(trades, prices = {}) {
  const r = replay(trades);
  const holdings = [];
  for (const [ticker, lot] of Object.entries(r.lots)) {
    if (lot.shares < EPS) continue;
    const p = prices[ticker] || {};
    const price = p.price ?? lot.lastPrice;
    const prev = p.prevClose ?? price;
    const value = lot.shares * price;
    holdings.push({
      ticker,
      name: p.name || ticker,
      sector: p.sector || 'Other',
      shares: lot.shares,
      avgCost: lot.cost / lot.shares,
      cost: lot.cost,
      price,
      value,
      dayChange: lot.shares * (price - prev),
      dayChangePct: prev ? (price - prev) / prev : 0,
      unrealized: value - lot.cost,
      unrealizedPct: lot.cost ? (value - lot.cost) / lot.cost : 0,
      realized: lot.realized,
      dividends: lot.dividends,
      firstDate: lot.firstDate,
      weight: 0,
    });
  }
  const invested = holdings.reduce((s, h) => s + h.value, 0);
  const cost = holdings.reduce((s, h) => s + h.cost, 0);
  const total = invested + r.cash;
  for (const h of holdings) h.weight = total > EPS ? h.value / total : 0;
  holdings.sort((a, b) => b.value - a.value);
  const dayChange = holdings.reduce((s, h) => s + h.dayChange, 0);
  const netContrib = r.deposits - r.withdrawals;
  const unrealized = invested - cost;
  return {
    holdings,
    cash: r.cash,
    invested,
    cost,
    total,
    dayChange,
    dayChangePct: total - dayChange > EPS ? dayChange / (total - dayChange) : 0,
    unrealized,
    unrealizedPct: cost > EPS ? unrealized / cost : 0,
    realized: r.realized,
    dividends: r.dividends,
    fees: r.fees,
    deposits: r.deposits,
    withdrawals: r.withdrawals,
    netContrib,
    // Total return vs. money put in. If no deposits were recorded, fall back to cost basis.
    totalReturn: netContrib > EPS ? total - netContrib : unrealized + r.realized + r.dividends,
    totalReturnPct: netContrib > EPS ? (total - netContrib) / netContrib : (cost > EPS ? (unrealized + r.realized + r.dividends) / cost : 0),
  };
}

/** Group holdings (plus cash) by a key for the allocation chart. */
export function allocation(summary, by = 'ticker') {
  const groups = new Map();
  for (const h of summary.holdings) {
    const k = by === 'sector' ? h.sector : h.ticker;
    groups.set(k, (groups.get(k) || 0) + h.value);
  }
  if (summary.cash > EPS) groups.set('Cash', (groups.get('Cash') || 0) + summary.cash);
  const total = [...groups.values()].reduce((s, v) => s + v, 0);
  return [...groups.entries()]
    .map(([label, value]) => ({ label, value, weight: total > EPS ? value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Portfolio value over time. There is no historical price feed (no API keys), so each past point is valued at
 * the last known price for each ticker: its last trade price, or a saved daily snapshot when one exists.
 * The final point uses current prices.
 */
export function valueHistory(trades, prices = {}, snapshots = [], today = isoDate(new Date())) {
  const sorted = sortTrades(trades);
  const dates = [...new Set(sorted.map((t) => t.date))];
  const points = [];
  for (const d of dates) {
    const s = summarize(sorted.filter((t) => t.date <= d)); // trade prices only
    points.push({ date: d, value: s.total, contrib: s.netContrib });
  }
  const byDate = new Map(points.map((p) => [p.date, p]));
  for (const snap of snapshots) {
    if (snap.date >= (dates[0] ?? snap.date) && snap.date < today) {
      const s = summarize(sorted.filter((t) => t.date <= snap.date));
      byDate.set(snap.date, { date: snap.date, value: snap.value, contrib: s.netContrib });
    }
  }
  if (sorted.length) {
    const s = summarize(sorted, prices);
    byDate.set(today, { date: today, value: s.total, contrib: s.netContrib });
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function positionsBefore(trades, date, excludeId) {
  const r = replay(trades.filter((t) => t.date <= date && t.id !== excludeId));
  return Object.fromEntries(Object.entries(r.lots).map(([k, v]) => [k, v.shares]));
}

/** After an edit or delete, check that no sell ever exceeds the shares held at that time. */
export function findOversell(trades) {
  const held = {};
  for (const t of sortTrades(trades)) {
    if (t.type === 'buy') held[t.ticker] = (held[t.ticker] || 0) + t.shares;
    if (t.type === 'sell') {
      if ((held[t.ticker] || 0) + EPS < t.shares) return t;
      held[t.ticker] -= t.shares;
    }
  }
  return null;
}

export function isoDate(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function round(n, dp = 2) {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
}

// ---- CSV ----
const CSV_COLS = ['date', 'type', 'ticker', 'shares', 'price', 'amount', 'fee', 'note'];

export function tradesToCsv(trades) {
  const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [CSV_COLS.join(','), ...sortTrades(trades).map((t) => CSV_COLS.map((c) => esc(t[c])).join(','))].join('\n');
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** CSV with header (date,type,ticker,shares,price,amount,fee,note) -> trades. Throws on bad rows. */
export function csvToTrades(text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const idx = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));
  for (const c of ['date', 'type']) if (!(c in idx)) throw new Error(`CSV is missing the "${c}" column.`);
  const num = (v) => (v == null || v.trim() === '' ? undefined : Number(v));
  return rows.map((r, i) => {
    const get = (c) => (c in idx ? r[idx[c]] : undefined);
    const t = {
      id: `csv-${Date.now().toString(36)}-${i}`,
      seq: i,
      date: get('date')?.trim(),
      type: get('type')?.trim().toLowerCase(),
      ticker: get('ticker')?.trim().toUpperCase() || undefined,
      shares: num(get('shares')),
      price: num(get('price')),
      amount: num(get('amount')),
      fee: num(get('fee')) || 0,
      note: get('note') || undefined,
    };
    const err = validateTrade(t, { [t.ticker]: Infinity });
    if (err) throw new Error(`Row ${i + 2}: ${err}`);
    return t;
  });
}
