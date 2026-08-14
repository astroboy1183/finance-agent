// dashboard.js — comprehensive, INTERACTIVE finance dashboard (inline CSS/SVG/JS,
// no external requests). Dark premium surface. Every card/bar/cell drills into a
// transaction modal; charts show custom hover tooltips. Data-viz method: one hero
// number, single-hue blue for magnitude, fixed categorical order, status colors.
import { inr, subAmount } from './timeutil.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CAT = ['#5b9dff', '#f5854a', '#37c98f', '#f5c451', '#e07aa8', '#9d8bff', '#5ad1e0', '#7a8aa0'];
const HEAT = ['#151b26', '#16324f', '#1d5583', '#2a7cc0', '#5b9dff'];
const C_SPEND = '#5b9dff', C_INCOME = '#37c98f';

const CSS = `
:root{
  --bg:#0a0d13;--card:#121824;--card-2:#0e131d;--brd:#1e2736;
  --text:#eaf0f8;--dim:#93a2b8;--muted:#5d6982;
  --acc:#5b9dff;--acc-2:#7c5cff;--green:#37c98f;--red:#ff6b6b;--amber:#f5b23d;
  --shadow:0 10px 30px -18px rgba(0,0,0,.8);
}
*{box-sizing:border-box}
body{margin:0;color:var(--text);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:radial-gradient(1100px 520px at 12% -8%,rgba(91,157,255,.10),transparent 62%),radial-gradient(900px 500px at 100% 0%,rgba(124,92,255,.08),transparent 60%),var(--bg);
  padding:26px 22px 84px;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.tnum{font-variant-numeric:tabular-nums}
a{color:var(--acc);text-decoration:none}

.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:22px;flex-wrap:wrap;gap:10px}
.brand{display:flex;align-items:center;gap:11px}
.brand .logo{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:19px;background:linear-gradient(145deg,rgba(91,157,255,.28),rgba(124,92,255,.20));border:1px solid var(--brd)}
.brand h1{font-size:16px;margin:0;letter-spacing:-.01em}.brand .sub{color:var(--dim);font-size:12px;margin-top:1px}
.pill{color:var(--dim);font-size:11.5px;border:1px solid var(--brd);border-radius:999px;padding:6px 12px;background:var(--card-2)}
.live{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dim);border:1px solid var(--brd);border-radius:999px;padding:6px 12px;background:var(--card-2)}
.live .ld{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.7s infinite}
.live #clock{color:var(--text)}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(55,201,143,.55)}70%{box-shadow:0 0 0 7px rgba(55,201,143,0)}100%{box-shadow:0 0 0 0 rgba(55,201,143,0)}}
.flash{animation:flash 1s ease}@keyframes flash{0%{background:rgba(55,201,143,.16)}100%{background:transparent}}

.card{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);border-radius:18px;padding:18px 20px;box-shadow:var(--shadow);
  cursor:pointer;transition:transform .13s ease,border-color .13s,box-shadow .13s;position:relative}
.card:hover{transform:translateY(-2px);border-color:#324258;box-shadow:0 20px 46px -22px rgba(0,0,0,.92)}
.card:active{transform:translateY(0)}
.card>h2{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:0 0 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
.card>h2 .r{color:var(--muted);letter-spacing:.02em;text-transform:none;font-weight:500}
.grid{display:grid;gap:16px}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.mb{margin-bottom:16px}
@media(max-width:860px){.g2,.g3{grid-template-columns:1fr}}

.hero{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:16px;margin-bottom:16px}
@media(max-width:860px){.hero{grid-template-columns:1fr}}
.k{color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.hero-net{font-size:52px;line-height:1.02;font-weight:680;letter-spacing:-.035em;margin:9px 0 4px}
.hero-sub{color:var(--dim);font-size:12.5px}
.meter{height:9px;border-radius:6px;background:#182234;overflow:hidden;margin-top:14px;border:1px solid var(--brd)}
.meter>span{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#2b6fd0,var(--green))}
.big{font-size:29px;font-weight:670;letter-spacing:-.025em;margin-top:6px}.big small{font-size:12px;color:var(--dim);font-weight:400;letter-spacing:0}
.sub2{color:var(--muted);font-size:11.5px;margin-top:3px}
.delta{font-size:12px;font-weight:650;display:inline-flex;gap:5px;align-items:center;margin-top:7px}
.up{color:var(--red)}.down{color:var(--green)}.pos{color:var(--green)}
.chip{margin-top:10px;font-size:12px;color:var(--dim)}.chip b{color:var(--text)}

.insbar{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
@media(max-width:860px){.insbar{grid-template-columns:1fr 1fr}}
.insight{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);border-radius:14px;padding:13px 15px;display:flex;gap:11px;align-items:flex-start}
.insight .ico{font-size:17px;line-height:1.3}.insight .tx{font-size:12.5px;color:var(--dim);line-height:1.42}.insight .tx b{color:var(--text);font-weight:650}

.wins{display:grid;grid-template-columns:repeat(5,1fr);gap:13px;margin-bottom:16px}
@media(max-width:860px){.wins{grid-template-columns:repeat(2,1fr)}}
.win{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);border-radius:14px;padding:14px 15px;cursor:pointer;transition:transform .13s,border-color .13s}
.win:hover{transform:translateY(-2px);border-color:#324258}
.win .v{font-size:19px;font-weight:660;margin-top:4px;letter-spacing:-.02em}.win .t{color:var(--muted);font-size:11px;margin-top:3px}
.win .rail{height:3px;border-radius:2px;margin-top:10px;background:linear-gradient(90deg,var(--acc),transparent)}

.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}@media(max-width:860px){.tiles{grid-template-columns:1fr 1fr}}
.tile .v{font-size:21px;font-weight:660;margin-top:5px;letter-spacing:-.02em}.tile .t{color:var(--muted);font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.bar-row{display:grid;grid-template-columns:104px 1fr auto;align-items:center;gap:12px;padding:6px 8px;margin:0 -8px;border-radius:9px;cursor:pointer;transition:background .12s}
.bar-row:hover{background:#ffffff0a}
.bar-lbl{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-lbl .n{color:var(--muted);font-size:10.5px}
.bar-track{height:10px;background:#172032;border-radius:6px;overflow:hidden}.bar-fill{height:100%;border-radius:6px}
.bar-val{font-size:12.5px;font-variant-numeric:tabular-nums}

.lg{display:flex;flex-direction:column;gap:9px;margin-top:2px}
.lg .it{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--dim);cursor:pointer;padding:2px 6px;margin:-2px -6px;border-radius:7px}
.lg .it:hover{background:#ffffff0a}
.lg .sw{width:10px;height:10px;border-radius:3px;flex:none}.lg .it b{color:var(--text);font-weight:600}.lg .it .n{margin-left:auto;color:var(--text);font-variant-numeric:tabular-nums}
.donutwrap{display:grid;grid-template-columns:170px 1fr;gap:18px;align-items:center}@media(max-width:520px){.donutwrap{grid-template-columns:1fr}}

.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px;margin:0 -8px;border-radius:9px;font-size:13px;border-bottom:1px solid var(--brd);cursor:pointer}
.row:hover{background:#ffffff0a}
.row .amt{font-variant-numeric:tabular-nums;white-space:nowrap}.row .who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;min-width:0}
.dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:8px;flex:none}.tag{color:var(--muted);font-size:11px}

.svgw{width:100%;height:auto;display:block}
.heat-wrap{overflow-x:auto}.heat{height:auto;display:block;margin:2px auto}
.heat rect{cursor:pointer}
.legrow{display:flex;align-items:center;gap:7px;margin-top:12px;font-size:11px;color:var(--muted)}.legrow .sw{width:13px;height:13px;border-radius:3px}
.wd{display:flex;gap:8px;align-items:flex-end;height:110px;margin-top:6px}
.wd .c{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px;height:100%;cursor:pointer}
.wd .cb{width:64%;max-width:30px;background:linear-gradient(180deg,var(--acc),#33639e);border-radius:5px 5px 0 0;min-height:3px}
.wd .c:hover .cb{background:linear-gradient(180deg,#8bc0ff,var(--acc))}
.wd .cl{color:var(--muted);font-size:10.5px}
.chlegend{display:flex;gap:8px 14px;margin-top:12px;flex-wrap:wrap;font-size:11.5px;color:var(--dim)}.chlegend .it{display:flex;align-items:center;gap:6px}.chlegend .sw{width:10px;height:10px;border-radius:3px}
.stackseg{cursor:pointer}
svg rect,svg circle{cursor:pointer}

/* tooltip + modal */
.tip{position:fixed;z-index:80;pointer-events:none;display:none;background:#0b0f17;border:1px solid #33425a;border-radius:9px;padding:7px 10px;font-size:12px;color:var(--text);box-shadow:0 12px 32px -12px rgba(0,0,0,.95);max-width:250px;white-space:nowrap}
.ov{position:fixed;inset:0;z-index:70;display:none;background:rgba(4,7,12,.66);backdrop-filter:blur(3px);align-items:center;justify-content:center;padding:20px}
.modal{background:linear-gradient(180deg,var(--card),var(--card-2));border:1px solid var(--brd);border-radius:18px;width:min(580px,96vw);max-height:84vh;display:flex;flex-direction:column;box-shadow:0 40px 90px -30px #000;overflow:hidden}
.mhead{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px;border-bottom:1px solid var(--brd)}
.mtitle{font-size:17px;font-weight:670}.msub{color:var(--dim);font-size:12px;margin-top:4px}
.mx{width:30px;height:30px;border-radius:9px;background:#ffffff12;border:0;color:var(--text);font-size:13px;cursor:pointer;flex:none}
.mbody{overflow-y:auto;padding:6px 20px 18px}
.mrow{display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--brd);font-size:13px}.mrow:last-child{border-bottom:0}
.mrow .amt{font-variant-numeric:tabular-nums;white-space:nowrap}.mrow .who{display:flex;align-items:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hint{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);font-size:11.5px;color:var(--muted);background:var(--card-2);border:1px solid var(--brd);padding:7px 14px;border-radius:999px;z-index:40}

form{max-width:330px;margin:16vh auto;text-align:center}
input{width:100%;padding:13px;border-radius:12px;border:1px solid var(--brd);background:var(--card);color:var(--text);font-size:15px;margin:12px 0}
button{width:100%;padding:13px;border-radius:12px;border:0;background:linear-gradient(145deg,var(--acc),var(--acc-2));color:#04121f;font-weight:650;font-size:15px;cursor:pointer}
.err{color:var(--red);font-size:13px}
`;

