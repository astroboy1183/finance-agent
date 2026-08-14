// dashboard.js — self-contained HTML (inline CSS, no external requests).
// Engineer-dark theme to match jayanthappalla.com. All numbers precomputed by
// the caller from ledger SQL.
import { inr } from './timeutil.js';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CSS = `
:root{--bg:#07090c;--card:#11151c;--card2:#151b23;--line:#1e2530;--text:#e6edf3;--dim:#93a1b0;--blue:#58a6ff;--green:#3fb950;--amber:#d29922;--violet:#bc8cff;--red:#f85149}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:24px}
a{color:var(--blue)}.wrap{max-width:1000px;margin:0 auto}
h1{font-size:20px;margin:0 0 2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.sub{color:var(--dim);font-size:13px;margin-bottom:20px}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.grid{display:grid;gap:14px}
.win{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.card{background:linear-gradient(180deg,var(--card),var(--card2));border:1px solid var(--line);border-radius:12px;padding:16px}
.k{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.v{font-size:22px;font-weight:600;margin-top:4px;font-family:ui-monospace,monospace}
.v small{font-size:12px;color:var(--dim);font-weight:400}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
@media(max-width:720px){.cols{grid-template-columns:1fr}}
.card h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--dim);margin:0 0 12px}
.row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px}
.row:last-child{border-bottom:0}.row .amt{font-family:ui-monospace,monospace}
.bar{height:6px;border-radius:3px;background:var(--blue);margin-top:4px}
.spark{display:flex;align-items:flex-end;gap:2px;height:60px;margin-top:8px}
.spark span{flex:1;background:var(--blue);border-radius:2px 2px 0 0;min-height:2px;opacity:.85}
.tag{font-size:11px;color:var(--dim)}
.net-pos{color:var(--green)}.net-neg{color:var(--red)}
form{max-width:340px;margin:12vh auto;text-align:center}
input{width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:15px;margin:10px 0}
button{width:100%;padding:12px;border-radius:10px;border:0;background:var(--blue);color:#04121f;font-weight:600;font-size:15px;cursor:pointer}
.err{color:var(--red);font-size:13px}
`;

const WIN_COLORS = { 7: 'var(--green)', 10: 'var(--blue)', 20: 'var(--violet)', 30: 'var(--amber)', 100: 'var(--dim)' };

export function renderLogin(error = '') {
  return page('Finance', `<form method="POST" action="/">
    <h1 class="mono">finance-agent</h1>
    <p class="sub">enter passphrase</p>
    <input type="password" name="pass" placeholder="passphrase" autofocus autocomplete="current-password"/>
    ${error ? `<p class="err">${esc(error)}</p>` : ''}
    <button type="submit">unlock</button>
  </form>`);
}

export function renderDashboard(d) {
  const maxCat = Math.max(1, ...d.categories.map((c) => c.s));
  const maxDay = Math.max(1, ...d.daily.map((x) => x.s));
  const winCards = d.windows.map((w) => `
    <div class="card">
      <div class="k">last ${w.days} days</div>
      <div class="v">${inr(w.total)}</div>
      <div class="tag">${w.count} txns · ${inr(w.days ? w.total / w.days : 0)}/day</div>
      <div class="bar" style="background:${WIN_COLORS[w.days] || 'var(--blue)'};width:100%"></div>
    </div>`).join('');

  const cats = d.categories.map((c) => `
    <div class="row"><span>${esc(c.category)} <span class="tag">(${c.c})</span></span><span class="amt">${inr(c.s)}</span></div>
    <div class="bar" style="width:${Math.round((c.s / maxCat) * 100)}%"></div>`).join('') || '<div class="tag">no data</div>';

  const top = d.top.map((t) => `<div class="row"><span>${esc(t.counterparty)} <span class="tag">${esc(t.category || '')}</span></span><span class="amt">${inr(t.s)}</span></div>`).join('') || '<div class="tag">no data</div>';
  const recent = d.recent.map((t) => `<div class="row"><span>${t.direction === 'credit' ? '➕' : '➖'} ${esc(t.counterparty || '?')} <span class="tag">${esc(t.ts_ist.slice(0, 16))}</span></span><span class="amt">${inr(t.amount)}</span></div>`).join('') || '<div class="tag">no data</div>';
  const spark = d.daily.map((x) => `<span title="${esc(x.day_ist)}: ${inr(x.s)}" style="height:${Math.round((x.s / maxDay) * 100)}%"></span>`).join('');
  const subs = d.subs.map((s) => `<div class="row"><span>${esc(s.merchant)}</span><span class="amt">${s.currency === 'INR' ? inr(s.amount) : esc(s.currency) + ' ' + esc(s.amount)}</span></div>`).join('') || '<div class="tag">none detected</div>';

  const netCls = d.month.net >= 0 ? 'net-pos' : 'net-neg';
  const body = `<div class="wrap">
    <h1 class="mono">💰 finance-agent</h1>
    <div class="sub">as of ${esc(d.generatedIst)} IST · <span class="mono">${esc(d.month.label)}</span></div>

    <div class="grid win">${winCards}</div>

    <div class="cols">
      <div class="card">
        <h2>This month</h2>
        <div class="row"><span>Spent</span><span class="amt">${inr(d.month.spent)}</span></div>
        <div class="row"><span>Income</span><span class="amt">${inr(d.month.income)}</span></div>
        <div class="row"><span>Net</span><span class="amt ${netCls}">${inr(d.month.net)}${d.month.rate !== null ? ` <span class="tag">(${d.month.rate}% saved)</span>` : ''}</span></div>
        <h2 style="margin-top:16px">Daily spend · last 30d</h2>
        <div class="spark">${spark}</div>
      </div>
      <div class="card"><h2>Category breakdown · 30d</h2>${cats}</div>
    </div>

    <div class="cols">
      <div class="card"><h2>Top merchants · 30d</h2>${top}</div>
      <div class="card"><h2>Recent transactions</h2>${recent}</div>
    </div>

    <div class="cols">
      <div class="card"><h2>Subscriptions</h2>${subs}</div>
      <div class="card"><h2>About</h2><p class="tag">Fed by Axis Bank + UPI email alerts. Card AutoPays (incl. USD) are tracked as subscriptions, not counted in INR spend. Ask the Slack bot anything, or log cash with “add 200 cash lunch”.</p></div>
    </div>
  </div>`;
  return page('finance-agent', body);
}

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${esc(title)}</title><style>${CSS}</style></head><body>${inner}</body></html>`;
}
