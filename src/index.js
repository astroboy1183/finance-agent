// index.js — Worker entry. fetch() serves the dashboard, Slack events and admin
// endpoints; scheduled() dispatches the cron jobs by their schedule.
import { ingest } from './ingest.js';
import { handleSms } from './sms.js';
import { checkBills, billsStatus } from './bills.js';
import { recentRawSms } from './ledger.js';
import { morningReport, weeklyReport, monthlyReport } from './reports.js';
import { handleSlackEvent } from './chat.js';
import { verifySlack } from './slack.js';
import { renderDashboard, renderLogin } from './dashboard.js';
import {
  sumAmount, byCategory, topMerchants, listTxns, dailyTotals, listSubscriptions,
  getMeta, alertOnce, biggestDebit, monthlyTotals, channelSplit, upiTypeSplit, sizeBuckets, dataSignature,
} from './ledger.js';
import { thisMonth, prevMonth, lastDays, istDay, nowEpoch, daysInMonthSoFar } from './timeutil.js';

const PERIODS = [7, 30, 60, 100, 365, 3650];   // selectable day-windows ('All' = 3650)
const periodLabel = (d) => (d >= 3650 ? 'all time' : d === 365 ? 'last 12 months' : `last ${d} days`);

// ---- dashboard auth (cookie = sha256(pass|salt)) ----------------------------
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const cookieToken = (env) => sha256Hex(`${env.DASH_PASS}|finance-agent|v1`);
function getCookie(req, name) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