// ---- helpers ---------------------------------------------------------------
const p2 = (n) => String(n).padStart(2, '0');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function addDays(s, delta) { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + delta)); return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`; }
const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const dayIdx = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monLabel = (ym) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
function short(n) { n = Math.round(Math.abs(n)); if (n >= 1e7) return (n / 1e7).toFixed(n >= 1e8 ? 0 : 1) + 'Cr'; if (n >= 1e5) return (n / 1e5).toFixed(n >= 1e6 ? 0 : 1) + 'L'; if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k'; return String(n); }
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
const quantile = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0);

// ---- charts ----------------------------------------------------------------
function sparkline(vals, w = 240, h = 46, color = C_SPEND) {
  const max = Math.max(1, ...vals), n = vals.length, x = (i) => (i / (n - 1)) * w, y = (v) => h - 2 - (v / max) * (h - 4);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  return `<svg class="svgw" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="M0,${h} L${pts.join(' L')} L${w},${h} Z" fill="${color}" opacity="0.13"/><path d="M${pts.join(' L')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

function trend(map, today) {
  const days = []; for (let i = 59; i >= 0; i--) days.push(addDays(today, -i));
  const vals = days.map((d) => map[d] || 0);
  const ma = vals.map((_, i) => { const s = vals.slice(Math.max(0, i - 6), i + 1); return s.reduce((a, b) => a + b, 0) / s.length; });
  const W = 760, H = 210, L = 44, R = 14, T = 16, B = 24, pw = W - L - R, ph = H - T - B, ymax = niceMax(Math.max(1, ...vals));
  const slot = pw / days.length, bw = Math.min(slot - 2.5, 8), X = (i) => L + i * slot + (slot - bw) / 2, Y = (v) => T + ph - (v / ymax) * ph;
  let grid = ''; for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}" stroke="var(--brd)"/><text x="${L - 8}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  const peak = vals.indexOf(Math.max(...vals)); let bars = '';
  vals.forEach((v, i) => { if (v <= 0) return; const h = Math.max(2, (v / ymax) * ph); bars += `<rect data-drill="day:${days[i]}" x="${X(i).toFixed(1)}" y="${(T + ph - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2.5" fill="${i === peak ? C_SPEND : '#3a6ba8'}"><title>${days[i]}: ${inr(v)}</title></rect>`; });
  const maLine = `M${ma.map((v, i) => `${(X(i) + bw / 2).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')}`;
  let xlab = ''; days.forEach((d, i) => { if (d.slice(8) === '01' || i === 0) xlab += `<text x="${(X(i) + bw / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--muted)" font-size="10">${MON[Number(d.slice(5, 7)) - 1]}</text>`; });
  const plab = vals[peak] > 0 ? `<text x="${(X(peak) + bw / 2).toFixed(1)}" y="${Math.max(Y(vals[peak]) - 6, 12).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="10.5" font-weight="650" class="tnum">${short(vals[peak])}</text>` : '';
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spend, last 60 days">${grid}${bars}<path d="${maLine}" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linejoin="round" opacity="0.9" pointer-events="none"/>${plab}${xlab}</svg><div class="chlegend"><span class="it"><span class="sw" style="background:${C_SPEND}"></span>daily spend</span><span class="it"><span class="sw" style="background:var(--amber)"></span>7-day average</span></div>`;
}

