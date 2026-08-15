// dashboard.js — bold, colorful, glassy finance dashboard (inline CSS/SVG/JS,
// no external requests). Deep gradient backdrop + glassmorphism cards + vibrant
// teal/purple/pink accents + saturated gradient charts. Interactive: every card
// drills into a transaction modal; charts have hover tooltips; live auto-refresh.
import { inr, subAmount } from './timeutil.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// vibrant categorical order
const CAT = ['#2dd4bf', '#a78bfa', '#f472b6', '#60a5fa', '#fbbf24', '#34d399', '#fb923c', '#8b93b8'];
const HEAT = ['#191c33', '#0f4a53', '#12786b', '#1cae8f', '#2dd4bf'];
const C_SPEND = '#60a5fa', C_INCOME = '#34d399';

const CSS = `
:root{
  --text:#f3f5ff;--dim:#aab2d8;--muted:#727aa6;
  --teal:#2dd4bf;--purple:#a78bfa;--pink:#f472b6;--blue:#60a5fa;--amber:#fbbf24;--green:#34d399;--red:#fb7185;
  --glass:rgba(255,255,255,.05);--glass2:rgba(255,255,255,.028);--brd:rgba(255,255,255,.10);
}
*{box-sizing:border-box}
body{margin:0;color:var(--text);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;padding:28px 24px 90px;min-height:100vh;
  background:
    radial-gradient(1000px 620px at 6% -8%,rgba(45,212,191,.20),transparent 55%),
    radial-gradient(900px 640px at 98% 2%,rgba(167,139,250,.22),transparent 55%),
    radial-gradient(820px 560px at 52% 116%,rgba(244,114,182,.16),transparent 55%),
    linear-gradient(160deg,#0d1024,#150f2c 55%,#0c0a1e);
  background-attachment:fixed;}
.wrap{max-width:1160px;margin:0 auto}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.tnum{font-variant-numeric:tabular-nums}
a{color:var(--blue);text-decoration:none}

.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.brand{display:flex;align-items:center;gap:13px}
.brand .logo{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:22px;
  background:linear-gradient(145deg,rgba(45,212,191,.35),rgba(167,139,250,.35));border:1px solid var(--brd);
  box-shadow:0 6px 22px -6px rgba(167,139,250,.5)}
.brand h1{font-size:18px;margin:0;letter-spacing:-.01em;font-weight:700}
.brand .sub{color:var(--dim);font-size:12px;margin-top:2px}
.chips{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pill,.live{color:var(--dim);font-size:11.5px;border:1px solid var(--brd);border-radius:999px;padding:7px 13px;background:var(--glass);backdrop-filter:blur(12px)}
.rbtn{color:var(--dim);font:inherit;font-size:11.5px;font-weight:600;border:1px solid var(--brd);border-radius:999px;padding:7px 13px;background:var(--glass);backdrop-filter:blur(12px);cursor:pointer;transition:all .14s}
.rbtn:hover{color:var(--text);border-color:rgba(167,139,250,.55)}
.rbtn:disabled{opacity:.65;cursor:default}
.rbtn .sp{display:inline-block;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.live{display:flex;align-items:center;gap:8px}.live .ld{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green);animation:pulse 1.7s infinite}
.periods{display:flex;gap:9px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.periods .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-right:2px}
.pp{font-size:12.5px;color:var(--dim);border:1px solid var(--brd);border-radius:999px;padding:8px 17px;background:var(--glass);backdrop-filter:blur(12px);cursor:pointer;transition:all .14s;text-decoration:none;font-weight:600}
.pp:hover{color:var(--text);border-color:rgba(167,139,250,.45);transform:translateY(-1px)}
.pp.on{color:#0a0a1a;background:linear-gradient(120deg,var(--teal),var(--blue),var(--purple));border-color:transparent;box-shadow:0 8px 22px -6px rgba(96,165,250,.55)}
.live #clock{color:var(--text)}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,.6)}70%{box-shadow:0 0 0 8px rgba(52,211,153,0)}100%{box-shadow:0 0 0 0 rgba(52,211,153,0)}}

.card{position:relative;background:linear-gradient(180deg,var(--glass),var(--glass2));backdrop-filter:blur(24px) saturate(150%);
  -webkit-backdrop-filter:blur(24px) saturate(150%);border:1px solid var(--brd);border-radius:22px;padding:20px 22px;
  box-shadow:0 18px 50px -24px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.07);
  cursor:pointer;transition:transform .16s ease,box-shadow .16s,border-color .16s}
.card:hover{transform:translateY(-3px);border-color:rgba(167,139,250,.45);box-shadow:0 26px 60px -22px rgba(167,139,250,.32),inset 0 1px 0 rgba(255,255,255,.09)}
.card:active{transform:translateY(-1px)}
.card>h2{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);margin:0 0 18px;font-weight:700;display:flex;justify-content:space-between;align-items:center}
.card>h2 .r{color:var(--muted);letter-spacing:.02em;text-transform:none;font-weight:500}
.grid{display:grid;gap:18px}.g2{grid-template-columns:1fr 1fr}.g4{grid-template-columns:repeat(4,1fr)}.mb{margin-bottom:18px}
@media(max-width:880px){.g2{grid-template-columns:1fr}.g4{grid-template-columns:1fr 1fr}}

.hero{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:18px;margin-bottom:18px}
@media(max-width:880px){.hero{grid-template-columns:1fr}}
.k{color:var(--dim);font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;font-weight:700}
.hero-net{font-size:58px;line-height:1.0;font-weight:820;letter-spacing:-.04em;margin:12px 0 6px;
  background:linear-gradient(120deg,var(--teal),var(--blue) 45%,var(--purple));-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-net.neg{background:linear-gradient(120deg,#fb7185,#f472b6);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero-sub{color:var(--dim);font-size:12.5px}
.meter{height:10px;border-radius:7px;background:rgba(255,255,255,.07);overflow:hidden;margin-top:16px;border:1px solid var(--brd)}
.meter>span{display:block;height:100%;border-radius:7px;background:linear-gradient(90deg,var(--blue),var(--teal),var(--green));box-shadow:0 0 16px rgba(45,212,191,.5)}
.big{font-size:30px;font-weight:760;letter-spacing:-.03em;margin-top:8px}.big small{font-size:12px;color:var(--dim);font-weight:400;letter-spacing:0}
.big.tealtxt{color:var(--teal)}.big.greentxt{color:var(--green)}
.chip{margin-top:11px;font-size:12px;color:var(--dim)}.chip b{color:var(--text)}
.delta{font-size:12px;font-weight:700;display:inline-flex;gap:5px;align-items:center;margin-top:9px}
.up{color:var(--red)}.down{color:var(--green)}.pos{color:var(--green)}

.insbar{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:18px}
@media(max-width:880px){.insbar{grid-template-columns:1fr}}
.insight{background:linear-gradient(180deg,var(--glass),var(--glass2));backdrop-filter:blur(20px);border:1px solid var(--brd);border-radius:18px;padding:15px 17px;display:flex;gap:13px;align-items:flex-start}
.insight .ico{font-size:20px;line-height:1.2;filter:drop-shadow(0 2px 8px rgba(167,139,250,.5))}
.insight .tx{font-size:12.5px;color:var(--dim);line-height:1.45}.insight .tx b{color:var(--text);font-weight:700}

.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}@media(max-width:880px){.tiles{grid-template-columns:1fr 1fr}}
.tile .v{font-size:23px;font-weight:760;margin-top:6px;letter-spacing:-.02em}.tile .t{color:var(--muted);font-size:11.5px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.bar-row{display:grid;grid-template-columns:106px 1fr auto;align-items:center;gap:13px;padding:7px 8px;margin:0 -8px;border-radius:11px;cursor:pointer;transition:background .12s}
.bar-row:hover{background:rgba(255,255,255,.05)}
.bar-lbl{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar-lbl .n{color:var(--muted);font-size:10.5px}
.bar-track{height:11px;background:rgba(255,255,255,.06);border-radius:7px;overflow:hidden}
.bar-fill{height:100%;border-radius:7px;background:linear-gradient(90deg,var(--purple),var(--pink))}
.bar-val{font-size:12.5px;font-variant-numeric:tabular-nums}

.donutwrap{display:grid;grid-template-columns:172px 1fr;gap:20px;align-items:center}@media(max-width:520px){.donutwrap{grid-template-columns:1fr}}
.lg{display:flex;flex-direction:column;gap:10px}
.lg .it{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--dim);cursor:pointer;padding:3px 7px;margin:-3px -7px;border-radius:9px}
.lg .it:hover{background:rgba(255,255,255,.05)}.lg .sw{width:11px;height:11px;border-radius:4px;flex:none;box-shadow:0 0 10px currentColor}
.lg .it b{color:var(--text);font-weight:600}.lg .it .n{margin-left:auto;color:var(--text);font-variant-numeric:tabular-nums}

.row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 8px;margin:0 -8px;border-radius:11px;font-size:13px;border-bottom:1px solid var(--brd);cursor:pointer}
.row:hover{background:rgba(255,255,255,.05)}.row:last-child{border-bottom:0}
.row .amt{font-variant-numeric:tabular-nums;white-space:nowrap}.row .who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;min-width:0}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:9px;flex:none;box-shadow:0 0 8px currentColor}.tag{color:var(--muted);font-size:11px}

.svgw{width:100%;height:auto;display:block}
.heat-wrap{overflow-x:auto}.heat{height:auto;display:block;margin:2px auto}.heat rect{cursor:pointer}
.legrow{display:flex;align-items:center;gap:7px;margin-top:14px;font-size:11px;color:var(--muted)}.legrow .sw{width:14px;height:14px;border-radius:4px}
.chlegend{display:flex;gap:9px 16px;margin-top:14px;flex-wrap:wrap;font-size:11.5px;color:var(--dim)}.chlegend .it{display:flex;align-items:center;gap:7px}.chlegend .sw{width:11px;height:11px;border-radius:4px;box-shadow:0 0 9px currentColor}

.tip{position:fixed;z-index:80;pointer-events:none;display:none;background:rgba(18,16,38,.92);backdrop-filter:blur(12px);border:1px solid rgba(167,139,250,.4);border-radius:11px;padding:8px 11px;font-size:12px;color:var(--text);box-shadow:0 14px 40px -12px rgba(0,0,0,.9);max-width:250px;white-space:nowrap}
.ov{position:fixed;inset:0;z-index:70;display:none;background:rgba(8,6,22,.66);backdrop-filter:blur(6px);align-items:center;justify-content:center;padding:20px}
.modal{background:linear-gradient(180deg,rgba(30,26,58,.96),rgba(18,15,38,.97));backdrop-filter:blur(30px);border:1px solid rgba(167,139,250,.28);border-radius:22px;width:min(580px,96vw);max-height:84vh;display:flex;flex-direction:column;box-shadow:0 40px 100px -30px #000;overflow:hidden}
.mhead{display:flex;justify-content:space-between;align-items:flex-start;padding:20px 22px;border-bottom:1px solid var(--brd)}
.mtitle{font-size:18px;font-weight:740}.msub{color:var(--dim);font-size:12px;margin-top:5px}
.mx{width:32px;height:32px;border-radius:11px;background:rgba(255,255,255,.09);border:0;color:var(--text);font-size:13px;cursor:pointer;flex:none}
.mbody{overflow-y:auto;padding:6px 22px 20px}
.mrow{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--brd);font-size:13px}.mrow:last-child{border-bottom:0}
.mrow .amt{font-variant-numeric:tabular-nums;white-space:nowrap}.mrow .who{display:flex;align-items:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hint{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);font-size:11.5px;color:var(--dim);background:rgba(18,16,38,.8);backdrop-filter:blur(14px);border:1px solid var(--brd);padding:8px 16px;border-radius:999px;z-index:40}

form{max-width:340px;margin:16vh auto;text-align:center}
input{width:100%;padding:14px;border-radius:14px;border:1px solid var(--brd);background:var(--glass);color:var(--text);font-size:15px;margin:14px 0;backdrop-filter:blur(12px)}
button{width:100%;padding:14px;border-radius:14px;border:0;background:linear-gradient(120deg,var(--teal),var(--blue),var(--purple));color:#0a0a1a;font-weight:750;font-size:15px;cursor:pointer;box-shadow:0 10px 30px -8px rgba(96,165,250,.5)}
.err{color:var(--red);font-size:13px}
`;

