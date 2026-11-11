// UI wiring. Calculations live in portfolio.js; persistence in storage.js; charts in charts.js.
import {
  summarize, allocation, valueHistory, validateTrade, positionsBefore, findOversell,
  sortTrades, isoDate, tradesToCsv, csvToTrades,
} from './portfolio.js';
import { load, save, demoState, emptyState, normalize, recordSnapshot } from './storage.js';
import { donut, lineChart } from './charts.js';

let state = load();
let summary;
const ui = { holdSort: { key: 'value', dir: -1 }, holdQuery: '', tradeType: '', tradeQuery: '', editingId: null };

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- formatting ----------
const fmtCache = {};
function nf(opts) {
  const key = state.settings.locale + state.settings.currency + JSON.stringify(opts);
  return (fmtCache[key] ??= new Intl.NumberFormat(state.settings.locale, opts));
}
const money = (v) => nf({ style: 'currency', currency: state.settings.currency }).format(v || 0);
const moneyShort = (v) => nf({ style: 'currency', currency: state.settings.currency, notation: 'compact', maximumFractionDigits: 1 }).format(v || 0);
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v));
const pct = (v, sign = true) => (sign && v > 0 ? '+' : v < 0 ? '−' : '') + nf({ style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v || 0));
const qty = (v) => nf({ maximumFractionDigits: 6 }).format(v || 0);
const cls = (v) => (v > 1e-9 ? 'up' : v < -1e-9 ? 'down' : '');
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString(state.settings.locale, { year: 'numeric', month: 'short', day: 'numeric' });
const TYPE_LABEL = { buy: 'Buy', sell: 'Sell', dividend: 'Dividend', deposit: 'Deposit', withdraw: 'Withdraw' };

function persist() {
  // Leave "demo mode" as soon as the user records a real transaction.
  if (state.settings.isDemo && state.trades.some((t) => !String(t.id).startsWith('demo-'))) state.settings.isDemo = false;
  recordSnapshot(state);
  if (!save(state)) toast('Could not save: browser storage is unavailable.');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2800);
}

