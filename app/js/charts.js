// Dependency-free SVG charts: allocation donut and value-over-time line.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Categorical palette, read from CSS custom properties so light/dark themes both work.
export function palette() {
  const cs = getComputedStyle(document.documentElement);
  return Array.from({ length: 10 }, (_, i) => cs.getPropertyValue(`--c${i + 1}`).trim() || '#888');
}

/** Donut chart. items: [{label, value, weight}] */
export function donut(container, items, { centerTop = '', centerBottom = '', onHover } = {}) {
  container.innerHTML = '';
  const size = 220, r = 92, w = 26, c = size / 2;
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, class: 'donut', role: 'img', 'aria-label': 'Allocation chart' });
  const colors = palette();
  const total = items.reduce((s, i) => s + i.value, 0);
  const shown = groupSmall(items, 9);
  let a0 = -Math.PI / 2;
  if (total <= 0) {
    svg.append(el('circle', { cx: c, cy: c, r, fill: 'none', stroke: 'var(--grid)', 'stroke-width': w }));
  }
  shown.forEach((it, i) => {
    const frac = it.value / total;
    if (frac <= 0) return;
    const a1 = a0 + frac * Math.PI * 2;
    const gap = shown.length > 1 ? 0.012 : 0;
    const path = el('path', {
      d: arc(c, c, r, a0 + gap, a1 - gap),
      fill: 'none',
      stroke: colors[i % colors.length],
      'stroke-width': w,
      class: 'slice',
      tabindex: 0,
    });
    const t = el('title');
    t.textContent = `${it.label}: ${(it.weight * 100).toFixed(1)}%`;
    path.append(t);
    path.addEventListener('mouseenter', () => onHover?.(it));
    path.addEventListener('focus', () => onHover?.(it));
    path.addEventListener('mouseleave', () => onHover?.(null));
    svg.append(path);
    a0 = a1;
  });
  const top = el('text', { x: c, y: c - 4, 'text-anchor': 'middle', class: 'donut-top' });
  top.textContent = centerTop;
  const bottom = el('text', { x: c, y: c + 18, 'text-anchor': 'middle', class: 'donut-bottom' });
  bottom.textContent = centerBottom;
  svg.append(top, bottom);
  container.append(svg);
  return { shown, colors, setCenter(a, b) { top.textContent = a; bottom.textContent = b; } };
}

function groupSmall(items, max) {
  if (items.length <= max) return items;
  const head = items.slice(0, max - 1);
  const rest = items.slice(max - 1);
  return [...head, {
    label: 'Other',
    value: rest.reduce((s, i) => s + i.value, 0),
    weight: rest.reduce((s, i) => s + i.weight, 0),
  }];
}

function arc(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  if (a1 - a0 >= Math.PI * 2 - 0.001) {
    const [xm, ym] = p(a0 + Math.PI);
    return `M${x0},${y0} A${r},${r} 0 1 1 ${xm},${ym} A${r},${r} 0 1 1 ${x0},${y0}`;
  }
  return `M${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1}`;
}

/** Line chart of portfolio value vs. net contributions. points: [{date, value, contrib}] */
export function lineChart(container, points, { fmt, fmtDate }) {
  container.innerHTML = '';
  const W = Math.max(container.clientWidth || 600, 280), H = 240;
  const pad = { l: 8, r: 8, t: 16, b: 26 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'line', role: 'img', 'aria-label': 'Portfolio value over time' });
  if (points.length < 2) {
    const t = el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'muted-text' });
    t.textContent = 'Add transactions on at least two dates to see a chart.';
    svg.append(t);
    container.append(svg);
    return;
  }
  const time = (d) => new Date(d + 'T00:00:00').getTime();
  const t0 = time(points[0].date), t1 = time(points.at(-1).date);
  const vals = points.flatMap((p) => [p.value, p.contrib]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || hi || 1;
  lo -= span * 0.08; hi += span * 0.08;
  const x = (d) => pad.l + ((time(d) - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);

  for (let i = 0; i <= 3; i++) {
    const yy = pad.t + (i / 3) * (H - pad.t - pad.b);
    svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: yy, y2: yy, class: 'grid' }));
  }
  // Step line for contributions (money in), smooth-ish line for value.
  const contribPath = points.map((p, i) => (i ? `H${x(p.date)}V${y(p.contrib)}` : `M${x(p.date)},${y(p.contrib)}`)).join('');
  const valuePath = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date)},${y(p.value)}`).join('');
  const area = `${valuePath}L${x(points.at(-1).date)},${H - pad.b}L${x(points[0].date)},${H - pad.b}Z`;
  svg.append(el('path', { d: area, class: 'area' }));
  svg.append(el('path', { d: contribPath, class: 'contrib' }));
  svg.append(el('path', { d: valuePath, class: 'value' }));

  const labels = [points[0], points[Math.floor(points.length / 2)], points.at(-1)];
  labels.forEach((p, i) => {
    if (i === 1 && W < 480) return; // not enough room on phones
    const t = el('text', { x: x(p.date), y: H - 6, 'text-anchor': ['start', 'middle', 'end'][i], class: 'axis' });
    t.textContent = fmtDate(p.date);
    svg.append(t);
  });

  // Hover crosshair + tooltip
  const cross = el('line', { y1: pad.t, y2: H - pad.b, class: 'cross', visibility: 'hidden' });
  const dot = el('circle', { r: 4, class: 'dot', visibility: 'hidden' });
  svg.append(cross, dot);
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.hidden = true;
  container.append(svg, tip);
  const move = (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.touches?.[0]?.clientX ?? ev.clientX) - rect.left) * (W / rect.width);
    let best = points[0];
    for (const p of points) if (Math.abs(x(p.date) - px) < Math.abs(x(best.date) - px)) best = p;
    const bx = x(best.date), by = y(best.value);
    cross.setAttribute('x1', bx); cross.setAttribute('x2', bx);
    dot.setAttribute('cx', bx); dot.setAttribute('cy', by);
    cross.setAttribute('visibility', 'visible'); dot.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `<strong>${fmtDate(best.date)}</strong><br>Value ${fmt(best.value)}<br><span class="muted">Invested ${fmt(best.contrib)}</span>`;
    const left = (bx / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(left, 70), rect.width - 70)}px`;
  };
  const leave = () => { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; };
  svg.addEventListener('mousemove', move);
  svg.addEventListener('touchmove', move, { passive: true });
  svg.addEventListener('mouseleave', leave);
  svg.addEventListener('touchend', leave);
}
