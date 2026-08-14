// dashboard.js — self-contained finance dashboard (inline CSS/SVG, no external
// requests). Dark engineer surface. Follows the data-viz method: a single hero
// number, one primary sequential hue (blue) for magnitude, status colors for
// deltas, thin marks with 4px rounded data-ends + 2px surface gaps, hairline
// grid, per-mark hover via <title>, legends only where ≥2 series appear.
import { inr, subAmount } from './timeutil.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- palette ---------------------------------------------------------------
const HEAT = ['#171c26', '#123a63', '#1a5a96', '#2b81cf', '#58a6ff']; // 0=none → 4=high (dark→bright)

const CSS = `
:root{
  --bg:#0a0d12;--card:#12161d;--card2:#161c25;--line:#20262f;--line2:#2a323f;
  --text:#e8eef5;--dim:#93a1b0;--muted:#66717f;
  --blue:#58a6ff;--blue-dim:#265d9c;--green:#3fb950;--amber:#d29922;--red:#f85149;--violet:#bc8cff;
  --good:#3fb950;--bad:#f85149;
}
*{box-sizing:border-box}
body{margin:0;background:
  radial-gradient(1200px 600px at 15% -10%,rgba(88,166,255,.06),transparent 60%),
  var(--bg);color:var(--text);
  font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  padding:22px 20px 60px}
.wrap{max-width:1120px;margin:0 auto}
a{color:var(--blue);text-decoration:none}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.tnum{font-variant-numeric:tabular-nums}
h1{font-size:17px;margin:0;font-family:ui-monospace,monospace;letter-spacing:-.02em}
.sub{color:var(--dim);font-size:12.5px;margin-top:3px}
.head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap;gap:8px}

.card{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);
  border-radius:14px;padding:16px 18px}
.card h2{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--dim);margin:0 0 14px;font-weight:600}
.grid{display:grid;gap:14px}
.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}
@media(max-width:820px){.g2,.g3{grid-template-columns:1fr}}

/* hero band */
.hero{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:14px;margin-bottom:14px}
@media(max-width:820px){.hero{grid-template-columns:1fr}}
.hero .k{color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.07em}
.hero-num{font-size:50px;line-height:1.05;font-weight:650;letter-spacing:-.03em;margin:6px 0 2px}
.hero-sub{color:var(--dim);font-size:12.5px}
.meter{height:8px;border-radius:5px;background:#1b2431;overflow:hidden;margin-top:12px}
.meter>span{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--blue-dim),var(--green))}
.stat .v{font-size:26px;font-weight:650;letter-spacing:-.02em;margin-top:4px}
.stat .v small{font-size:12px;color:var(--dim);font-weight:400;letter-spacing:0}
.delta{font-size:12px;font-weight:600;margin-top:5px;display:inline-flex;gap:5px;align-items:center}
.delta.up{color:var(--bad)}.delta.down{color:var(--good)}
.tag{color:var(--muted);font-size:11.5px}

/* window stat tiles */
.wins{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px}
@media(max-width:820px){.wins{grid-template-columns:repeat(2,1fr)}}
.win{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 14px}
.win .k{color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em}
.win .v{font-size:19px;font-weight:600;margin-top:3px;letter-spacing:-.02em}
.win .t{color:var(--muted);font-size:11px;margin-top:2px}
.win .rail{height:3px;border-radius:2px;margin-top:9px;background:var(--blue);opacity:.9}

/* horizontal bars (categories / merchants) */
.bar-row{display:grid;grid-template-columns:96px 1fr auto;align-items:center;gap:10px;padding:5px 0}
.bar-lbl{color:var(--text);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-lbl .sub2{color:var(--muted);font-size:10.5px}
.bar-track{height:9px;background:#1a222e;border-radius:5px;overflow:hidden}
.bar-fill{height:100%;background:var(--blue);border-radius:0 5px 5px 0}
.bar-val{font-size:12.5px;color:var(--text);font-variant-numeric:tabular-nums}

/* list rows */
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}
.row:last-child{border-bottom:0}
.row .amt{font-variant-numeric:tabular-nums;white-space:nowrap}
.row .who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pos{color:var(--good)}.dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:7px;vertical-align:middle}

/* insight tiles */
.insights{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
@media(max-width:820px){.insights{grid-template-columns:1fr}}
.ins{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 14px}
.ins .k{color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em}
.ins .v{font-size:20px;font-weight:600;margin-top:4px;letter-spacing:-.02em}
.ins .t{color:var(--muted);font-size:11.5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

svg{display:block;width:100%;height:auto}
.wd{display:flex;gap:6px;align-items:flex-end;height:96px;margin-top:4px}
.wd .c{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:100%}
.wd .cb{width:60%;max-width:26px;background:var(--blue);border-radius:4px 4px 0 0;min-height:2px}
.wd .cl{color:var(--muted);font-size:10.5px}
.legend{display:flex;gap:14px;margin-top:10px;font-size:11.5px;color:var(--dim)}
.legend i{width:18px;height:3px;border-radius:2px;display:inline-block;margin-right:5px;vertical-align:middle}
.legend .sw{width:9px;height:9px;border-radius:2px}

/* login */
form{max-width:320px;margin:16vh auto;text-align:center}
input{width:100%;padding:12px;border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:15px;margin:12px 0}
button{width:100%;padding:12px;border-radius:11px;border:0;background:var(--blue);color:#04121f;font-weight:600;font-size:15px;cursor:pointer}
.err{color:var(--red);font-size:13px}
`;