// ---------- routing ----------
const VIEWS = ['overview', 'holdings', 'trades', 'settings'];
function route() {
  const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  for (const name of VIEWS) $(`#view-${name}`).hidden = name !== v;
  $$('[data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
  if (v === 'overview') renderOverview(); // line chart needs a visible container to measure
}

// ---------- render ----------
function render() {
  summary = summarize(state.trades, state.prices);
  $('#portfolio-name').textContent = state.settings.name;
  document.title = `${state.settings.name} · Portfolio Tracker`;
  $('#demo-banner').hidden = !state.settings.isDemo;
  renderOverview();
  renderHoldings();
  renderTrades();
  renderSettings();
  renderDatalists();
}

function renderOverview() {
  if ($('#view-overview').hidden) return;
  const s = summary;
  $('#kpi-total').textContent = money(s.total);
  $('#kpi-day').innerHTML = `<span class="${cls(s.dayChange)}">${signed(s.dayChange)} (${pct(s.dayChangePct)})</span> today`;
  setKpi('#kpi-return', `${signed(s.totalReturn)} <small>${pct(s.totalReturnPct)}</small>`, s.totalReturn);
  setKpi('#kpi-unreal', `${signed(s.unrealized)} <small>${pct(s.unrealizedPct)}</small>`, s.unrealized);
  setKpi('#kpi-real', signed(s.realized), s.realized);
  setKpi('#kpi-div', money(s.dividends), 0);
  setKpi('#kpi-cash', money(s.cash), s.cash < 0 ? -1 : 0);
  setKpi('#kpi-count', String(s.holdings.length), 0);

  lineChart($('#chart-line'), valueHistory(state.trades, state.prices, state.snapshots), { fmt: money, fmtDate });

  const by = state.settings.allocBy;
  $$('[data-alloc]').forEach((b) => b.classList.toggle('on', b.dataset.alloc === by));
  const items = allocation(s, by);
  const d = donut($('#chart-donut'), items, {
    centerTop: moneyShort(s.total),
    centerBottom: `${items.length} ${by === 'sector' ? 'sectors' : 'items'}`,
    onHover: (it) => (it ? d.setCenter(pct(it.weight, false), it.label) : d.setCenter(moneyShort(s.total), `${items.length} ${by === 'sector' ? 'sectors' : 'items'}`)),
  });
  $('#alloc-legend').innerHTML = d.shown.map((it, i) =>
    `<li><span class="sw" style="background:${d.colors[i % d.colors.length]}"></span><span class="lg-label">${esc(it.label)}</span><span class="num">${pct(it.weight, false)}</span></li>`).join('')
    || '<li class="muted">No holdings yet.</li>';

  const movers = [...s.holdings].sort((a, b) => Math.abs(b.dayChangePct) - Math.abs(a.dayChangePct)).slice(0, 5);
  $('#movers').innerHTML = movers.map((h) => `
    <li class="row-link" data-ticker="${esc(h.ticker)}">
      <div><strong>${esc(h.ticker)}</strong><div class="muted small">${esc(h.name)}</div></div>
      <div class="num"><div>${money(h.price)}</div><div class="small ${cls(h.dayChangePct)}">${pct(h.dayChangePct)}</div></div>
    </li>`).join('') || '<li class="muted">No holdings yet.</li>';

  const recent = sortTrades(state.trades).reverse().slice(0, 6);
  $('#recent').innerHTML = recent.map(tradeListItem).join('') || '<li class="muted">No transactions yet.</li>';
}

function setKpi(sel, html, sign) {
  const n = $(sel);
  n.innerHTML = html;
  n.className = `kpi ${cls(sign)}`;
}

function tradeListItem(t) {
  const amt = t.type === 'buy' || t.type === 'sell' ? t.shares * t.price : t.amount;
  const detail = t.type === 'buy' || t.type === 'sell' ? `${qty(t.shares)} @ ${money(t.price)}` : (t.note ? esc(t.note) : '');
  return `<li>
    <div><span class="pill ${t.type}">${TYPE_LABEL[t.type]}</span> <strong>${esc(t.ticker || '')}</strong>
      <div class="muted small">${fmtDate(t.date)}${detail ? ' · ' + detail : ''}</div></div>
    <div class="num">${money(amt)}</div>
  </li>`;
}

function renderHoldings() {
  const { key, dir } = ui.holdSort;
  const q = ui.holdQuery.trim().toLowerCase();
  const rows = summary.holdings
    .filter((h) => !q || h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q))
    .sort((a, b) => (typeof a[key] === 'string' ? a[key].localeCompare(b[key]) : a[key] - b[key]) * dir);
  $$('#holdings-table th[data-sort]').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === key);
    th.dataset.dir = th.dataset.sort === key ? (dir > 0 ? '▲' : '▼') : '';
  });
  const maxW = Math.max(...summary.holdings.map((h) => h.weight), 0.0001);
  $('#holdings-table tbody').innerHTML = rows.map((h) => `
    <tr class="row-link" data-ticker="${esc(h.ticker)}">
      <td><strong>${esc(h.ticker)}</strong><div class="muted small">${esc(h.name)}</div></td>
      <td class="num">${qty(h.shares)}</td>
      <td class="num">${money(h.avgCost)}</td>
      <td class="num">${money(h.price)}</td>
      <td class="num ${cls(h.dayChangePct)}">${pct(h.dayChangePct)}</td>
      <td class="num">${money(h.value)}</td>
      <td class="num"><div class="wbar"><span style="width:${(h.weight / maxW) * 100}%"></span></div>${pct(h.weight, false)}</td>
      <td class="num ${cls(h.unrealized)}">${signed(h.unrealized)}<div class="small">${pct(h.unrealizedPct)}</div></td>
    </tr>`).join('') || `<tr><td colspan="8" class="empty">${q ? 'No match.' : 'No holdings yet. Add a buy to get started.'}</td></tr>`;
  const s = summary;
  $('#holdings-table tfoot').innerHTML = s.holdings.length ? `
    <tr><td>Cash</td><td></td><td></td><td></td><td></td><td class="num">${money(s.cash)}</td><td class="num">${pct(s.total ? s.cash / s.total : 0, false)}</td><td></td></tr>
    <tr class="total-row"><td>Total</td><td></td><td></td><td></td><td class="num ${cls(s.dayChange)}">${pct(s.dayChangePct)}</td><td class="num">${money(s.total)}</td><td class="num">100%</td><td class="num ${cls(s.unrealized)}">${signed(s.unrealized)}</td></tr>` : '';
}