async function buildDashboardData(env, days) {
  const db = env.DB, now = nowEpoch();
  const cur = lastDays(days, now);                       // current period
  const prevFrom = now - 2 * days * 86400, prevTo = cur.from;  // previous same-length period
  const spentAgg = await sumAmount(db, { from: cur.from, to: cur.to, direction: 'debit' });
  const income = (await sumAmount(db, { from: cur.from, to: cur.to, direction: 'credit' })).sum;
  const spent = spentAgg.sum, net = income - spent;
  const rate = income > 0 ? Math.round((net / income) * 100) : null;
  const prevSpent = (await sumAmount(db, { from: prevFrom, to: prevTo, direction: 'debit' })).sum;
  const trendDays = Math.min(days, 366);
  const span = lastDays(Math.max(trendDays, 91), now);   // daily data for trend + heatmap
  const dataTxDays = Math.max(days, 120);
  return {
    now, generatedIst: istDay(now), sig: await dataSignature(db),
    days, periods: PERIODS, trendDays,
    period: { label: periodLabel(days), spent, income, net, rate, count: spentAgg.count, prevSpent, perDay: days ? spent / days : 0 },
    biggest: await biggestDebit(db, { from: cur.from, to: cur.to }),
    categories: (await byCategory(db, { from: cur.from, to: cur.to, direction: 'debit' })).filter((c) => c.category !== 'income'),
    top: await topMerchants(db, { from: cur.from, to: cur.to, limit: 7 }),
    recent: await listTxns(db, { from: lastDays(120, now).from, to: now + 1, limit: 10 }),
    dailyDebit: await dailyTotals(db, { from: span.from, to: now + 1, direction: 'debit' }),
    subs: await listSubscriptions(db),
    bills: await billsStatus(env),
    income_list: await listTxns(db, { from: lastDays(120, now).from, to: now + 1, direction: 'credit', limit: 6 }),
    monthly: await monthlyTotals(db, { from: lastDays(200, now).from, to: now + 1 }),
    tx: (await listTxns(db, { from: lastDays(dataTxDays, now).from, to: now + 1, limit: 1200 })).map((t) => ({
      d: t.day_ist, t: t.ts_ist.slice(11, 16), a: t.amount,
      dir: t.direction === 'credit' ? 'c' : 'd', m: t.counterparty || '',
      c: t.category || '', ch: t.channel || '',
    })),
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Slack Events API
    if (path === '/slack/events' && request.method === 'POST') {
      const raw = await request.text();
      let payload;
      try { payload = JSON.parse(raw); } catch { return new Response('bad request', { status: 400 }); }
      // URL verification handshake (may arrive before signing secret is set)
      if (payload.type === 'url_verification') return Response.json({ challenge: payload.challenge });
      // Everything else must be signed by Slack
      if (!(await verifySlack(env, request.headers.get('x-slack-request-timestamp'), raw, request.headers.get('x-slack-signature'))))
        return new Response('forbidden', { status: 403 });
      if (payload.type === 'event_callback') ctx.waitUntil(handleSlackEvent(env, payload.event));
      return new Response('');   // ack within 3s; reply is posted async
    }

    // Bank SMS forwarded from the phone (key-gated). Accepts JSON or form.
    if (path === '/sms' && request.method === 'POST') {
      if (url.searchParams.get('key') !== env.SMS_KEY) return new Response('forbidden', { status: 403 });
      // Accept JSON, form-encoded, or a raw message body — whatever the forwarder sends.
      const raw = await request.text();
      let p = {};
      try { p = JSON.parse(raw); } catch { try { for (const [k, v] of new URLSearchParams(raw)) p[k] = v; } catch {} }
      let text = p.text || p.message || p.body || p.msg || p.sms || '';
      if (!text && raw && raw[0] !== '{' && raw.indexOf('=') === -1) text = raw;   // raw-body fallback
      const sender = p.from || p.sender || p.address || p.originator || p.number || '';
      let ts = Number(p.sentStamp || p.timestamp || p.time || p.ts || 0);
      ts = ts > 1e12 ? Math.floor(ts / 1000) : (ts || Math.floor(Date.now() / 1000));
      if (!text) {
        // record the request anyway so a misconfigured body is still visible in /sms/raw
        await env.DB.prepare('INSERT OR IGNORE INTO sms_raw(id,ts,sender,body,parsed,note) VALUES(?,?,?,?,0,?)')
          .bind('sms-empty-' + ts + '-' + (raw.length), ts, sender || '', raw.slice(0, 400), 'no-text').run();
        return Response.json({ ok: false, error: 'no text field', received: raw.slice(0, 200) });
      }
      const skipChecks = url.searchParams.get('nochecks') === '1';
      return Response.json({ ok: true, ...(await handleSms(env, { sender, text, ts, skipChecks })) });
    }
    // Inspect recently forwarded SMS (to tune the parser)
    if (path === '/sms/raw' && url.searchParams.get('key') === env.INGEST_KEY) {
      return Response.json(await recentRawSms(env.DB, Math.min(Number(url.searchParams.get('n') || 40), 200)));
    }

    if (path === '/health') {
      const last = await getMeta(env.DB, 'last_ingest', '0');
      const ch = await getMeta(env.DB, 'slack_dm_channel', null);
      return Response.json({ ok: true, last_ingest: Number(last), slack_ready: !!ch });
    }

    // Admin endpoints (guarded by INGEST_KEY)
    if (path === '/ingest' && url.searchParams.get('key') === env.INGEST_KEY) {
      const days = Math.min(Number(url.searchParams.get('days') || 2), 180);
      const after = url.searchParams.get('after') || undefined;   // YYYY/MM/DD (backfill)
      const before = url.searchParams.get('before') || undefined;
      const skipChecks = url.searchParams.get('nochecks') === '1';
      return Response.json(await ingest(env, { days, after, before, skipChecks }));
    }
    if (path === '/report' && url.searchParams.get('key') === env.INGEST_KEY) {
      const t = url.searchParams.get('type');
      const fn = { morning: morningReport, weekly: weeklyReport, monthly: monthlyReport }[t] || morningReport;
      await fn(env);
      return Response.json({ sent: t || 'morning' });
    }

    // Live-refresh heartbeat: the dashboard polls this; a changed sig → reload.
    if (path === '/pulse') {
      if (getCookie(request, 'fa') !== (await cookieToken(env))) return new Response('forbidden', { status: 403 });
      return Response.json({ sig: await dataSignature(env.DB) }, { headers: { 'cache-control': 'no-store' } });
    }

    // On-demand ingest: the dashboard "Refresh" button hits this for an instant
    // email + SMS scan instead of waiting for the next per-minute cron.
    if (path === '/refresh' && request.method === 'POST') {
      if (getCookie(request, 'fa') !== (await cookieToken(env))) return new Response('forbidden', { status: 403 });
      const r = await ingest(env, { days: 2 });
      return Response.json(
        { ok: true, inserted: r.inserted || 0, sig: await dataSignature(env.DB) },
        { headers: { 'cache-control': 'no-store' } },
      );
    }

    // Dashboard + login
    if (path === '/' && request.method === 'POST') {
      const form = await request.formData();
      if (form.get('pass') === env.DASH_PASS) {
        return new Response('', {
          status: 302,
          headers: {
            'set-cookie': `fa=${await cookieToken(env)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`,
            location: '/',
          },
        });
      }
      return html(renderLogin('wrong passphrase'), 401);
    }
    if (path === '/') {
      const ok = getCookie(request, 'fa') === (await cookieToken(env));
      if (!ok) return html(renderLogin());
      let days = parseInt(url.searchParams.get('d') || '30', 10);
      if (!PERIODS.includes(days)) days = 30;
      return html(renderDashboard(await buildDashboardData(env, days)));
    }

    return new Response('not found', { status: 404 });
  },

  // Per-minute cron does everything. Ingest every run (so transactions surface
  // within ~a minute); fire briefings once daily at 06:05 IST, guarded so each
  // sends once per period.
  async scheduled(event, env) {
    await ingest(env, { days: 2 });

    const now = nowEpoch();
    const ist = new Date((now + (5 * 60 + 30) * 60) * 1000);
    if (ist.getUTCHours() !== 6 || ist.getUTCMinutes() !== 5) return; // briefings run once daily at 06:05 IST

    const day = istDay(now);                 // YYYY-MM-DD (IST)
    const [Y, M, D] = day.split('-').map(Number);
    const dow = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();   // 0 = Sunday
    const mLabel = `${Y}-${String(M).padStart(2, '0')}`;

    try { await checkBills(env); } catch (e) { console.log('bills', String(e)); }
    if (await alertOnce(env.DB, `rep-morning:${day}`)) await morningReport(env);
    if (D === 1 && await alertOnce(env.DB, `rep-monthly:${mLabel}`)) await monthlyReport(env);
    if (dow === 0 && await alertOnce(env.DB, `rep-weekly:${day}`)) await weeklyReport(env);
  },
};

function html(body, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