function monthlyBars(months) {
  const data = months.slice(-6), W = 760, H = 210, L = 44, R = 14, T = 16, B = 26, pw = W - L - R, ph = H - T - B;
  const ymax = niceMax(Math.max(1, ...data.flatMap((m) => [m.debit, m.credit]))), gw = pw / data.length, bw = Math.min((gw - 14) / 2, 26);
  let grid = ''; for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="var(--brd)"/><text x="${L - 8}" y="${gy + 3.5}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  let bars = '', xl = '';
  data.forEach((m, i) => { const cx = L + i * gw + gw / 2, bx1 = cx - bw - 2, bx2 = cx + 2, hs = Math.max(m.debit > 0 ? 2 : 0, (m.debit / ymax) * ph), hi = Math.max(m.credit > 0 ? 2 : 0, (m.credit / ymax) * ph);
    if (hs) bars += `<rect data-drill="ym:${m.ym}" x="${bx1.toFixed(1)}" y="${(T + ph - hs).toFixed(1)}" width="${bw.toFixed(1)}" height="${hs.toFixed(1)}" rx="4" fill="${C_SPEND}"><title>${monLabel(m.ym)} spent ${inr(m.debit)}</title></rect>`;
    if (hi) bars += `<rect data-drill="ym:${m.ym}" x="${bx2.toFixed(1)}" y="${(T + ph - hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="4" fill="${C_INCOME}"><title>${monLabel(m.ym)} income ${inr(m.credit)}</title></rect>`;
    xl += `<text x="${cx.toFixed(1)}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="10.5">${monLabel(m.ym)}</text>`; });
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly income vs spend">${grid}${bars}${xl}</svg><div class="chlegend"><span class="it"><span class="sw" style="background:${C_SPEND}"></span>spent</span><span class="it"><span class="sw" style="background:${C_INCOME}"></span>income</span></div>`;
}