function renderTrades() {
  const q = ui.tradeQuery.trim().toUpperCase();
  const rows = sortTrades(state.trades).reverse()
    .filter((t) => (!ui.tradeType || t.type === ui.tradeType) && (!q || (t.ticker || '').includes(q)));
  $('#trades-empty').hidden = state.trades.length > 0;
  $('#trades-table tbody').innerHTML = rows.map((t) => {
    const trade = t.type === 'buy' || t.type === 'sell';
    const amt = trade ? t.shares * t.price : t.amount;
    const sign = t.type === 'buy' || t.type === 'withdraw' ? -1 : 1;
    return `<tr>
      <td>${fmtDate(t.date)}</td>
      <td><span class="pill ${t.type}">${TYPE_LABEL[t.type]}</span></td>
      <td><strong>${esc(t.ticker || '–')}</strong>${t.note ? `<div class="muted small">${esc(t.note)}</div>` : ''}</td>
      <td class="num">${trade ? qty(t.shares) : ''}</td>
      <td class="num">${trade ? money(t.price) : ''}</td>
      <td class="num ${sign > 0 ? 'up' : ''}">${sign > 0 ? '+' : '−'}${money(amt)}</td>
      <td class="num muted">${t.fee ? money(t.fee) : ''}</td>
      <td class="num nowrap"><button class="icon-btn" data-edit="${esc(t.id)}" aria-label="Edit">✎</button><button class="icon-btn" data-del="${esc(t.id)}" aria-label="Delete">✕</button></td>
    </tr>`;
  }).join('');
}

function renderSettings() {
  const f = $('#settings-form');
  f.name.value = state.settings.name;
  f.currency.value = state.settings.currency;
  f.locale.value = state.settings.locale;
}

function renderDatalists() {
  const tickers = [...new Set([...Object.keys(state.prices), ...state.trades.map((t) => t.ticker).filter(Boolean)])].sort();
  $('#ticker-list').innerHTML = tickers.map((t) => `<option value="${esc(t)}">${esc(state.prices[t]?.name || '')}</option>`).join('');
  const sectors = [...new Set(['Technology', 'Financials', 'Healthcare', 'Consumer', 'Energy', 'Industrials', 'Communication', 'Materials', 'Utilities', 'Real Estate', 'ETF', 'Crypto',
    ...Object.values(state.prices).map((p) => p.sector).filter(Boolean)])];
  $('#sector-list').innerHTML = sectors.map((s) => `<option value="${esc(s)}">`).join('');
}

// ---------- trade dialog ----------
const tradeDialog = $('#trade-dialog');
const tf = $('#trade-form');

function openTrade(preset = {}) {
  tf.reset();
  ui.editingId = preset.id || null;
  $('#trade-title').textContent = ui.editingId ? 'Edit transaction' : 'Add transaction';
  $('#trade-error').textContent = '';
  tf.date.value = preset.date || isoDate(new Date());
  tf.fee.value = preset.fee ?? 0;
  for (const k of ['ticker', 'shares', 'price', 'amount', 'note']) if (preset[k] != null) tf[k].value = preset[k];
  if (preset.ticker && state.prices[preset.ticker]) {
    tf.name.value = state.prices[preset.ticker].name || '';
    tf.sector.value = state.prices[preset.ticker].sector || '';
    if (preset.price == null && !ui.editingId) tf.price.value = state.prices[preset.ticker].price;
  }
  setType(preset.type || 'buy');
  tradeDialog.showModal();
  (preset.ticker ? tf.shares : tf.ticker).focus();
}

