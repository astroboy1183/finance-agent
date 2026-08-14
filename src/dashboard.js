// dashboard.js — comprehensive, self-contained finance dashboard (inline
// CSS/SVG, no external requests). Dark premium surface. Data-viz method: one
// hero number, single-hue blue for magnitude, a fixed categorical order for the
// donut, status colors for deltas, thin marks + hairline grid, per-mark hover.
import { inr, subAmount } from './timeutil.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// fixed categorical order (dark-surface stepped) — donut / multi-series
const CAT = ['#5b9dff', '#f5854a', '#37c98f', '#f5c451', '#e07aa8', '#9d8bff', '#5ad1e0', '#7a8aa0'];
const HEAT = ['#151b26', '#16324f', '#1d5583', '#2a7cc0', '#5b9dff'];
const C_SPEND = '#5b9dff', C_INCOME = '#37c98f';

const CSS = `
:root{
  --bg:#0a0d13;--card:#121824;--card-2:#0e131d;--brd:#1e2736;--brd-2:#28324420;
  --text:#eaf0f8;--dim:#93a2b8;--muted:#5d6982;
  --acc:#5b9dff;--acc-2:#7c5cff;--green:#37c98f;--red:#ff6b6b;--amber:#f5b23d;
  --shadow:0 10px 30px -18px rgba(0,0,0,.8);
}
*{box-sizing:border-box}
body{margin:0;color:var(--text);
  font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:
    radial-gradient(1100px 520px at 12% -8%,rgba(91,157,255,.10),transparent 62%),
    radial-gradient(900px 500px at 100% 0%,rgba(124,92,255,.08),transparent 60%),
    var(--bg);
  padding:26px 22px 72px;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.tnum{font-variant-numeric:tabular-nums}
a{color:var(--acc);text-decoration:none}

.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;flex-wrap:wrap;gap:10px}
.brand{display:flex;align-items:center;gap:11px}
.brand .logo{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:19px;
  background:linear-gradient(145deg,rgba(91,157,255,.28),rgba(124,92,255,.20));border:1px solid var(--brd)}
.brand h1{font-size:16px;margin:0;letter-spacing:-.01em}
.brand .sub{color:var(--dim);font-size:12px;margin-top:1px}
.pill{color:var(--dim);font-size:11.5px;border:1px solid var(--brd);border-radius:999px;padding:6px 12px;background:var(--card-2)}

.card{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);
  border-radius:18px;padding:18px 20px;box-shadow:var(--shadow)}
.card>h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:0 0 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
.card>h2 .r{color:var(--muted);letter-spacing:.02em;text-transform:none;font-weight:500}
.grid{display:grid;gap:16px}
.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}
.mb{margin-bottom:16px}
@media(max-width:860px){.g2,.g3{grid-template-columns:1fr}}

/* hero */
.hero{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:860px){.hero{grid-template-columns:1fr}}
.k{color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.hero-net{font-size:52px;line-height:1.02;font-weight:680;letter-spacing:-.035em;margin:9px 0 4px}
.hero-sub{color:var(--dim);font-size:12.5px}
.meter{height:9px;border-radius:6px;background:#182234;overflow:hidden;margin-top:14px;border:1px solid var(--brd)}
.meter>span{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#2b6fd0,var(--green))}
.big{font-size:29px;font-weight:670;letter-spacing:-.025em;margin-top:6px}
.big small{font-size:12px;color:var(--dim);font-weight:400;letter-spacing:0}
.sub2{color:var(--muted);font-size:11.5px;margin-top:3px}
.delta{font-size:12px;font-weight:650;display:inline-flex;gap:5px;align-items:center;margin-top:7px}
.up{color:var(--red)}.down{color:var(--green)}.pos{color:var(--green)}
.chip{margin-top:10px;font-size:12px;color:var(--dim)}
.chip b{color:var(--text)}

/* insights strip */
.insbar{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
@media(max-width:860px){.insbar{grid-template-columns:1fr 1fr}}
.insight{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);border-radius:14px;padding:13px 15px;display:flex;gap:11px;align-items:flex-start}
.insight .ico{font-size:17px;line-height:1.3}
.insight .tx{font-size:12.5px;color:var(--dim);line-height:1.4}
.insight .tx b{color:var(--text);font-weight:650}

/* window tiles */
.wins{display:grid;grid-template-columns:repeat(5,1fr);gap:13px;margin-bottom:16px}
@media(max-width:860px){.wins{grid-template-columns:repeat(2,1fr)}}
.win{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);border-radius:14px;padding:14px 15px}
.win .v{font-size:19px;font-weight:660;margin-top:4px;letter-spacing:-.02em}
.win .t{color:var(--muted);font-size:11px;margin-top:3px}
.win .rail{height:3px;border-radius:2px;margin-top:10px;background:linear-gradient(90deg,var(--acc),transparent)}

/* stat/insight tiles grid */
.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media(max-width:860px){.tiles{grid-template-columns:1fr 1fr}}
.tile .v{font-size:21px;font-weight:660;margin-top:5px;letter-spacing:-.02em}
.tile .t{color:var(--muted);font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* bars */
.bar-row{display:grid;grid-template-columns:104px 1fr auto;align-items:center;gap:12px;padding:6px 0}
.bar-lbl{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-lbl .n{color:var(--muted);font-size:10.5px}
.bar-track{height:10px;background:#172032;border-radius:6px;overflow:hidden}
.bar-fill{height:100%;border-radius:6px}
.bar-val{font-size:12.5px;font-variant-numeric:tabular-nums}

/* legend */
.lg{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:6px}
.lg .it{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dim);min-width:0}
.lg .sw{width:10px;height:10px;border-radius:3px;flex:none}
.lg .it b{color:var(--text);font-weight:600}
.lg .it .n{margin-left:auto;color:var(--text);font-variant-numeric:tabular-nums}
.donutwrap{display:grid;grid-template-columns:170px 1fr;gap:18px;align-items:center}
@media(max-width:520px){.donutwrap{grid-template-columns:1fr}}

/* list rows */
.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--brd);font-size:13px}
.row:last-child{border-bottom:0}
.row .amt{font-variant-numeric:tabular-nums;white-space:nowrap}
.row .who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;min-width:0}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:8px;flex:none}
.tag{color:var(--muted);font-size:11px}

/* svg */
.svgw{width:100%;height:auto;display:block}
.heat-wrap{overflow-x:auto}
.heat{height:auto;display:block;margin:2px auto}
.legrow{display:flex;align-items:center;gap:7px;margin-top:12px;font-size:11px;color:var(--muted)}
.legrow .sw{width:13px;height:13px;border-radius:3px}
.wd{display:flex;gap:8px;align-items:flex-end;height:110px;margin-top:6px}
.wd .c{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px;height:100%}
.wd .cb{width:64%;max-width:30px;background:linear-gradient(180deg,var(--acc),#33639e);border-radius:5px 5px 0 0;min-height:3px}
.wd .cl{color:var(--muted);font-size:10.5px}
.chlegend{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;font-size:11.5px;color:var(--dim)}
.chlegend .it{display:flex;align-items:center;gap:6px}.chlegend .sw{width:10px;height:10px;border-radius:3px}

form{max-width:330px;margin:16vh auto;text-align:center}
input{width:100%;padding:13px;border-radius:12px;border:1px solid var(--brd);background:var(--card);color:var(--text);font-size:15px;margin:12px 0}
button{width:100%;padding:13px;border-radius:12px;border:0;background:linear-gradient(145deg,var(--acc),var(--acc-2));color:#04121f;font-weight:650;font-size:15px;cursor:pointer}
.err{color:var(--red);font-size:13px}
`;