function pace(map, today, thisYM, lastYM, lastDIM) {
  const dim = 31, cum = (ym, upto) => { const o = []; let s = 0; for (let d = 1; d <= upto; d++) { s += map[`${ym}-${p2(d)}`] || 0; o.push(s); } return o; };
  const dsofar = Number(today.slice(8, 10)), cur = cum(thisYM, dsofar), prev = cum(lastYM, lastDIM);
  const W = 760, H = 210, L = 44, R = 14, T = 16, B = 24, pw = W - L - R, ph = H - T - B, ymax = niceMax(Math.max(1, ...cur, ...prev));
  const X = (d) => L + ((d - 1) / (dim - 1)) * pw, Y = (v) => T + ph - (v / ymax) * ph;
  let grid = ''; for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="var(--brd)"/><text x="${L - 8}" y="${gy + 3.5}" text-anchor="end" fill="var(--muted)" font-size="10" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  const path = (a) => `M${a.map((v, i) => `${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join(' L')}`;
  let xl = ''; for (const d of [1, 8, 15, 22, 29]) xl += `<text x="${X(d).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--muted)" font-size="10">${d}</text>`;
  const dot = `<circle cx="${X(dsofar).toFixed(1)}" cy="${Y(cur[cur.length - 1]).toFixed(1)}" r="4" fill="${C_SPEND}" stroke="var(--card)" stroke-width="2"><title>day ${dsofar}: ${inr(cur[cur.length - 1])}</title></circle>`;
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending pace vs last month">${grid}<path d="${path(prev)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="4 4" pointer-events="none"/><path d="${path(cur)}" fill="none" stroke="${C_SPEND}" stroke-width="2.5" pointer-events="none"/>${dot}${xl}</svg><div class="chlegend"><span class="it"><span class="sw" style="background:${C_SPEND}"></span>this month</span><span class="it"><span class="sw" style="background:var(--muted)"></span>last month</span></div>`;
}

function donut(segs, total) {
  const size = 168, w = 26, r = (size - w) / 2, C = 2 * Math.PI * r, cx = size / 2; let off = 0, rings = '';
  segs.forEach((s) => { const f = total > 0 ? s.value / total : 0, len = Math.max(0, f * C - 2.5); rings += `<circle ${s.drill ? `data-drill="${s.drill}"` : ''} cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${w}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off * C).toFixed(1)}" transform="rotate(-90 ${cx} ${cx})"><title>${esc(s.label)}: ${inr(s.value)}</title></circle>`; off += f; });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Category breakdown">${rings}<text x="${cx}" y="${cx - 4}" text-anchor="middle" fill="var(--dim)" font-size="10" letter-spacing=".05em" pointer-events="none">SPENT 30D</text><text x="${cx}" y="${cx + 15}" text-anchor="middle" fill="var(--text)" font-size="17" font-weight="680" class="tnum" pointer-events="none">${short(total)}</text></svg>`;
}

function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => `<div class="bar-row" ${r.drill ? `data-drill="${esc(r.drill)}"` : ''} data-tip="${esc(r.label)}: ${inr(r.value)}"><span class="bar-lbl">${esc(r.label)}${r.n ? ` <span class="n">${esc(r.n)}</span>` : ''}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, Math.round((r.value / max) * 100))}%;background:linear-gradient(90deg,#3a6ba8,var(--acc))"></span></span><span class="bar-val">${inr(r.value)}</span></div>`).join('') || '<div class="tag">no data</div>';
}

function stacked(segs, total) {
  const bar = segs.map((s) => `<span class="stackseg" ${s.drill ? `data-drill="${s.drill}"` : ''} data-tip="${esc(s.label)}: ${inr(s.value)} (${Math.round((s.value / total) * 100)}%)" style="width:${(s.value / total) * 100}%;background:${s.color};display:block;height:100%"></span>`).join('');
  const leg = segs.map((s) => `<span class="it"><span class="sw" style="background:${s.color}"></span>${esc(s.label)} <b style="color:var(--text)">${Math.round((s.value / total) * 100)}%</b></span>`).join('');
  return `<div style="display:flex;height:16px;border-radius:8px;overflow:hidden;gap:2px;background:var(--bg)">${bar}</div><div class="chlegend" style="margin-top:14px">${leg}</div>`;
}