function setType(type) {
  tf.type.value = type;
  $$('#type-seg button').forEach((b) => b.classList.toggle('on', b.dataset.type === type));
  const isTrade = type === 'buy' || type === 'sell';
  $('[data-for="ticker"]').hidden = !(isTrade || type === 'dividend');
  $('[data-for="shares"]').hidden = !isTrade;
  $('[data-for="amount"]').hidden = isTrade;
  $('[data-for="meta"]').hidden = type !== 'buy';
  updateTradeTotal();
}

function readTrade() {
  const n = (v) => (v === '' ? undefined : Number(v));
  const type = tf.type.value;
  const isTrade = type === 'buy' || type === 'sell';
  return {
    id: ui.editingId || `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    seq: ui.editingId ? state.trades.find((t) => t.id === ui.editingId)?.seq ?? Date.now() : Date.now(),
    date: tf.date.value,
    type,
    ticker: isTrade || type === 'dividend' ? tf.ticker.value.trim().toUpperCase() : undefined,
    shares: isTrade ? n(tf.shares.value) : undefined,
    price: isTrade ? n(tf.price.value) : undefined,
    amount: isTrade ? undefined : n(tf.amount.value),
    fee: n(tf.fee.value) || 0,
    note: tf.note.value.trim() || undefined,
  };
}

function updateTradeTotal() {
  const t = readTrade();
  let text = '';
  if (t.type === 'buy' && t.shares > 0 && t.price >= 0) text = `Total cost ${money(t.shares * t.price + t.fee)}`;
  if (t.type === 'sell' && t.shares > 0 && t.price >= 0) text = `Proceeds ${money(t.shares * t.price - t.fee)}`;
  if (t.type === 'sell' && t.ticker) {
    const held = positionsBefore(state.trades, t.date || '9999-12-31', ui.editingId)[t.ticker] || 0;
    text += `${text ? ' · ' : ''}You hold ${qty(held)} ${t.ticker}`;
  }
  $('#trade-total').textContent = text;
}

tf.addEventListener('input', updateTradeTotal);
tf.ticker.addEventListener('change', () => {
  const p = state.prices[tf.ticker.value.trim().toUpperCase()];
  if (p) {
    if (!tf.price.value) tf.price.value = p.price;
    if (!tf.name.value) tf.name.value = p.name || '';
    if (!tf.sector.value) tf.sector.value = p.sector || '';
  }
  updateTradeTotal();
});
$('#type-seg').addEventListener('click', (e) => e.target.dataset.type && setType(e.target.dataset.type));
$('#trade-cancel').addEventListener('click', () => tradeDialog.close());

tf.addEventListener('submit', (e) => {
  e.preventDefault();
  const t = readTrade();
  const err = validateTrade(t, positionsBefore(state.trades, t.date, ui.editingId));
  if (err) { $('#trade-error').textContent = err; return; }
  const next = ui.editingId ? state.trades.map((x) => (x.id === ui.editingId ? t : x)) : [...state.trades, t];
  const bad = findOversell(next);
  if (bad) { $('#trade-error').textContent = `This would make the ${fmtDate(bad.date)} sell of ${bad.ticker} exceed the shares held.`; return; }
  state.trades = next;
  if (t.type === 'buy' || t.type === 'sell') {
    const p = (state.prices[t.ticker] ??= { price: t.price, prevClose: t.price });
    if (t.type === 'buy') {
      if (tf.name.value.trim()) p.name = tf.name.value.trim();
      if (tf.sector.value.trim()) p.sector = tf.sector.value.trim();
    }
  }
  persist();
  render();
  tradeDialog.close();
  toast(ui.editingId ? 'Transaction updated.' : 'Transaction added.');
});

// ---------- prices dialog ----------
const pricesDialog = $('#prices-dialog');
$('#btn-prices').addEventListener('click', () => {
  const tickers = summary.holdings.map((h) => h.ticker);
  $('#prices-body').innerHTML = tickers.map((t) => {
    const p = state.prices[t] || {};
    const h = summary.holdings.find((x) => x.ticker === t);
    return `<tr><td><strong>${esc(t)}</strong><div class="muted small">${esc(h.name)}</div></td>
      <td class="num"><input type="number" step="any" min="0" name="p-${esc(t)}" value="${p.price ?? h.price}" required inputmode="decimal"></td>
      <td class="num"><input type="number" step="any" min="0" name="c-${esc(t)}" value="${p.prevClose ?? p.price ?? h.price}" inputmode="decimal"></td></tr>`;
  }).join('') || '<tr><td colspan="3" class="empty">No holdings yet.</td></tr>';
  pricesDialog.showModal();
});
$('#prices-cancel').addEventListener('click', () => pricesDialog.close());
$('#prices-form').addEventListener('submit', (e) => {
  e.preventDefault();
  for (const input of $$('#prices-body input[name^="p-"]')) {
    const t = input.name.slice(2);
    const prev = $(`#prices-body input[name="c-${CSS.escape(t)}"]`).value;
    const p = (state.prices[t] ??= {});
    p.price = Number(input.value);
    p.prevClose = prev === '' ? p.price : Number(prev);
    p.updated = new Date().toISOString();
  }
  persist();
  render();
  pricesDialog.close();
  toast('Prices saved.');
});