// ---- date + number helpers -------------------------------------------------
const p2 = (n) => String(n).padStart(2, '0');
function addDays(dayStr, delta) {
  const [y, m, d] = dayStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
}
const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const dayIdx = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monLabel = (ym) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;

function short(n) {
  n = Math.round(Math.abs(n));
  if (n >= 1e7) return (n / 1e7).toFixed(n >= 1e8 ? 0 : 1) + 'Cr';
  if (n >= 1e5) return (n / 1e5).toFixed(n >= 1e6 ? 0 : 1) + 'L';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
  return String(n);
}
function niceMax(v) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v))); const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}
const quantile = (s, q) => (s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0);

// ---- charts ----------------------------------------------------------------
function sparkline(vals, w = 240, h = 46, color = C_SPEND) {
  const max = Math.max(1, ...vals), n = vals.length;
  const x = (i) => (i / (n - 1)) * w, y = (v) => h - 2 - (v / max) * (h - 4);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M0,${h} L${pts.join(' L')} L${w},${h} Z`;
  const line = `M${pts.join(' L')}`;
  return `<svg class="svgw" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${area}" fill="${color}" opacity="0.13"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;
}

// daily spend columns + 7-day average line (2 marks of one measure → labelled legend)
function trend(map, today) {
  const days = []; for (let i = 59; i >= 0; i--) days.push(addDays(today, -i));
  const vals = days.map((d) => map[d] || 0);
  const ma = vals.map((_, i) => { const s = vals.slice(Math.max(0, i - 6), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
  const W = 760, H = 210, L = 44, R = 14, T = 16, B = 24, pw = W - L - R, ph = H - T - B;
  const ymax = niceMax(Math.max(1, ...vals));
  const slot = pw / days.length, bw = Math.min(slot - 2.5, 8);
  const X = (i) => L + i * slot + (slot - bw) / 2, Y = (v) => T + ph - (v / ymax) * ph;
  let grid = '';
  for (const g of [0, 0.5, 1]) {
    const gy = T + ph - g * ph;
    grid += `<line x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}" stroke="var(--brd)"/>`;
    grid += `<text x="${L - 8}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g ? short(ymax * g) : '0'}</text>`;
  }
  const peak = vals.indexOf(Math.max(...vals));
  let bars = '';
  vals.forEach((v, i) => {
    if (v <= 0) return;
    const h = Math.max(2, (v / ymax) * ph);
    bars += `<rect x="${X(i).toFixed(1)}" y="${(T + ph - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${i === peak ? C_SPEND : '#3a6ba8'}"><title>${days[i]}: ${inr(v)}</title></rect>`;
  });
  const maLine = `M${ma.map((v, i) => `${(X(i) + bw / 2).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')}`;
  let xlab = '';
  days.forEach((d, i) => { if (d.slice(8) === '01' || i === 0) xlab += `<text x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--muted)" font-size="10">${MON[Number(d.slice(5, 7)) - 1]}</text>`; });
  let plab = '';
  if (vals[peak] > 0) plab = `<text x="${(X(peak) + bw / 2).toFixed(1)}" y="${Math.max(Y(vals[peak]) - 6, 12).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="10.5" font-weight="650" class="tnum">${short(vals[peak])}</text>`;
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spend, last 60 days">${grid}${bars}<path d="${maLine}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round" opacity="0.9"/>${plab}${xlab}</svg>
  <div class="chlegend"><span class="it"><span class="sw" style="background:${C_SPEND}"></span>daily spend</span><span class="it"><span class="sw" style="background:var(--amber)"></span>7-day average</span></div>`;
}

// 6-month income vs spend grouped columns
function monthlyBars(months) {
  const data = months.slice(-6);
  const W = 760, H = 210, L = 44, R = 14, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
  const ymax = niceMax(Math.max(1, ...data.flatMap((m) => [m.debit, m.credit])));
  const gw = pw / data.length, bw = Math.min((gw - 14) / 2, 26);
  const Y = (v) => T + ph - (v / ymax) * ph;
  let grid = '';
  for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="var(--brd)"/><text x="${L - 8}" y="${gy + 3.5}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  let bars = '', xl = '';
  data.forEach((m, i) => {
    const cx = L + i * gw + gw / 2;
    const bx1 = cx - bw - 2, bx2 = cx + 2;
    const hs = Math.max(m.debit > 0 ? 2 : 0, (m.debit / ymax) * ph), hi = Math.max(m.credit > 0 ? 2 : 0, (m.credit / ymax) * ph);
    if (hs) bars += `<rect x="${bx1.toFixed(1)}" y="${(T + ph - hs).toFixed(1)}" width="${bw.toFixed(1)}" height="${hs.toFixed(1)}" rx="4" fill="${C_SPEND}"><title>${monLabel(m.ym)} spent ${inr(m.debit)}</title></rect>`;
    if (hi) bars += `<rect x="${bx2.toFixed(1)}" y="${(T + ph - hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="4" fill="${C_INCOME}"><title>${monLabel(m.ym)} income ${inr(m.credit)}</title></rect>`;
    xl += `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="10.5">${monLabel(m.ym)}</text>`;
  });
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly income vs spend">${grid}${bars}${xl}</svg>
  <div class="chlegend"><span class="it"><span class="sw" style="background:${C_SPEND}"></span>spent</span><span class="it"><span class="sw" style="background:${C_INCOME}"></span>income</span></div>`;
}

// cumulative pace: this month vs last month by day-of-month
function pace(map, today, thisYM, lastYM, lastDays) {
  const dim = 31;
  const cum = (ym, upto) => { const out = []; let s = 0; for (let d = 1; d <= upto; d++) { s += map[`${ym}-${p2(d)}`] || 0; out.push(s); } return out; };
  const dsofar = Number(today.slice(8, 10));
  const cur = cum(thisYM, dsofar), prev = cum(lastYM, lastDays);
  const W = 760, H = 210, L = 44, R = 14, T = 16, B = 24, pw = W - L - R, ph = H - T - B;
  const ymax = niceMax(Math.max(1, ...cur, ...prev));
  const X = (d) => L + ((d - 1) / (dim - 1)) * pw, Y = (v) => T + ph - (v / ymax) * ph;
  let grid = '';
  for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="var(--brd)"/><text x="${L - 8}" y="${gy + 3.5}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  const path = (arr) => `M${arr.map((v, i) => `${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')}`;
  let xl = '';
  for (const d of [1, 8, 15, 22, 29]) xl += `<text x="${X(d).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--muted)" font-size="10">${d}</text>`;
  const endDot = `<circle cx="${X(dsofar).toFixed(1)}" cy="${Y(cur[cur.length - 1]).toFixed(1)}" r="4" fill="${C_SPEND}" stroke="var(--card)" stroke-width="2"/>`;
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending pace vs last month">${grid}
    <path d="${path(prev)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 4" stroke-linejoin="round"/>
    <path d="${path(cur)}" fill="none" stroke="${C_SPEND}" stroke-width="2.5" stroke-linejoin="round"/>${endDot}${xl}</svg>
  <div class="chlegend"><span class="it"><span class="sw" style="background:${C_SPEND}"></span>this month</span><span class="it"><span class="sw" style="background:var(--muted)"></span>last month</span></div>`;
}

function donut(segs, total) {
  const size = 168, w = 26, r = (size - w) / 2, C = 2 * Math.PI * r, cx = size / 2;
  let off = 0, rings = '';
  segs.forEach((s) => {
    const f = total > 0 ? s.value / total : 0, len = Math.max(0, f * C - 2.5);
    rings += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${w}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off * C).toFixed(1)}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(s.label)}: ${inr(s.value)}</title></circle>`;
    off += f;
  });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Category breakdown">${rings}
    <text x="${cx}" y="${cx - 4}" text-anchor="middle" fill="var(--dim)" font-size="10" letter-spacing=".05em">SPENT 30D</text>
    <text x="${cx}" y="${cx + 15}" text-anchor="middle" fill="var(--text)" font-size="17" font-weight="680" class="tnum">${short(total)}</text></svg>`;
}

function hbars(rows, colorFn) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r, i) => `<div class="bar-row" title="${esc(r.label)}: ${inr(r.value)}">
    <span class="bar-lbl">${esc(r.label)}${r.n ? ` <span class="n">${esc(r.n)}</span>` : ''}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, Math.round((r.value / max) * 100))}%;background:${colorFn ? colorFn(i) : 'linear-gradient(90deg,#3a6ba8,var(--acc))'}"></span></span>
    <span class="bar-val">${inr(r.value)}</span></div>`).join('') || '<div class="tag">no data</div>';
}

function stacked(segs, total) {
  const bar = segs.map((s) => `<span title="${esc(s.label)}: ${inr(s.value)} (${Math.round((s.value / total) * 100)}%)" style="width:${(s.value / total) * 100}%;background:${s.color};display:block;height:100%"></span>`).join('');
  const leg = segs.map((s) => `<span class="it"><span class="sw" style="background:${s.color}"></span>${esc(s.label)} <b style="color:var(--text)">${Math.round((s.value / total) * 100)}%</b></span>`).join('');
  return `<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;gap:2px;background:var(--bg)">${bar}</div><div class="chlegend" style="margin-top:14px">${leg}</div>`;
}