// ---- date helpers (operate on 'YYYY-MM-DD' IST strings) --------------------
const p2 = (n) => String(n).padStart(2, '0');
function addDays(dayStr, delta) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}
const dow = (dayStr) => { const [y, m, d] = dayStr.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}
function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[i];
}

// ---- charts ----------------------------------------------------------------
// Daily-spend columns, last 60 days. One series → no legend; peak day labelled.
function trendChart(map, today) {
  const days = [];
  for (let i = 59; i >= 0; i--) days.push(addDays(today, -i));
  const vals = days.map((d) => map[d] || 0);
  const W = 720, H = 190, L = 46, R = 12, T = 14, B = 22;
  const pw = W - L - R, ph = H - T - B;
  const ymax = niceMax(Math.max(1, ...vals));
  const slot = pw / days.length, bw = Math.min(slot - 2, 9);
  const x = (i) => L + i * slot + (slot - bw) / 2;
  const y = (v) => T + ph - (v / ymax) * ph;
  const peak = vals.indexOf(Math.max(...vals));

  let grid = '', bars = '';
  for (const g of [0, 0.5, 1]) {
    const gy = T + ph - g * ph;
    grid += `<line x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}" stroke="var(--line)" stroke-width="1"/>`;
    grid += `<text x="${L - 8}" y="${gy + 3.5}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g === 0 ? '0' : inr(ymax * g).replace('₹', '')}</text>`;
  }
  vals.forEach((v, i) => {
    const h = Math.max(v > 0 ? 2 : 0, (v / ymax) * ph);
    if (h <= 0) return;
    const yy = T + ph - h;
    bars += `<rect x="${x(i).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${i === peak ? 'var(--blue)' : '#3d7fd0'}"><title>${esc(days[i])}: ${inr(v)}</title></rect>`;
  });
  // month ticks
  let xlab = '';
  days.forEach((d, i) => {
    if (d.slice(8) === '01' || i === 0) {
      const mo = MON[Number(d.slice(5, 7)) - 1];
      xlab += `<text x="${(x(i) + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="var(--muted)" font-size="10">${mo}</text>`;
    }
  });
  // peak label
  let plab = '';
  if (vals[peak] > 0) {
    const px = x(peak) + bw / 2, py = y(vals[peak]) - 6;
    plab = `<text x="${px.toFixed(1)}" y="${Math.max(py, 11).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="10.5" font-weight="600" class="tnum">${inr(vals[peak])}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spend, last 60 days">${grid}${bars}${plab}${xlab}</svg>`;
}

// Calendar heatmap, last ~13 weeks. Sequential blue by spend intensity.
function heatmap(map, today) {
  const start = addDays(today, -(6 * 7 + dow(today))); // align to a Sunday ~13 weeks back
  const days = [];
  for (let d = start; d <= today; d = addDays(d, 1)) days.push(d);
  const nz = days.map((d) => map[d] || 0).filter((v) => v > 0).sort((a, b) => a - b);
  const cap = quantile(nz, 0.9) || 1;
  const lvl = (v) => (v <= 0 ? 0 : Math.max(1, Math.min(4, 1 + Math.floor(Math.sqrt(v / cap) * 3.999))));
  const cell = 15, gap = 4, col = cell + gap, LL = 26, TT = 16;
  const weeks = Math.ceil(days.length / 7);
  const W = LL + weeks * col, H = TT + 7 * col;
  let cells = '', mlab = '', lastMo = '';
  days.forEach((d) => {
    const idx = Math.round((new Date(d) - new Date(start)) / 86400000);
    const wk = Math.floor(idx / 7), wd = dow(d);
    const cx = LL + wk * col, cy = TT + wd * col;
    const v = map[d] || 0;
    cells += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="3" fill="${HEAT[lvl(v)]}"><title>${esc(d)}: ${v > 0 ? inr(v) : 'no spend'}</title></rect>`;
    if (wd === 0) {
      const mo = MON[Number(d.slice(5, 7)) - 1];
      if (mo !== lastMo) { mlab += `<text x="${cx}" y="${TT - 5}" fill="var(--muted)" font-size="10">${mo}</text>`; lastMo = mo; }
    }
  });
  let wlab = '';
  [['Mon', 1], ['Wed', 3], ['Fri', 5]].forEach(([t, r]) => {
    wlab += `<text x="0" y="${TT + r * col + cell - 3}" fill="var(--muted)" font-size="9.5">${t}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spend heatmap">${mlab}${wlab}${cells}</svg>`;
}

function hbars(rows, opts = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => `<div class="bar-row" title="${esc(r.label)}: ${inr(r.value)}">
    <span class="bar-lbl">${esc(r.label)}${r.sub ? ` <span class="sub2">${esc(r.sub)}</span>` : ''}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, Math.round((r.value / max) * 100))}%"></span></span>
    <span class="bar-val">${inr(r.value)}</span></div>`).join('') || '<div class="tag">no data</div>';
}

// ---- page ------------------------------------------------------------------
export function renderDashboard(d) {
  const today = d.generatedIst;
  const map = {};
  for (const r of d.dailyDebit) map[r.day_ist] = r.s;

  const m = d.month;
  const daysInMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate();
  const perDay = m.daysSoFar ? m.spent / m.daysSoFar : 0;
  const projected = perDay * daysInMonth;
  const momPct = m.prevSpent > 0 ? Math.round((m.spent / m.prevSpent - 1) * 100) : null;
  const avgTxn = m.count ? m.spent / m.count : 0;
  // month-scoped daily stats
  const monthDays = Object.keys(map).filter((k) => k.slice(0, 7) === m.label);
  const noSpend = Math.max(0, m.daysSoFar - monthDays.filter((k) => map[k] > 0).length);
  let bigDay = { day: '—', s: 0 };
  for (const k of monthDays) if ((map[k] || 0) > bigDay.s) bigDay = { day: k, s: map[k] };
  // recurring subscriptions per month (USD converted for the total)
  const recur = d.subs.reduce((a, s) => a + (s.currency === 'INR' ? s.amount : s.amount * 99.4024), 0);

  const winCards = d.windows.map((w) => `<div class="win">
    <div class="k">last ${w.days}d</div><div class="v">${inr(w.total)}</div>
    <div class="t">${w.count} txns · ${inr(w.days ? w.total / w.days : 0)}/day</div>
    <div class="rail"></div></div>`).join('');

  const cats = hbars(d.categories.slice(0, 8).map((c) => ({ label: c.category, sub: `${c.c}`, value: c.s })));
  const merch = hbars(d.top.map((t) => ({ label: t.counterparty, sub: t.category || '', value: t.s })));

  // weekday average (last 91 days)
  const wdSum = [0, 0, 0, 0, 0, 0, 0], wdN = [0, 0, 0, 0, 0, 0, 0];
  for (const k of Object.keys(map)) { const w = dow(k); wdSum[w] += map[k]; wdN[w]++; }
  const wdAvg = wdSum.map((s, i) => (wdN[i] ? s / wdN[i] : 0));
  const wdMax = Math.max(1, ...wdAvg);
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = [1, 2, 3, 4, 5, 6, 0].map((i) => `<div class="c"><div class="cb" title="${WD[i]}: ${inr(wdAvg[i])}/day avg" style="height:${Math.round((wdAvg[i] / wdMax) * 100)}%"></div><div class="cl">${WD[i][0]}</div></div>`).join('');

  const income = (d.income_list || []).map((t) => `<div class="row"><span class="who"><span class="dot" style="background:var(--green)"></span>${esc(t.counterparty || '?')} <span class="tag">${esc((t.channel || '') + ' · ' + t.ts_ist.slice(0, 10))}</span></span><span class="amt pos">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no credits</div>';
  const subs = d.subs.map((s) => `<div class="row"><span class="who">${esc(s.merchant)}</span><span class="amt">${esc(subAmount(s.currency, s.amount))}</span></div>`).join('') || '<div class="tag">none</div>';
  const recent = d.recent.map((t) => `<div class="row"><span class="who"><span class="dot" style="background:${t.direction === 'credit' ? 'var(--green)' : 'var(--blue)'}"></span>${esc(t.counterparty || '?')} <span class="tag">${esc(t.ts_ist.slice(5, 16))}</span></span><span class="amt${t.direction === 'credit' ? ' pos' : ''}">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no data</div>';

  const netCls = m.net >= 0 ? 'pos' : '';
  const momTag = momPct === null ? '' : `<span class="delta ${momPct >= 0 ? 'up' : 'down'}">${momPct >= 0 ? '▲' : '▼'} ${Math.abs(momPct)}% vs last month</span>`;

  const body = `<div class="wrap">
    <div class="head">
      <div><h1>💰 finance</h1><div class="sub">as of ${esc(d.generatedIst)} IST · <span class="mono">${esc(m.label)}</span></div></div>
      <div class="tag">₹ figures · USD card charges @99.40</div>
    </div>

    <div class="hero">
      <div class="card">
        <div class="k">Net · this month</div>
        <div class="hero-num ${netCls}">${inr(m.net)}</div>
        <div class="hero-sub">${m.rate !== null ? `${m.rate}% of income saved` : 'income − spend'}</div>
        ${m.rate !== null ? `<div class="meter"><span style="width:${Math.max(0, Math.min(100, m.rate))}%"></span></div>` : ''}
      </div>
      <div class="card stat">
        <div class="k">Spent · this month</div>
        <div class="v">${inr(m.spent)} <small>· ${m.count} txns</small></div>
        ${momTag}
        <div class="tag" style="margin-top:8px">Projected month-end <b style="color:var(--text)">${inr(projected)}</b></div>
      </div>
      <div class="card stat">
        <div class="k">Income · this month</div>
        <div class="v pos">${inr(m.income)}</div>
        <div class="tag" style="margin-top:8px">Avg spend <b style="color:var(--text)">${inr(perDay)}</b>/day</div>
        <div class="tag" style="margin-top:4px">Recurring subs ~<b style="color:var(--text)">${inr(recur)}</b>/mo</div>
      </div>
    </div>

    <div class="wins">${winCards}</div>

    <div class="card" style="margin-bottom:14px">
      <h2>Daily spend · last 60 days</h2>
      ${trendChart(map, today)}
    </div>

    <div class="card" style="margin-bottom:14px">
      <h2>Spending calendar · last 13 weeks</h2>
      ${heatmap(map, today)}
      <div class="legend"><span>less</span>${HEAT.map((c) => `<span class="sw" style="background:${c}"></span>`).join('')}<span>more</span></div>
    </div>

    <div class="grid g2" style="margin-bottom:14px">
      <div class="card"><h2>By category · 30 days</h2>${cats}</div>
      <div class="card"><h2>Top merchants · 30 days</h2>${merch}</div>
    </div>

    <div class="insights" style="margin-bottom:14px">
      <div class="ins"><div class="k">Biggest expense · ${esc(m.label)}</div><div class="v">${d.biggest ? inr(d.biggest.amount) : '—'}</div><div class="t">${d.biggest ? esc(d.biggest.counterparty || '?') : ''}</div></div>
      <div class="ins"><div class="k">Biggest day</div><div class="v">${inr(bigDay.s)}</div><div class="t">${esc(bigDay.day)}</div></div>
      <div class="ins"><div class="k">Avg transaction</div><div class="v">${inr(avgTxn)}</div><div class="t">${m.count} txns this month</div></div>
      <div class="ins"><div class="k">No-spend days</div><div class="v">${noSpend}</div><div class="t">of ${m.daysSoFar} so far</div></div>
      <div class="ins"><div class="k">Days into month</div><div class="v">${m.daysSoFar}<small style="font-size:13px;color:var(--muted)"> / ${daysInMonth}</small></div><div class="t">${inr(m.spent)} spent</div></div>
      <div class="ins"><div class="k">Subscriptions</div><div class="v">${d.subs.length}</div><div class="t">~${inr(recur)}/mo committed</div></div>
    </div>

    <div class="grid g3">
      <div class="card"><h2>Spend by weekday</h2><div class="wd">${weekday}</div></div>
      <div class="card"><h2>💰 Income · recent</h2>${income}</div>
      <div class="card"><h2>Subscriptions</h2>${subs}</div>
    </div>

    <div class="card" style="margin-top:14px"><h2>Recent transactions</h2>${recent}</div>
  </div>`;
  return page('finance', body);
}

export function renderLogin(error = '') {
  return page('finance', `<form method="POST" action="/">
    <h1 class="mono">💰 finance</h1>
    <p class="sub">enter passphrase</p>
    <input type="password" name="pass" placeholder="passphrase" autofocus autocomplete="current-password"/>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
    <button type="submit">unlock</button>
  </form>`);
}

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${esc(title)}</title><style>${CSS}</style></head><body>${inner}</body></html>`;
}