// ---------- holding detail ----------
const holdingDialog = $('#holding-dialog');
let detailTicker = null;
function openHolding(ticker) {
  const h = summary.holdings.find((x) => x.ticker === ticker);
  if (!h) return;
  detailTicker = ticker;
  $('#hd-title').innerHTML = `${esc(h.ticker)} <span class="muted">${esc(h.name)}</span>`;
  const stat = (label, val, c = '') => `<div><div class="label">${label}</div><div class="${c}">${val}</div></div>`;
  $('#hd-stats').innerHTML = [
    stat('Value', money(h.value)), stat('Weight', pct(h.weight, false)),
    stat('Shares', qty(h.shares)), stat('Avg cost', money(h.avgCost)),
    stat('Price', money(h.price)), stat('Today', pct(h.dayChangePct), cls(h.dayChangePct)),
    stat('Unrealized', `${signed(h.unrealized)} (${pct(h.unrealizedPct)})`, cls(h.unrealized)),
    stat('Realized', signed(h.realized), cls(h.realized)), stat('Dividends', money(h.dividends)),
    stat('Held since', fmtDate(h.firstDate)), stat('Sector', esc(h.sector)),
  ].join('');
  $('#hd-trades').innerHTML = sortTrades(state.trades.filter((t) => t.ticker === ticker)).reverse().map(tradeListItem).join('');
  holdingDialog.showModal();
}
$('#hd-close').addEventListener('click', () => holdingDialog.close());
$('#hd-buy').addEventListener('click', () => { holdingDialog.close(); openTrade({ type: 'buy', ticker: detailTicker }); });
$('#hd-sell').addEventListener('click', () => {
  holdingDialog.close();
  const h = summary.holdings.find((x) => x.ticker === detailTicker);
  openTrade({ type: 'sell', ticker: detailTicker, shares: h?.shares, price: h?.price });
});
document.addEventListener('click', (e) => {
  const row = e.target.closest('.row-link[data-ticker]');
  if (row) openHolding(row.dataset.ticker);
});