// ---- page ------------------------------------------------------------------
export function renderDashboard(d) {
  const today = d.generatedIst, m = d.month;
  const map = {}; for (const r of d.dailyDebit) map[r.day_ist] = r.s;
  const daysInMonth = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate();
  const perDay = m.daysSoFar ? m.spent / m.daysSoFar : 0, projected = perDay * daysInMonth;
  const avgTxn = m.count ? m.spent / m.count : 0;
  const monthDays = Object.keys(map).filter((k) => k.slice(0, 7) === m.label);
  const noSpend = Math.max(0, m.daysSoFar - monthDays.filter((k) => map[k] > 0).length);
  let bigDay = { day: '—', s: 0 }; for (const k of monthDays) if ((map[k] || 0) > bigDay.s) bigDay = { day: k, s: map[k] };
  const recur = d.subs.reduce((a, s) => a + (s.currency === 'INR' ? s.amount : s.amount * 99.4024), 0);
  const spark30 = []; for (let i = 29; i >= 0; i--) spark30.push(map[addDays(today, -i)] || 0);

  const pm = m.label.split('-').map(Number); let py = pm[0], pmo = pm[1] - 1; if (pmo === 0) { pmo = 12; py--; }
  const lastYM = `${py}-${p2(pmo)}`, lastDIM = new Date(Date.UTC(py, pmo, 0)).getUTCDate();
  let sameLast = 0; for (let dd = 1; dd <= m.daysSoFar; dd++) sameLast += map[`${lastYM}-${p2(dd)}`] || 0;
  const momSame = sameLast > 0 ? Math.round((m.spent / sameLast - 1) * 100) : null;
  const projVsLast = m.prevSpent > 0 ? Math.round((projected / m.prevSpent - 1) * 100) : null;

  const catsAll = d.categories, catTot = catsAll.reduce((a, c) => a + c.s, 0), top7 = catsAll.slice(0, 7);
  const topShare = catTot > 0 && catsAll[0] ? Math.round((catsAll[0].s / catTot) * 100) : 0;
  const otherVal = catsAll.slice(7).reduce((a, c) => a + c.s, 0);
  const segs = top7.map((c, i) => ({ label: c.category, value: c.s, color: CAT[i], drill: `cat:${c.category}` }));
  if (otherVal > 0) segs.push({ label: 'other', value: otherVal, color: CAT[7] });

  const wdSum = Array(7).fill(0), wdN = Array(7).fill(0);
  for (const k of Object.keys(map)) { const w = dow(k); wdSum[w] += map[k]; wdN[w]++; }
  const wdAvg = wdSum.map((s, i) => (wdN[i] ? s / wdN[i] : 0)), wdMax = Math.max(1, ...wdAvg), WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekday = [1, 2, 3, 4, 5, 6, 0].map((i) => `<div class="c" data-drill="dow:${i}" data-tip="${WD[i]}: ${inr(wdAvg[i])}/day avg"><div class="cb" style="height:${Math.round((wdAvg[i] / wdMax) * 100)}%"></div><div class="cl">${WD[i][0]}</div></div>`).join('');
  const busiestWd = WD[wdAvg.indexOf(Math.max(...wdAvg))];

  const chTot = d.channels.reduce((a, c) => a + c.s, 0) || 1;
  const chSeg = d.channels.slice(0, 5).map((c, i) => ({ label: c.channel, value: c.s, color: CAT[i], drill: `channel:${c.channel}` }));
  const p2m = (d.upiSplit.find((x) => x.t === 'P2M') || { s: 0 }).s, p2a = (d.upiSplit.find((x) => x.t === 'P2A') || { s: 0 }).s;
  const otherU = d.upiSplit.filter((x) => x.t !== 'P2M' && x.t !== 'P2A').reduce((a, x) => a + x.s, 0);

  const sz = d.sizes || { b1: 0, b2: 0, b3: 0, b4: 0 };
  const szRows = [['< ₹200', sz.b1, '0,200'], ['₹200–1k', sz.b2, '200,1000'], ['₹1k–5k', sz.b3, '1000,5000'], ['≥ ₹5k', sz.b4, '5000,-1']];
  const szMax = Math.max(1, sz.b1, sz.b2, sz.b3, sz.b4);

  // heatmap
  const hmStart = addDays(today, -(12 * 7 + dow(today))), hmDays = []; for (let dd = hmStart; dd <= today; dd = addDays(dd, 1)) hmDays.push(dd);
  const hnz = hmDays.map((k) => map[k] || 0).filter((v) => v > 0).sort((a, b) => a - b), cap90 = quantile(hnz, 0.9) || 1;
  const hlvl = (v) => (v <= 0 ? 0 : Math.max(1, Math.min(4, 1 + Math.floor(Math.sqrt(v / cap90) * 3.999))));
  const CELL = 15, GAP = 4.5, COL = CELL + GAP, LL = 26, TT = 15, weeks = Math.ceil((dayIdx(today) - dayIdx(hmStart) + 1) / 7);
  const hW = LL + weeks * COL, hH = TT + 7 * COL; let cells = '', mlab = '', lastMo = '';
  hmDays.forEach((dd) => { const wk = Math.floor((dayIdx(dd) - dayIdx(hmStart)) / 7), wd = dow(dd), x = LL + wk * COL, y = TT + wd * COL, v = map[dd] || 0;
    cells += `<rect data-drill="day:${dd}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="3.5" fill="${HEAT[hlvl(v)]}"><title>${dd}: ${v > 0 ? inr(v) : 'no spend'}</title></rect>`;
    if (wd === 0) { const mo = MON[Number(dd.slice(5, 7)) - 1]; if (mo !== lastMo) { mlab += `<text x="${x}" y="${TT - 4}" fill="var(--muted)" font-size="10" pointer-events="none">${mo}</text>`; lastMo = mo; } } });
  let wl = ''; [['M', 1], ['W', 3], ['F', 5]].forEach(([t, r]) => { wl += `<text x="4" y="${TT + r * COL + CELL - 3}" fill="var(--muted)" font-size="9.5" pointer-events="none">${t}</text>`; });
  const heat = `<div class="heat-wrap"><svg class="heat" viewBox="0 0 ${hW} ${hH}" width="${hW}" height="${hH}" role="img" aria-label="Spending calendar">${mlab}${wl}${cells}</svg></div>`;

  const winCards = d.windows.map((w) => `<div class="win" data-drill="win:${w.days}"><div class="k">last ${w.days}d</div><div class="v">${inr(w.total)}</div><div class="t">${w.count} txns · ${inr(w.days ? w.total / w.days : 0)}/day</div><div class="rail"></div></div>`).join('');
  const catBars = hbars(top7.map((c) => ({ label: c.category, n: `${c.c}`, value: c.s, drill: `cat:${c.category}` })));
  const merchBars = hbars(d.top.map((t) => ({ label: t.counterparty, n: t.category || '', value: t.s, drill: `merch:${t.counterparty}` })));

  const rowTx = (t) => `<div class="row" data-drill="merch:${esc(t.counterparty || '')}"><span class="who"><span class="dot" style="background:${t.direction === 'credit' ? 'var(--green)' : 'var(--acc)'}"></span>${esc(t.counterparty || '?')}&nbsp;<span class="tag">${esc(t.ts_ist.slice(5, 16))}</span></span><span class="amt${t.direction === 'credit' ? ' pos' : ''}">${inr(t.amount)}</span></div>`;
  const income = (d.income_list || []).map((t) => `<div class="row" data-drill="merch:${esc(t.counterparty || '')}"><span class="who"><span class="dot" style="background:var(--green)"></span>${esc(t.counterparty || '?')}&nbsp;<span class="tag">${esc((t.channel || '') + ' · ' + t.ts_ist.slice(0, 10))}</span></span><span class="amt pos">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no credits</div>';
  const subs = d.subs.map((s) => `<div class="row" data-drill="merch:${esc(s.merchant)}"><span class="who">${esc(s.merchant)}</span><span class="amt">${esc(subAmount(s.currency, s.amount))}</span></div>`).join('') || '<div class="tag">none</div>';
  const recent = d.recent.map(rowTx).join('') || '<div class="tag">no data</div>';
  const donutLegend = segs.map((s) => `<div class="it" ${s.drill ? `data-drill="${s.drill}"` : ''}><span class="sw" style="background:${s.color}"></span><b>${esc(s.label)}</b><span class="n">${short(s.value)} · ${Math.round((s.value / catTot) * 100)}%</span></div>`).join('');

  // ---- insights (accurate) ----
  const ins = [];
  if (momSame !== null) ins.push([momSame >= 0 ? '📈' : '📉', `Spent <b>${inr(m.spent)}</b> so far — <b>${Math.abs(momSame)}% ${momSame >= 0 ? 'more' : 'less'}</b> than by day ${m.daysSoFar} last month.`]);
  if (projVsLast !== null) ins.push(['🗓️', `On this pace you'll reach <b>${inr(projected)}</b> — <b>${Math.abs(projVsLast)}% ${projVsLast >= 0 ? 'above' : 'below'}</b> last month's ${inr(m.prevSpent)}.`]);
  else ins.push(['🗓️', `At this pace you'll spend <b>${inr(projected)}</b> by month-end.`]);
  if (catsAll[0]) ins.push(['🏷️', `<b>${cap(catsAll[0].category)}</b> is your top category — <b>${topShare}%</b> of 30-day spend (${inr(catsAll[0].s)}).`]);
  if (recur > 0 && m.spent > 0) ins.push(['🔁', `Subscriptions run ~<b>${inr(recur)}</b>/mo — about <b>${Math.round((recur / m.spent) * 100)}%</b> of this month's spend.`]);
  else if (m.rate !== null) ins.push([m.rate >= 0 ? '💰' : '⚠️', `You're keeping <b>${m.rate}%</b> of income — <b>${inr(m.net)}</b> saved this month.`]);
  const insightCards = ins.slice(0, 4).map((x) => `<div class="insight"><span class="ico">${x[0]}</span><span class="tx">${x[1]}</span></div>`).join('');
  const momTag = momSame === null ? '' : `<span class="delta ${momSame >= 0 ? 'up' : 'down'}">${momSame >= 0 ? '▲' : '▼'} ${Math.abs(momSame)}% vs last month (same days)</span>`;

  const dataJson = JSON.stringify({ tx: d.tx || [], today, sig: d.sig || '' }).replace(/</g, '\\u003c');

  const body = `<div class="wrap">
    <div class="head">
      <div class="brand"><div class="logo">💰</div><div><h1>Finance</h1><div class="sub">${esc(today)} · <span class="mono">${esc(m.label)}</span></div></div></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="live"><span class="ld"></span>live · <span id="clock" class="tnum">--:--:--</span></div>
        <div class="pill">₹ · USD card @ 99.40 · click to drill in</div>
      </div>
    </div>

    <div class="hero">
      <div class="card" data-drill="monthall">
        <div class="k">Net saved · this month</div>
        <div class="hero-net ${m.net >= 0 ? 'pos' : 'up'}">${inr(m.net)}</div>
        <div class="hero-sub">${m.rate !== null ? `${m.rate}% of ₹${short(m.income)} income kept` : 'income − spend'}</div>
        ${m.rate !== null ? `<div class="meter"><span style="width:${Math.max(2, Math.min(100, m.rate))}%"></span></div>` : ''}
        <div style="margin-top:14px">${sparkline(spark30)}</div><div class="sub2" style="margin-top:6px">30-day spend trend</div>
      </div>
      <div class="card" data-drill="month">
        <div class="k">Spent · this month</div>
        <div class="big">${inr(m.spent)} <small>· ${m.count} txns</small></div>${momTag}
        <div class="chip">Projected month-end <b>${inr(projected)}</b></div>
        <div class="chip">Avg <b>${inr(perDay)}</b>/day · biggest <b>${inr(d.biggest ? d.biggest.amount : 0)}</b></div>
        <div class="chip" style="margin-top:12px">Day <b>${m.daysSoFar}</b> of ${daysInMonth} · <b>${Math.round((m.daysSoFar / daysInMonth) * 100)}%</b> through the month</div>
        <div class="meter" style="margin-top:8px"><span style="width:${Math.round((m.daysSoFar / daysInMonth) * 100)}%;background:linear-gradient(90deg,#2b6fd0,var(--acc))"></span></div>
      </div>
      <div class="card" data-drill="credits">
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
      <div class="card" data-drill="all"><h2>Income vs spend <span class="r">6 months</span></h2>${monthlyBars(d.monthly)}</div>
      <div class="card" data-drill="month"><h2>Spending pace <span class="r">vs last month</span></h2>${pace(map, today, m.label, lastYM, lastDIM)}</div>
    </div>

    <div class="card mb" data-drill="win:60"><h2>Daily spend <span class="r">last 60 days</span></h2>${trend(map, today)}</div>

    <div class="grid g2 mb">
      <div class="card" data-drill="win:30"><h2>By category <span class="r">30 days</span></h2><div class="donutwrap">${donut(segs, catTot)}<div class="lg">${donutLegend}</div></div></div>
      <div class="card" data-drill="win:30"><h2>Top merchants <span class="r">30 days</span></h2>${merchBars}</div>
    </div>

    <div class="card mb" data-drill="win:91"><h2>Spending calendar <span class="r">last 13 weeks</span></h2>${heat}<div class="legrow"><span>less</span>${HEAT.map((c) => `<span class="sw" style="background:${c}"></span>`).join('')}<span>more</span></div></div>

    <div class="grid g3 mb">
      <div class="card" data-drill="win:30"><h2>Payment channels <span class="r">30 days</span></h2>${stacked(chSeg, chTot)}<div class="chip" style="margin-top:14px">Merchant pay <b>${inr(p2m)}</b> · to people <b>${inr(p2a)}</b>${otherU ? ` · other <b>${inr(otherU)}</b>` : ''}</div></div>
      <div class="card" data-drill="win:91"><h2>Spend by weekday <span class="r">avg/day</span></h2><div class="wd">${weekday}</div><div class="chip" style="margin-top:8px">Heaviest day: <b>${busiestWd}</b></div></div>
      <div class="card" data-drill="win:30"><h2>Transaction sizes <span class="r">30 days</span></h2>${szRows.map(([l, v, rng]) => `<div class="bar-row" data-drill="size:${rng}" data-tip="${l}: ${v} txns"><span class="bar-lbl">${l}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(3, Math.round((v / szMax) * 100))}%;background:linear-gradient(90deg,#3a6ba8,var(--acc))"></span></span><span class="bar-val">${v}</span></div>`).join('')}</div>
    </div>

    <div class="tiles mb">
      <div class="card tile" data-drill="merch:${esc(d.biggest ? d.biggest.counterparty || '' : '')}"><div class="k">Biggest expense</div><div class="v">${d.biggest ? inr(d.biggest.amount) : '—'}</div><div class="t">${d.biggest ? esc(d.biggest.counterparty || '?') : ''}</div></div>
      <div class="card tile" data-drill="day:${esc(bigDay.day)}"><div class="k">Biggest day</div><div class="v">${inr(bigDay.s)}</div><div class="t">${esc(bigDay.day)}</div></div>
      <div class="card tile" data-drill="month"><div class="k">Avg transaction</div><div class="v">${inr(avgTxn)}</div><div class="t">${m.count} txns this month</div></div>
      <div class="card tile" data-drill="month"><div class="k">No-spend days</div><div class="v">${noSpend}<small style="font-size:13px;color:var(--muted)"> / ${m.daysSoFar}</small></div><div class="t">days without spending</div></div>
    </div>

    <div class="grid g3 mb">
      <div class="card" data-drill="credits"><h2>💰 Income <span class="r">recent</span></h2>${income}</div>
      <div class="card" data-drill="win:120"><h2>Subscriptions <span class="r">~${short(recur)}/mo</span></h2>${subs}</div>
      <div class="card" data-drill="win:30"><h2>By category <span class="r">bars</span></h2>${catBars}</div>
    </div>

    <div class="card" data-drill="win:120"><h2>Recent transactions</h2>${recent}</div>
  </div>
  <div class="hint">click any card, bar, or day to see the transactions · hover charts for details</div>
  <script>window.__D=${dataJson}</script>
  <script>${CLIENT_JS}</script>`;
  return page('Finance', body);
}

// Client interactivity (String.raw preserves regex backslashes; no backticks / ${} inside).
const CLIENT_JS = String.raw`(function(){
  var D=window.__D||{tx:[],today:''},tx=D.tx,TODAY=D.today;
  var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function p2(n){return (n<10?'0':'')+n;}
  function addD(s,dl){var a=s.split('-').map(Number);var t=new Date(Date.UTC(a[0],a[1]-1,a[2]+dl));return t.getUTCFullYear()+'-'+p2(t.getUTCMonth()+1)+'-'+p2(t.getUTCDate());}
  function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return c==='&'?'&amp;':c==='<'?'&lt;':'&gt;';});}
  function cap(s){return s?s.charAt(0).toUpperCase()+s.slice(1):s;}
  function monL(y){return MO[+y.slice(5,7)-1]+' '+y.slice(2,4);}
  function inr(n){var neg=n<0;n=Math.round(Math.abs(n)*100)/100;var f=n.toFixed(2),pt=f.split('.'),i=pt[0],l3=i.slice(-3),r=i.slice(0,-3).replace(/\B(?=(\d{2})+(?!\d))/g,',');return (neg?'-₹':'₹')+(r?r+','+l3:l3)+(pt[1]==='00'?'':'.'+pt[1]);}

  var tip=document.createElement('div');tip.className='tip';document.body.appendChild(tip);
  function tipFor(t){if(!t.closest)return null;var a=t.closest('[data-tip]');if(a)return a.getAttribute('data-tip');var s=t.closest('rect,circle');if(s&&s.querySelector){var ti=s.querySelector('title');if(ti)return ti.textContent;}return null;}
  document.addEventListener('mousemove',function(e){var t=tipFor(e.target);if(t){tip.textContent=t;tip.style.display='block';var w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.min(window.innerWidth-w-10,e.clientX+14)+'px';tip.style.top=Math.max(8,e.clientY-h-12)+'px';}else tip.style.display='none';});
  window.addEventListener('scroll',function(){tip.style.display='none';},true);

  var ov=document.createElement('div');ov.className='ov';
  ov.innerHTML='<div class="modal"><div class="mhead"><div><div class="mtitle"></div><div class="msub"></div></div><button class="mx" aria-label="close">✕</button></div><div class="mbody"></div></div>';
  document.body.appendChild(ov);
  function close(){ov.style.display='none';}
  ov.addEventListener('click',function(e){if(e.target===ov||e.target.classList.contains('mx'))close();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  function openM(title,sub,rows){
    rows=rows.slice().sort(function(a,b){return (b.d+(b.t||'')).localeCompare(a.d+(a.t||''));});
    var deb=0,cr=0;rows.forEach(function(r){if(r.dir==='c')cr+=r.a;else deb+=r.a;});
    ov.querySelector('.mtitle').textContent=title;
    ov.querySelector('.msub').innerHTML=esc(sub)+' · '+rows.length+' txns · <span style="color:var(--acc)">'+inr(deb)+'</span> out'+(cr>0?' · <span style="color:var(--green)">'+inr(cr)+'</span> in':'');
    ov.querySelector('.mbody').innerHTML=rows.slice(0,250).map(function(r){return '<div class="mrow"><span class="who"><span class="dot" style="background:'+(r.dir==='c'?'var(--green)':'var(--acc)')+'"></span>'+esc(r.m||'?')+'&nbsp;<span class="tag">'+esc([r.c,r.ch].filter(Boolean).join(' · '))+' · '+esc(r.d)+' '+esc(r.t||'')+'</span></span><span class="amt '+(r.dir==='c'?'pos':'')+'">'+(r.dir==='c'?'+':'−')+inr(r.a)+'</span></div>';}).join('')||'<div class="tag" style="padding:16px 0">no transactions in this range</div>';
    ov.style.display='flex';ov.querySelector('.mbody').scrollTop=0;
  }
  function within(days){var cut=addD(TODAY,-days+1);return tx.filter(function(r){return r.d>=cut;});}
  function drill(spec){
    var i=spec.indexOf(':'),k=i<0?spec:spec.slice(0,i),v=i<0?'':spec.slice(i+1),rows,title,sub;
    if(k==='win'){rows=within(+v).filter(function(r){return r.dir==='d';});title='Last '+v+' days';sub='spending';}
    else if(k==='month'){var y=TODAY.slice(0,7);rows=tx.filter(function(r){return r.d.slice(0,7)===y&&r.dir==='d';});title='This month';sub=monL(y);}
    else if(k==='monthall'){var y2=TODAY.slice(0,7);rows=tx.filter(function(r){return r.d.slice(0,7)===y2;});title='This month';sub='all activity';}
    else if(k==='credits'){rows=tx.filter(function(r){return r.dir==='c';});title='Income & credits';sub='last 120 days';}
    else if(k==='cat'){rows=within(30).filter(function(r){return r.c===v&&r.dir==='d';});title=cap(v);sub='last 30 days';}
    else if(k==='merch'){var lv=v.toLowerCase();rows=within(120).filter(function(r){return (r.m||'').toLowerCase().indexOf(lv)>=0;});title=v||'Merchant';sub='last 120 days';}
    else if(k==='day'){rows=tx.filter(function(r){return r.d===v;});title=v;sub='transactions';}
    else if(k==='ym'){rows=tx.filter(function(r){return r.d.slice(0,7)===v;});title=monL(v);sub='all transactions';}
    else if(k==='channel'){rows=within(30).filter(function(r){return r.ch===v&&r.dir==='d';});title=v+' payments';sub='last 30 days';}
    else if(k==='dow'){rows=within(91).filter(function(r){return r.dir==='d'&&new Date(r.d+'T00:00:00Z').getUTCDay()===+v;});title=WD[+v]+' spending';sub='last 13 weeks';}
    else if(k==='size'){var b=v.split(',').map(Number);rows=within(30).filter(function(r){return r.dir==='d'&&r.a>=b[0]&&(b[1]<0||r.a<b[1]);});title='Transactions '+(b[1]<0?'≥ ₹'+b[0]:'₹'+b[0]+'–'+b[1]);sub='last 30 days';}
    else {rows=tx.slice();title='All transactions';sub='last 120 days';}
    openM(title,sub,rows||[]);
  }
  document.addEventListener('click',function(e){var el=e.target.closest('[data-drill]');if(!el)return;e.preventDefault();drill(el.getAttribute('data-drill'));});

  // --- live: ticking clock + refresh-on-change (checked every second) ---
  function tick(){var d=new Date(),c=document.getElementById('clock');if(c)c.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(function(n){return (n<10?'0':'')+n;}).join(':');}
  tick();setInterval(tick,1000);
  try{var sy=sessionStorage.getItem('fa_sy');if(sy){window.scrollTo(0,+sy);sessionStorage.removeItem('fa_sy');}}catch(e){}
  var SIG=(D&&D.sig)||'';
  setInterval(function(){
    if(document.hidden||ov.style.display==='flex')return;
    fetch('/pulse',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(j&&j.sig&&j.sig!==SIG){try{sessionStorage.setItem('fa_sy',String(window.scrollY));}catch(e){}location.reload();}
    }).catch(function(){});
  },1000);
})();`;

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