// ---- helpers ---------------------------------------------------------------
const p2 = (n) => String(n).padStart(2, '0');
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };
function addDays(s, d) { const [y, m, dd] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, dd + d)); return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`; }
const dow = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
const dayIdx = (s) => { const [y, m, d] = s.split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monLabel = (ym) => `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`;
function short(n) { n = Math.round(Math.abs(n)); if (n >= 1e7) return (n / 1e7).toFixed(n >= 1e8 ? 0 : 1) + 'Cr'; if (n >= 1e5) return (n / 1e5).toFixed(n >= 1e6 ? 0 : 1) + 'L'; if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k'; return String(n); }
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
const quantile = (a, q) => (a.length ? a[Math.min(a.length - 1, Math.floor(q * a.length))] : 0);

// ---- charts ----------------------------------------------------------------
function sparkline(vals, w = 260, h = 50) {
  const max = Math.max(1, ...vals), n = vals.length, x = (i) => (i / (n - 1)) * w, y = (v) => h - 2 - (v / max) * (h - 5);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  return `<svg class="svgw" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C_SPEND}" stop-opacity=".45"/><stop offset="1" stop-color="${C_SPEND}" stop-opacity="0"/></linearGradient></defs><path d="M0,${h} L${pts.join(' L')} L${w},${h} Z" fill="url(#spk)"/><path d="M${pts.join(' L')}" fill="none" stroke="${C_SPEND}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

// area trend (gradient fill + glowing line) over N days
function trend(map, today, n = 60) {
  const days = []; for (let i = n - 1; i >= 0; i--) days.push(addDays(today, -i));
  const vals = days.map((d) => map[d] || 0);
  const W = 780, H = 230, L = 46, R = 16, T = 18, B = 26, pw = W - L - R, ph = H - T - B, ymax = niceMax(Math.max(1, ...vals));
  const X = (i) => L + (i / (days.length - 1)) * pw, Y = (v) => T + ph - (v / ymax) * ph;
  const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  let grid = ''; for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy.toFixed(1)}" x2="${W - R}" y2="${gy.toFixed(1)}" stroke="rgba(255,255,255,.08)"/><text x="${L - 9}" y="${(gy + 3.5).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="10.5" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  const peak = vals.indexOf(Math.max(...vals));
  let dots = '';
  vals.forEach((v, i) => { if (v > 0) dots += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="7" fill="transparent" data-drill="day:${days[i]}"><title>${days[i]}: ${inr(v)}</title></circle>`; });
  let xlab = ''; days.forEach((d, i) => { if (d.slice(8) === '01' || i === 0) xlab += `<text x="${X(i).toFixed(1)}" y="${H - 7}" text-anchor="middle" fill="var(--muted)" font-size="10.5">${MON[Number(d.slice(5, 7)) - 1]}</text>`; });
  const plab = vals[peak] > 0 ? `<circle cx="${X(peak).toFixed(1)}" cy="${Y(vals[peak]).toFixed(1)}" r="4.5" fill="${C_SPEND}" stroke="#141033" stroke-width="2"/><text x="${X(peak).toFixed(1)}" y="${Math.max(Y(vals[peak]) - 11, 12).toFixed(1)}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="700" class="tnum">${short(vals[peak])}</text>` : '';
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily spend, last 60 days"><defs><linearGradient id="trd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C_SPEND}" stop-opacity=".38"/><stop offset="1" stop-color="${C_SPEND}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="M${L},${T + ph} L${pts.join(' L')} L${W - R},${T + ph} Z" fill="url(#trd)"/><path d="M${pts.join(' L')}" fill="none" stroke="${C_SPEND}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round" style="filter:drop-shadow(0 3px 10px rgba(96,165,250,.55))"/>${plab}${dots}${xlab}</svg>`;
}

function monthlyBars(months) {
  const data = months.slice(-6), W = 780, H = 220, L = 46, R = 16, T = 18, B = 28, pw = W - L - R, ph = H - T - B;
  const ymax = niceMax(Math.max(1, ...data.flatMap((m) => [m.debit, m.credit]))), gw = pw / data.length, bw = Math.min((gw - 16) / 2, 28);
  let grid = ''; for (const g of [0, 0.5, 1]) { const gy = T + ph - g * ph; grid += `<line x1="${L}" y1="${gy}" x2="${W - R}" y2="${gy}" stroke="rgba(255,255,255,.08)"/><text x="${L - 9}" y="${gy + 3.5}" text-anchor="end" fill="var(--muted)" font-size="10.5" class="tnum">${g ? short(ymax * g) : '0'}</text>`; }
  let bars = '', xl = '';
  data.forEach((m, i) => { const cx = L + i * gw + gw / 2, hx = cx - bw - 3, ix = cx + 3, hs = Math.max(m.debit > 0 ? 3 : 0, (m.debit / ymax) * ph), hi = Math.max(m.credit > 0 ? 3 : 0, (m.credit / ymax) * ph);
    if (hs) bars += `<rect data-drill="ym:${m.ym}" x="${hx.toFixed(1)}" y="${(T + ph - hs).toFixed(1)}" width="${bw.toFixed(1)}" height="${hs.toFixed(1)}" rx="6" fill="url(#gsp)"><title>${monLabel(m.ym)} spent ${inr(m.debit)}</title></rect>`;
    if (hi) bars += `<rect data-drill="ym:${m.ym}" x="${ix.toFixed(1)}" y="${(T + ph - hi).toFixed(1)}" width="${bw.toFixed(1)}" height="${hi.toFixed(1)}" rx="6" fill="url(#gin)"><title>${monLabel(m.ym)} income ${inr(m.credit)}</title></rect>`;
    xl += `<text x="${cx.toFixed(1)}" y="${H - 9}" text-anchor="middle" fill="var(--muted)" font-size="11">${monLabel(m.ym)}</text>`; });
  return `<svg class="svgw" viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly income vs spend"><defs><linearGradient id="gsp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#818cf8"/><stop offset="1" stop-color="#60a5fa"/></linearGradient><linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#34d399"/></linearGradient></defs>${grid}${bars}${xl}</svg><div class="chlegend"><span class="it" style="color:${C_SPEND}"><span class="sw" style="background:${C_SPEND};color:${C_SPEND}"></span>spent</span><span class="it" style="color:${C_INCOME}"><span class="sw" style="background:${C_INCOME};color:${C_INCOME}"></span>income</span></div>`;
}

function donut(segs, total) {
  const size = 170, w = 27, r = (size - w) / 2, C = 2 * Math.PI * r, cx = size / 2; let off = 0, rings = '';
  segs.forEach((s) => { const f = total > 0 ? s.value / total : 0, len = Math.max(0, f * C - 3); rings += `<circle ${s.drill ? `data-drill="${s.drill}"` : ''} cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${w}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" stroke-dashoffset="${(-off * C).toFixed(1)}" transform="rotate(-90 ${cx} ${cx})" style="filter:drop-shadow(0 0 6px ${s.color}88)"><title>${esc(s.label)}: ${inr(s.value)}</title></circle>`; off += f; });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Category breakdown">${rings}<text x="${cx}" y="${cx - 5}" text-anchor="middle" fill="var(--dim)" font-size="10" letter-spacing=".06em" pointer-events="none">SPENT</text><text x="${cx}" y="${cx + 16}" text-anchor="middle" fill="var(--text)" font-size="18" font-weight="760" class="tnum" pointer-events="none">${short(total)}</text></svg>`;
}

function hbars(rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return rows.map((r) => `<div class="bar-row" ${r.drill ? `data-drill="${esc(r.drill)}"` : ''} data-tip="${esc(r.label)}: ${inr(r.value)}"><span class="bar-lbl">${esc(r.label)}${r.n ? ` <span class="n">${esc(r.n)}</span>` : ''}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(4, Math.round((r.value / max) * 100))}%"></span></span><span class="bar-val">${inr(r.value)}</span></div>`).join('') || '<div class="tag">no data</div>';
}

// ---- page ------------------------------------------------------------------
export function renderDashboard(d) {
  const today = d.generatedIst, m = d.period, days = d.days;
  const map = {}; for (const r of d.dailyDebit) map[r.day_ist] = r.s;
  const perDay = m.perDay, avgTxn = m.count ? m.spent / m.count : 0;
  const momPct = m.prevSpent > 0 ? Math.round((m.spent / m.prevSpent - 1) * 100) : null;
  const recur = d.subs.reduce((a, s) => a + (s.currency === 'INR' ? s.amount : s.amount * 99.4024), 0);
  const spark30 = []; for (let i = 29; i >= 0; i--) spark30.push(map[addDays(today, -i)] || 0);
  const plabel = m.label, pshort = days >= 3650 ? 'all' : days === 365 ? '1y' : days + 'd';
  const prevLabel = days >= 3650 ? 'period' : `previous ${days} days`;
  // biggest day + no-spend over the period (bounded by available daily data)
  const winN = Math.min(days, 365), periodDays = [];
  for (let i = winN - 1; i >= 0; i--) periodDays.push(addDays(today, -i));
  let bigDay = { day: '—', s: 0 }; for (const k of periodDays) if ((map[k] || 0) > bigDay.s) bigDay = { day: k, s: map[k] };
  const noSpend = Math.max(0, periodDays.length - periodDays.filter((k) => map[k] > 0).length);
  const periodPills = '<span class="lbl">period</span>' + d.periods.map((p) => `<a href="/?d=${p}" class="pp${p === days ? ' on' : ''}">${p >= 3650 ? 'All' : p === 365 ? '1y' : p + 'd'}</a>`).join('');

  const catsAll = d.categories, catTot = catsAll.reduce((a, c) => a + c.s, 0), top7 = catsAll.slice(0, 7);
  const topShare = catTot > 0 && catsAll[0] ? Math.round((catsAll[0].s / catTot) * 100) : 0;
  const otherVal = catsAll.slice(7).reduce((a, c) => a + c.s, 0);
  const segs = top7.map((c, i) => ({ label: c.category, value: c.s, color: CAT[i], drill: `cat:${c.category}` }));
  if (otherVal > 0) segs.push({ label: 'other', value: otherVal, color: CAT[7] });

  // heatmap (13 weeks, teal ramp)
  const hmStart = addDays(today, -(12 * 7 + dow(today))), hmDays = []; for (let dd = hmStart; dd <= today; dd = addDays(dd, 1)) hmDays.push(dd);
  const hnz = hmDays.map((k) => map[k] || 0).filter((v) => v > 0).sort((a, b) => a - b), cap90 = quantile(hnz, 0.9) || 1;
  const hlvl = (v) => (v <= 0 ? 0 : Math.max(1, Math.min(4, 1 + Math.floor(Math.sqrt(v / cap90) * 3.999))));
  const CELL = 15, GAP = 4.5, COL = CELL + GAP, LL = 26, TT = 15, weeks = Math.ceil((dayIdx(today) - dayIdx(hmStart) + 1) / 7);
  const hW = LL + weeks * COL, hH = TT + 7 * COL; let cells = '', mlab = '', lastMo = '';
  hmDays.forEach((dd) => { const wk = Math.floor((dayIdx(dd) - dayIdx(hmStart)) / 7), wd = dow(dd), x = LL + wk * COL, y = TT + wd * COL, v = map[dd] || 0;
    cells += `<rect data-drill="day:${dd}" x="${x}" y="${y}" width="${CELL}" height="${CELL}" rx="4" fill="${HEAT[hlvl(v)]}"${hlvl(v) >= 3 ? ' style="filter:drop-shadow(0 0 4px #2dd4bf88)"' : ''}><title>${dd}: ${v > 0 ? inr(v) : 'no spend'}</title></rect>`;
    if (wd === 0) { const mo = MON[Number(dd.slice(5, 7)) - 1]; if (mo !== lastMo) { mlab += `<text x="${x}" y="${TT - 4}" fill="var(--muted)" font-size="10" pointer-events="none">${mo}</text>`; lastMo = mo; } } });
  let wl = ''; [['M', 1], ['W', 3], ['F', 5]].forEach(([t, r]) => { wl += `<text x="4" y="${TT + r * COL + CELL - 3}" fill="var(--muted)" font-size="9.5" pointer-events="none">${t}</text>`; });
  const heat = `<div class="heat-wrap"><svg class="heat" viewBox="0 0 ${hW} ${hH}" width="${hW}" height="${hH}" role="img" aria-label="Spending calendar">${mlab}${wl}${cells}</svg></div>`;

  const merchBars = hbars(d.top.map((t) => ({ label: t.counterparty, n: t.category || '', value: t.s, drill: `merch:${t.counterparty}` })));
  const income = (d.income_list || []).map((t) => `<div class="row" data-drill="merch:${esc(t.counterparty || '')}"><span class="who"><span class="dot" style="color:var(--green);background:var(--green)"></span>${esc(t.counterparty || '?')}&nbsp;<span class="tag">${esc((t.channel || '') + ' · ' + t.ts_ist.slice(0, 10))}</span></span><span class="amt pos">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no credits</div>';
  const subs = d.subs.map((s) => `<div class="row" data-drill="merch:${esc(s.merchant)}"><span class="who">${esc(s.merchant)}</span><span class="amt">${esc(subAmount(s.currency, s.amount))}</span></div>`).join('') || '<div class="tag">none</div>';
  const recent = d.recent.map((t) => `<div class="row" data-drill="merch:${esc(t.counterparty || '')}"><span class="who"><span class="dot" style="color:${t.direction === 'credit' ? 'var(--green)' : 'var(--blue)'};background:${t.direction === 'credit' ? 'var(--green)' : 'var(--blue)'}"></span>${esc(t.counterparty || '?')}&nbsp;<span class="tag">${esc(t.ts_ist.slice(5, 16))}</span></span><span class="amt${t.direction === 'credit' ? ' pos' : ''}">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no data</div>';
  const donutLegend = segs.map((s) => `<div class="it" ${s.drill ? `data-drill="${s.drill}"` : ''}><span class="sw" style="background:${s.color};color:${s.color}"></span><b>${esc(s.label)}</b><span class="n">${short(s.value)} · ${Math.round((s.value / catTot) * 100)}%</span></div>`).join('');

  const STAT = { paid: ['var(--green)', 'paid'], 'due-soon': ['var(--amber)', 'due soon'], overdue: ['var(--red)', 'OVERDUE'], upcoming: ['var(--dim)', 'upcoming'] };
  const billsCard = (d.bills || []).map((bl) => {
    const [col, lbl] = STAT[bl.status] || STAT.upcoming;
    const right = bl.status === 'paid' ? `✓ ${bl.paidOn ? bl.paidOn.slice(5) : 'paid'}`
      : bl.status === 'overdue' ? `${-bl.daysUntil}d late`
      : bl.status === 'due-soon' ? (bl.daysUntil === 0 ? 'today' : `in ${bl.daysUntil}d`)
      : `${bl.due_day}${ord(bl.due_day)}`;
    return `<div class="row" data-drill="merch:${esc(bl.name)}"><span class="who"><span class="dot" style="background:${col};color:${col}"></span>${esc(bl.name)} <span class="tag">${bl.amount ? inr(bl.amount) : ''} · ${lbl}</span></span><span class="amt" style="color:${col}">${right}</span></div>`;
  }).join('') || '<div class="tag">no bills tracked yet — add one in chat: <b>add bill rent 16000 due 9</b></div>';

  const ins = [];
  if (momPct !== null) ins.push([momPct >= 0 ? '📈' : '📉', `Spent <b>${inr(m.spent)}</b> — <b>${Math.abs(momPct)}% ${momPct >= 0 ? 'more' : 'less'}</b> than the ${prevLabel}.`]);
  if (catsAll[0]) ins.push(['🏷️', `<b>${cap(catsAll[0].category)}</b> is your top category — <b>${topShare}%</b> of ${plabel} spend.`]);
  if (m.rate !== null) ins.push([m.rate >= 0 ? '💰' : '⚠️', `You kept <b>${m.rate}%</b> of income — <b>${inr(m.net)}</b> net over the ${plabel}.`]);
  else ins.push(['📊', `Averaging <b>${inr(perDay)}</b>/day over the ${plabel}.`]);
  const insightCards = ins.slice(0, 3).map((x) => `<div class="insight"><span class="ico">${x[0]}</span><span class="tx">${x[1]}</span></div>`).join('');
  const momTag = momPct === null ? '' : `<span class="delta ${momPct >= 0 ? 'up' : 'down'}">${momPct >= 0 ? '▲' : '▼'} ${Math.abs(momPct)}% vs ${prevLabel}</span>`;

  const dataJson = JSON.stringify({ tx: d.tx || [], today, sig: d.sig || '' }).replace(/</g, '\\u003c');

  const body = `<div class="wrap">
    <div class="head">
      <div class="brand"><div class="logo">💸</div><div><h1>Finance</h1><div class="sub">${esc(today)} · <span class="mono">${esc(plabel)}</span></div></div></div>
      <div class="chips"><div class="live"><span class="ld"></span>live · <span id="clock" class="tnum">--:--:--</span></div><button id="refresh" class="rbtn" title="Scan email + SMS right now">⟳ Refresh</button><div class="pill">₹ · click to drill in</div></div>
    </div>

    <div class="periods">${periodPills}</div>

    <div class="hero">
      <div class="card" data-drill="win:${days}">
        <div class="k">Net · ${esc(plabel)}</div>
        <div class="hero-net ${m.net >= 0 ? '' : 'neg'}">${inr(m.net)}</div>
        <div class="hero-sub">${m.rate !== null ? `${m.rate}% of ₹${short(m.income)} income kept` : 'income − spend'}</div>
        ${m.rate !== null ? `<div class="meter"><span style="width:${Math.max(2, Math.min(100, m.rate))}%"></span></div>` : ''}
        <div style="margin-top:16px">${sparkline(spark30)}</div><div class="chip" style="margin-top:2px">30-day spend trend</div>
      </div>
      <div class="card" data-drill="win:${days}">
        <div class="k">Spent · ${esc(plabel)}</div>
        <div class="big">${inr(m.spent)} <small>· ${m.count} txns</small></div>${momTag}
        <div class="chip">Avg <b>${inr(perDay)}</b>/day · biggest <b>${inr(d.biggest ? d.biggest.amount : 0)}</b></div>
      </div>
      <div class="card" data-drill="credits">
        <div class="k">Income · ${esc(plabel)}</div>
        <div class="big greentxt">${inr(m.income)}</div>
        <div class="chip" style="margin-top:14px">Recurring subs ~<b>${inr(recur)}</b>/mo</div>
        <div class="chip">≈ <b>${inr(recur * 12)}</b>/yr committed</div>
      </div>
    </div>

    <div class="insbar">${insightCards}</div>

    <div class="card mb" data-drill="win:${d.trendDays}"><h2>Daily spend <span class="r">last ${d.trendDays} days</span></h2>${trend(map, today, d.trendDays)}</div>

    <div class="grid g2 mb">
      <div class="card" data-drill="win:${days}"><h2>By category <span class="r">${esc(plabel)}</span></h2><div class="donutwrap">${donut(segs, catTot)}<div class="lg">${donutLegend}</div></div></div>
      <div class="card" data-drill="win:${days}"><h2>Top merchants <span class="r">${esc(plabel)}</span></h2>${merchBars}</div>
    </div>

    <div class="grid g2 mb">
      <div class="card" data-drill="all"><h2>Income vs spend <span class="r">6 months</span></h2>${monthlyBars(d.monthly)}</div>
      <div class="card" data-drill="win:91"><h2>Spending calendar <span class="r">13 weeks</span></h2>${heat}<div class="legrow"><span>less</span>${HEAT.map((c) => `<span class="sw" style="background:${c}"></span>`).join('')}<span>more</span></div></div>
    </div>

    <div class="tiles mb">
      <div class="card tile" data-drill="merch:${esc(d.biggest ? d.biggest.counterparty || '' : '')}"><div class="k">Biggest expense</div><div class="v" style="color:var(--pink)">${d.biggest ? inr(d.biggest.amount) : '—'}</div><div class="t">${d.biggest ? esc(d.biggest.counterparty || '?') : ''}</div></div>
      <div class="card tile" data-drill="day:${esc(bigDay.day)}"><div class="k">Biggest day</div><div class="v" style="color:var(--purple)">${inr(bigDay.s)}</div><div class="t">${esc(bigDay.day)}</div></div>
      <div class="card tile" data-drill="win:${days}"><div class="k">Avg transaction</div><div class="v" style="color:var(--blue)">${inr(avgTxn)}</div><div class="t">${m.count} txns · ${esc(plabel)}</div></div>
      <div class="card tile" data-drill="win:${days}"><div class="k">No-spend days</div><div class="v" style="color:var(--teal)">${noSpend}<small style="font-size:13px;color:var(--muted)"> / ${periodDays.length}</small></div><div class="t">days without spending</div></div>
    </div>

    <div class="grid g2 mb">
      <div class="card"><h2>🧾 Bills &amp; due dates <span class="r">this month</span></h2>${billsCard}</div>
      <div class="card" data-drill="win:120"><h2>Subscriptions <span class="r">~${short(recur)}/mo</span></h2>${subs}</div>
    </div>

    <div class="grid g2 mb">
      <div class="card" data-drill="credits"><h2>💰 Income <span class="r">recent</span></h2>${income}</div>
      <div class="card" data-drill="win:120"><h2>Recent transactions</h2>${recent}</div>
    </div>
  </div>
  <div class="hint">click any card, bar or day to see the transactions · hover charts for details</div>
  <script>window.__D=${dataJson}</script>
  <script>${CLIENT_JS}</script>`;
  return page('Finance', body);
}

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
    ov.querySelector('.msub').innerHTML=esc(sub)+' · '+rows.length+' txns · <span style="color:var(--blue)">'+inr(deb)+'</span> out'+(cr>0?' · <span style="color:var(--green)">'+inr(cr)+'</span> in':'');
    ov.querySelector('.mbody').innerHTML=rows.slice(0,250).map(function(r){return '<div class="mrow"><span class="who"><span class="dot" style="background:'+(r.dir==='c'?'var(--green)':'var(--blue)')+'"></span>'+esc(r.m||'?')+'&nbsp;<span class="tag">'+esc([r.c,r.ch].filter(Boolean).join(' · '))+' · '+esc(r.d)+' '+esc(r.t||'')+'</span></span><span class="amt '+(r.dir==='c'?'pos':'')+'">'+(r.dir==='c'?'+':'−')+inr(r.a)+'</span></div>';}).join('')||'<div class="tag" style="padding:16px 0">no transactions in this range</div>';
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
    else {rows=tx.slice();title='All transactions';sub='last 120 days';}
    openM(title,sub,rows||[]);
  }
  document.addEventListener('click',function(e){var el=e.target.closest('[data-drill]');if(!el)return;e.preventDefault();drill(el.getAttribute('data-drill'));});
  function tick(){var d=new Date(),c=document.getElementById('clock');if(c)c.textContent=[d.getHours(),d.getMinutes(),d.getSeconds()].map(function(n){return (n<10?'0':'')+n;}).join(':');}
  tick();setInterval(tick,1000);
  try{var sy=sessionStorage.getItem('fa_sy');if(sy){window.scrollTo(0,+sy);sessionStorage.removeItem('fa_sy');}}catch(e){}
  var SIG=(D&&D.sig)||'';
  var rb=document.getElementById('refresh');
  if(rb)rb.addEventListener('click',function(){
    if(rb.disabled)return;rb.disabled=true;rb.innerHTML='<span class="sp">⟳</span> Scanning…';
    fetch('/refresh',{method:'POST',cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){
      if(j&&j.sig&&j.sig!==SIG){try{sessionStorage.setItem('fa_sy',String(window.scrollY));}catch(e){}location.reload();return;}
      rb.textContent=(j&&j.inserted)?('+'+j.inserted+' new'):'✓ Up to date';
      setTimeout(function(){rb.textContent='⟳ Refresh';rb.disabled=false;},1800);
    }).catch(function(){rb.textContent='⟳ Refresh';rb.disabled=false;});
  });
  setInterval(function(){if(document.hidden||ov.style.display==='flex')return;fetch('/pulse',{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(j){if(j&&j.sig&&j.sig!==SIG){try{sessionStorage.setItem('fa_sy',String(window.scrollY));}catch(e){}location.reload();}}).catch(function(){});},1000);
})();`;

export function renderLogin(error = '') {
  return page('Finance', `<form method="POST" action="/">
    <div class="brand" style="justify-content:center;margin-bottom:8px"><div class="logo">💸</div></div>
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