// ---------- list interactions ----------
$('#holdings-table thead').addEventListener('click', (e) => {
  const key = e.target.closest('th')?.dataset.sort;
  if (!key) return;
  ui.holdSort = { key, dir: ui.holdSort.key === key ? -ui.holdSort.dir : key === 'ticker' ? 1 : -1 };
  renderHoldings();
});
$('#holdings-search').addEventListener('input', (e) => { ui.holdQuery = e.target.value; renderHoldings(); });
$('#trades-type').addEventListener('change', (e) => { ui.tradeType = e.target.value; renderTrades(); });
$('#trades-search').addEventListener('input', (e) => { ui.tradeQuery = e.target.value; renderTrades(); });
$('#trades-table tbody').addEventListener('click', (e) => {
  const edit = e.target.closest('[data-edit]')?.dataset.edit;
  const del = e.target.closest('[data-del]')?.dataset.del;
  if (edit) openTrade(state.trades.find((t) => t.id === edit));
  if (del) {
    const next = state.trades.filter((t) => t.id !== del);
    const bad = findOversell(next);
    if (bad) return toast(`Can't delete: the ${fmtDate(bad.date)} sell of ${bad.ticker} would exceed shares held.`);
    if (!confirm('Delete this transaction?')) return;
    state.trades = next;
    persist();
    render();
    toast('Transaction deleted.');
  }
});
$$('[data-alloc]').forEach((b) => b.addEventListener('click', () => { state.settings.allocBy = b.dataset.alloc; save(state); renderOverview(); }));

// ---------- header / settings ----------
$('#btn-add').addEventListener('click', () => openTrade());
$('#btn-add-mobile').addEventListener('click', () => openTrade());
$('#btn-clear-demo').addEventListener('click', () => {
  if (!confirm('Remove the demo data and start empty?')) return;
  state = emptyState();
  persist(); render();
  location.hash = '#trades';
  openTrade({ type: 'deposit' });
});
$('#settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  Object.assign(state.settings, { name: f.name.value.trim() || 'My Portfolio', currency: f.currency.value, locale: f.locale.value });
  save(state); render(); toast('Settings saved.');
});
$('#btn-load-demo').addEventListener('click', () => {
  if (state.trades.length && !confirm('Replace your data with demo data?')) return;
  state = demoState(); persist(); render(); toast('Demo data loaded.');
});
$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Delete all transactions, prices and history from this browser? Export a backup first if you need it.')) return;
  state = emptyState(); save(state); render(); toast('All data deleted.');
});

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#btn-export-json').addEventListener('click', () => download(`portfolio-${isoDate(new Date())}.json`, JSON.stringify(state, null, 2), 'application/json'));
$('#btn-export-csv').addEventListener('click', () => download(`trades-${isoDate(new Date())}.csv`, tradesToCsv(state.trades), 'text/csv'));
$('#file-json').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const next = normalize(JSON.parse(await file.text()));
    if (!confirm(`Replace current data with this backup (${next.trades.length} transactions)?`)) return;
    state = next; save(state); render(); toast('Backup imported.');
  } catch (err) { toast(`Import failed: ${err.message}`); }
});
$('#file-csv').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const rows = csvToTrades(await file.text());
    const next = [...state.trades, ...rows];
    const bad = findOversell(next);
    if (bad) throw new Error(`the ${bad.date} sell of ${bad.ticker} exceeds shares held`);
    if (!confirm(`Add ${rows.length} transactions from CSV?`)) return;
    state.trades = next;
    state.settings.isDemo = false;
    for (const t of rows) if (t.ticker && t.price != null) state.prices[t.ticker] ??= { price: t.price, prevClose: t.price };
    persist(); render(); toast(`${rows.length} transactions imported.`);
  } catch (err) { toast(`Import failed: ${err.message}`); }
});

// ---------- boot ----------
let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderOverview, 150); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', renderOverview);
window.addEventListener('hashchange', route);
render();
route();
recordSnapshot(state);
save(state);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