// ---- page ------------------------------------------------------------------
export function renderDashboard(d) {
  const today = d.generatedIst, m = d.month;
  const map = {}; for (const r of d.dailyDebit) map[r.day_ist] = r.s;

  const daysInMonth = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate();
  const perDay = m.daysSoFar ? m.spent / m.daysSoFar : 0;
  const projected = perDay * daysInMonth;
  const momPct = m.prevSpent > 0 ? Math.round((m.spent / m.prevSpent - 1) * 100) : null;
  const avgTxn = m.count ? m.spent / m.count : 0;
  const monthDays = Object.keys(map).filter((k) => k.slice(0, 7) === m.label);
  const noSpend = Math.max(0, m.daysSoFar - monthDays.filter((k) => map[k] > 0).length);
  let bigDay = { day: '—', s: 0 }; for (const k of monthDays) if ((map[k] || 0) > bigDay.s) bigDay = { day: k, s: map[k] };
  const recur = d.subs.reduce((a, s) => a + (s.currency === 'INR' ? s.amount : s.amount * 99.4024), 0);

  // hero sparkline: last 30 days spend
  const spark30 = []; for (let i = 29; i >= 0; i--) spark30.push(map[addDays(today, -i)] || 0);

  // pace prev month meta
  const pm = m.label.split('-').map(Number); let py = pm[0], pmo = pm[1] - 1; if (pmo === 0) { pmo = 12; py--; }
  const lastYM = `${py}-${p2(pmo)}`; const lastDIM = new Date(Date.UTC(py, pmo, 0)).getUTCDate();

  // categories → donut (top 7 + Other)
  const catsAll = d.categories;
  const catTot = catsAll.reduce((a, c) => a + c.s, 0);
  const top7 = catsAll.slice(0, 7);
  const otherVal = catsAll.slice(7).reduce((a, c) => a + c.s, 0);
  const segs = top7.map((c, i) => ({ label: c.category, value: c.s, color: CAT[i], c: c.c }));
  if (otherVal > 0) segs.push({ label: 'other', value: otherVal, color: CAT[7], c: 0 });

  // weekday avg
  const wdSum = Array(7).fill(0), wdN = Array(7).fill(0);
  for (const k of Object.keys(map)) { const w = dow(k); wdSum[w] += map[k]; wdN[w]++; }
  const wdAvg = wdSum.map((s, i) => (wdN[i] ? s / wdN[i] : 0)); const wdMax = Math.max(1, ...wdAvg);
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = [1, 2, 3, 4, 5, 6, 0].map((i) => `<div class="c"><div class="cb" title="${WD[i]}: ${inr(wdAvg[i])}/day avg" style="height:${Math.round((wdAvg[i] / wdMax) * 100)}%"></div><div class="cl">${WD[i][0]}</div></div>`).join('');
  const busiestWd = WD[wdAvg.indexOf(Math.max(...wdAvg))];

  // channel + transfers split (30d)
  const chTot = d.channels.reduce((a, c) => a + c.s, 0) || 1;
  const chSeg = d.channels.slice(0, 5).map((c, i) => ({ label: c.channel, value: c.s, color: CAT[i] }));
  const p2m = (d.upiSplit.find((x) => x.t === 'P2M') || { s: 0 }).s;
  const p2a = (d.upiSplit.find((x) => x.t === 'P2A') || { s: 0 }).s;
  const other = (d.upiSplit.filter((x) => x.t !== 'P2M' && x.t !== 'P2A').reduce((a, x) => a + x.s, 0));

  // size distribution
  const sz = d.sizes || { b1: 0, b2: 0, b3: 0, b4: 0 };
  const szRows = [['< ₹200', sz.b1], ['₹200–1k', sz.b2], ['₹1k–5k', sz.b3], ['≥ ₹5k', sz.b4]];
  const szMax = Math.max(1, ...szRows.map((r) => r[1]));

  // heatmap (fixed cells)
  const hmStart = addDays(today, -(12 * 7 + dow(today)));
  const hmDays = []; for (let dd = hmStart; dd <= today; dd = addDays(dd, 1)) hmDays.push(dd);
  const hnz = hmDays.map((k) => map[k] || 0).filter((v) => v > 0).sort((a, b) => a - b);
  const cap = quantile(hnz, 0.9) || 1;
  const hlvl = (v) => (v <= 0 ? 0 : Math.max(1, Math.min(4, 1 + Math.floor(Math.sqrt(v / cap) * 3.999))));
  const CELL = 15, GAP = 4.5, COL = CELL + GAP, LL = 26, TT = 15;
  const weeks = Math.ceil((dayIdx(today) - dayIdx(hmStart) + 1) / 7);
  const hW = LL + weeks * COL, hH = TT + 7 * COL;
  let cells = '', mlab = '', lastMo = '';
  hmDays.forEach((dd) => {
    const wk = Math.floor((dayIdx(dd) - dayIdx(hmStart)) / 7), wd = dow(dd);
    const x = LL + wk * COL, y = TT + wd * COL, v = map[dd] || 0;
    cells += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3.5" fill="${HEAT[hlvl(v)]}"><title>${dd}: ${v > 0 ? inr(v) : 'no spend'}</title></rect>`;
    if (wd === 0) { const mo = MON[Number(dd.slice(5, 7)) - 1]; if (mo !== lastMo) { mlab += `<text x="${x}" y="${TT - 4}" fill="var(--muted)" font-size="10">${mo}</text>`; lastMo = mo; } }
  });
  let wl = ''; [['M', 1], ['W', 3], ['F', 5]].forEach(([t, r]) => { wl += `<text x="4" y="${TT + r * COL + CELL - 3}" fill="var(--muted)" font-size="9.5">${t}</text>`; });
  const heat = `<div class="heat-wrap"><svg class="heat" viewBox="0 0 ${hW} ${hH}" width="${hW}" height="${hH}" role="img" aria-label="Spending calendar">${mlab}${wl}${cells}</svg></div>`;

  // window tiles
  const winCards = d.windows.map((w) => `<div class="win"><div class="k">last ${w.days}d</div><div class="v">${inr(w.total)}</div><div class="t">${w.count} txns · ${inr(w.days ? w.total / w.days : 0)}/day</div><div class="rail"></div></div>`).join('');

  const catBars = hbars(top7.map((c) => ({ label: c.category, n: `${c.c}`, value: c.s })));
  const merchBars = hbars(d.top.map((t) => ({ label: t.counterparty, n: t.category || '', value: t.s })));

  const income = (d.income_list || []).map((t) => `<div class="row"><span class="who"><span class="dot" style="background:var(--green)"></span>${esc(t.counterparty || '?')}&nbsp;<span class="tag">${esc((t.channel || '') + ' · ' + t.ts_ist.slice(0, 10))}</span></span><span class="amt pos">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no credits</div>';
  const subs = d.subs.map((s) => `<div class="row"><span class="who">${esc(s.merchant)}</span><span class="amt">${esc(subAmount(s.currency, s.amount))}</span></div>`).join('') || '<div class="tag">none</div>';
  const recent = d.recent.map((t) => `<div class="row"><span class="who"><span class="dot" style="background:${t.direction === 'credit' ? 'var(--green)' : 'var(--acc)'}"></span>${esc(t.counterparty || '?')}&nbsp;<span class="tag">${esc(t.ts_ist.slice(5, 16))}</span></span><span class="amt${t.direction === 'credit' ? ' pos' : ''}">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no data</div>';

  const donutLegend = segs.map((s) => `<div class="it"><span class="sw" style="background:${s.color}"></span><b>${esc(s.label)}</b><span class="n">${short(s.value)} · ${Math.round((s.value / catTot) * 100)}%</span></div>`).join('');

  // auto insights
  const ins = [];
  if (catsAll[0]) ins.push(['🏷️', `Most of your spend goes to <b>${esc(catsAll[0].category)}</b> — ${inr(catsAll[0].s)} in 30 days.`]);
  if (momPct !== null) ins.push([momPct >= 0 ? '📈' : '📉', `You're spending <b>${Math.abs(momPct)}% ${momPct >= 0 ? 'more' : 'less'}</b> than last month so far.`]);
  ins.push(['🗓️', `At this pace you'll spend <b>${inr(projected)}</b> by month-end.`]);
  if (m.rate !== null) ins.push([m.rate >= 0 ? '💰' : '⚠️', `You've saved <b>${m.rate}%</b> of income this month.`]);
  const insightCards = ins.slice(0, 4).map((x) => `<div class="insight"><span class="ico">${x[0]}</span><span class="tx">${x[1]}</span></div>`).join('');

  const momTag = momPct === null ? '' : `<span class="delta ${momPct >= 0 ? 'up' : 'down'}">${momPct >= 0 ? '▲' : '▼'} ${Math.abs(momPct)}% vs last month</span>`;

  const body = `<div class="wrap">
    <div class="head">
      <div class="brand"><div class="logo">💰</div><div><h1>Finance</h1><div class="sub">${esc(today)} · <span class="mono">${esc(m.label)}</span></div></div></div>
      <div class="pill">₹ figures · USD card charges @ 99.40</div>
    </div>

    <div class="hero">
      <div class="card">
        <div class="k">Net saved · this month</div>
        <div class="hero-net ${m.net >= 0 ? 'pos' : 'up'}">${inr(m.net)}</div>
        <div class="hero-sub">${m.rate !== null ? `${m.rate}% of ₹${short(m.income)} income kept` : 'income − spend'}</div>
        ${m.rate !== null ? `<div class="meter"><span style="width:${Math.max(2, Math.min(100, m.rate))}%"></span></div>` : ''}
        <div style="margin-top:14px">${sparkline(spark30)}</div>
        <div class="sub2" style="margin-top:6px">30-day spend trend</div>
      </div>
      <div class="card">
        <div class="k">Spent · this month</div>
        <div class="big">${inr(m.spent)} <small>· ${m.count} txns</small></div>
        ${momTag}
        <div class="chip">Projected month-end <b>${inr(projected)}</b></div>
        <div class="chip">Avg <b>${inr(perDay)}</b>/day · biggest <b>${inr(d.biggest ? d.biggest.amount : 0)}</b></div>
        <div class="chip" style="margin-top:12px">Day <b>${m.daysSoFar}</b> of ${daysInMonth} · <b>${Math.round((m.daysSoFar / daysInMonth) * 100)}%</b> through the month</div>
        <div class="meter" style="margin-top:8px"><span style="width:${Math.round((m.daysSoFar / daysInMonth) * 100)}%;background:linear-gradient(90deg,#2b6fd0,var(--acc))"></span></div>
      </div>
      <div class="card">
        <div class="k">Income · this month</div>
        <div class="big pos">${inr(m.income)}</div>
        <div class="chip" style="margin-top:12px">Recurring subs ~<b>${inr(recur)}</b>/mo</div>
        <div class="chip">≈ <b>${inr(recur * 12)}</b>/yr committed</div>
        <div class="chip">Cashflow this month <b class="${m.net >= 0 ? 'pos' : 'up'}">${m.net >= 0 ? '+' : ''}${inr(m.net)}</b></div>
      </div>
    </div>

    <div class="insbar">${insightCards}</div>

    <div class="wins">${winCards}</div>

    <div class="grid g2 mb">
      <div class="card"><h2>Income vs spend <span class="r">6 months</span></h2>${monthlyBars(d.monthly)}</div>
      <div class="card"><h2>Spending pace <span class="r">vs last month</span></h2>${pace(map, today, m.label, lastYM, lastDIM)}</div>
    </div>

    <div class="card mb"><h2>Daily spend <span class="r">last 60 days</span></h2>${trend(map, today)}</div>

    <div class="grid g2 mb">
      <div class="card"><h2>By category <span class="r">30 days</span></h2>
        <div class="donutwrap">${donut(segs, catTot)}<div class="lg">${donutLegend}</div></div>
      </div>
      <div class="card"><h2>Top merchants <span class="r">30 days</span></h2>${merchBars}</div>
    </div>

    <div class="card mb"><h2>Spending calendar <span class="r">last 13 weeks</span></h2>${heat}
      <div class="legrow"><span>less</span>${HEAT.map((c) => `<span class="sw" style="background:${c}"></span>`).join('')}<span>more</span></div>
    </div>

    <div class="grid g3 mb">
      <div class="card"><h2>Payment channels <span class="r">30 days</span></h2>${stacked(chSeg, chTot)}
        <div class="chip" style="margin-top:14px">Merchant pay <b>${inr(p2m)}</b> · to people <b>${inr(p2a)}</b>${other ? ` · other <b>${inr(other)}</b>` : ''}</div>
      </div>
      <div class="card"><h2>Spend by weekday <span class="r">avg/day</span></h2><div class="wd">${weekday}</div>
        <div class="chip" style="margin-top:8px">Heaviest day: <b>${busiestWd}</b></div></div>
      <div class="card"><h2>Transaction sizes <span class="r">30 days</span></h2>
        ${szRows.map(([l, v]) => `<div class="bar-row"><span class="bar-lbl">${l}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, Math.round((v / szMax) * 100))}%;background:linear-gradient(90deg,#3a6ba8,var(--acc))"></span></span><span class="bar-val">${v}</span></div>`).join('')}
      </div>
    </div>

    <div class="tiles mb">
      <div class="card tile"><div class="k">Biggest expense</div><div class="v">${d.biggest ? inr(d.biggest.amount) : '—'}</div><div class="t">${d.biggest ? esc(d.biggest.counterparty || '?') : ''}</div></div>
      <div class="card tile"><div class="k">Biggest day</div><div class="v">${inr(bigDay.s)}</div><div class="t">${esc(bigDay.day)}</div></div>
      <div class="card tile"><div class="k">Avg transaction</div><div class="v">${inr(avgTxn)}</div><div class="t">${m.count} txns this month</div></div>
      <div class="card tile"><div class="k">No-spend days</div><div class="v">${noSpend}<small style="font-size:13px;color:var(--muted)"> / ${m.daysSoFar}</small></div><div class="t">days without spending</div></div>
    </div>

    <div class="grid g3 mb">
      <div class="card"><h2>💰 Income <span class="r">recent</span></h2>${income}</div>
      <div class="card"><h2>Subscriptions <span class="r">~${short(recur)}/mo</span></h2>${subs}</div>
      <div class="card"><h2>By category <span class="r">bars</span></h2>${catBars}</div>
    </div>

    <div class="card"><h2>Recent transactions</h2>${recent}</div>
  </div>`;
  return page('Finance', body);
}

export function renderLogin(error = '') {
  return page('Finance', `<form method="POST" action="/">
    <div class="brand" style="justify-content:center;margin-bottom:8px"><div class="logo">💰</div></div>
    <h1 class="mono" style="margin:0">finance</h1>
    <p class="sub" style="color:var(--dim)">enter passphrase</p>
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
