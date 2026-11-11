import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  summarize, allocation, valueHistory, validateTrade, findOversell, tradesToCsv, csvToTrades, positionsBefore,
} from '../app/js/portfolio.js';

const T = (date, type, rest = {}) => ({ id: `${date}-${type}-${rest.ticker || ''}-${Math.random()}`, date, type, fee: 0, ...rest });
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const base = [
  T('2025-01-01', 'deposit', { amount: 10000 }),
  T('2025-01-02', 'buy', { ticker: 'AAA', shares: 10, price: 100, fee: 5 }),
  T('2025-01-03', 'buy', { ticker: 'AAA', shares: 10, price: 200 }),
  T('2025-01-04', 'buy', { ticker: 'BBB', shares: 50, price: 20 }),
];

test('average cost, cash and weights', () => {
  const s = summarize(base, { AAA: { price: 180, prevClose: 170 }, BBB: { price: 25 } });
  const a = s.holdings.find((h) => h.ticker === 'AAA');
  near(a.avgCost, 3005 / 20);
  near(a.value, 3600);
  near(s.cash, 10000 - 1005 - 2000 - 1000);
  near(s.total, 3600 + 1250 + 5995);
  near(s.holdings.reduce((x, h) => x + h.weight, 0) + s.cash / s.total, 1);
  near(a.dayChange, 200);
  near(s.totalReturn, s.total - 10000);
});

test('sell realizes P/L against average cost', () => {
  const s = summarize([...base, T('2025-02-01', 'sell', { ticker: 'AAA', shares: 5, price: 160, fee: 2 })], { AAA: { price: 160 } });
  const a = s.holdings.find((h) => h.ticker === 'AAA');
  near(a.shares, 15);
  near(s.realized, 5 * 160 - 2 - 5 * (3005 / 20));
  near(a.avgCost, 3005 / 20); // avg cost unchanged by a sell
});

test('selling everything removes the holding', () => {
  const s = summarize([...base, T('2025-02-01', 'sell', { ticker: 'BBB', shares: 50, price: 30 })]);
  assert.equal(s.holdings.find((h) => h.ticker === 'BBB'), undefined);
  near(s.realized, 500);
});

test('dividends add cash and count in return', () => {
  const s = summarize([...base, T('2025-03-01', 'dividend', { ticker: 'BBB', amount: 40 })]);
  near(s.dividends, 40);
  near(s.holdings.find((h) => h.ticker === 'BBB').dividends, 40);
});

test('validation and oversell checks', () => {
  assert.match(validateTrade({ type: 'sell', date: '2025-01-05', ticker: 'BBB', shares: 60, price: 1 }, positionsBefore(base, '2025-01-05')), /only hold 50/);
  assert.equal(validateTrade({ type: 'deposit', date: '2025-01-05', amount: 10 }), null);
  assert.match(validateTrade({ type: 'buy', date: 'bad', ticker: 'X', shares: 1, price: 1 }), /Date/);
  const early = T('2024-12-31', 'sell', { ticker: 'AAA', shares: 1, price: 1 });
  assert.equal(findOversell([...base, early]), early);
  assert.equal(findOversell(base), null);
});

test('allocation includes cash and sums to 1', () => {
  const s = summarize(base, { AAA: { price: 150, sector: 'Tech' }, BBB: { price: 20, sector: 'Tech' } });
  const bySector = allocation(s, 'sector');
  assert.deepEqual(bySector.map((x) => x.label), ['Cash', 'Tech']);
  near(bySector.reduce((x, i) => x + i.weight, 0), 1);
});

test('value history has one point per trade date plus today', () => {
  const h = valueHistory(base, { AAA: { price: 300 } }, [], '2025-06-01');
  assert.deepEqual(h.map((p) => p.date), ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-06-01']);
  near(h[0].value, 10000);
  near(h.at(-1).value, 20 * 300 + 50 * 20 + 5995);
  near(h.at(-1).contrib, 10000);
});

test('CSV round trip', () => {
  const csv = tradesToCsv([...base, T('2025-02-01', 'buy', { ticker: 'CCC', shares: 1, price: 5, note: 'has, comma "quoted"' })]);
  const back = csvToTrades(csv);
  assert.equal(back.length, 5);
  assert.equal(back[4].note, 'has, comma "quoted"');
  near(summarize(back).total, summarize(base).total);
  assert.throws(() => csvToTrades('date,type\n2025-01-01,nope'), /Row 2/);
});
