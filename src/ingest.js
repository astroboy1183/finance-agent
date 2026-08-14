// ingest.js — the hourly pipeline: pull recent Axis alerts, parse
// deterministically, categorise, dedup-insert, feed the subscription radar,
// then run real-time checks on anything genuinely new.
import { getAccessToken, listMessageIds, getMessage } from './gmail.js';
import { parseAlert, parseCardAutopay } from './parser.js';
import { categorize } from './categorize.js';
import { insertTxns, getOverrides, upsertSubscription, setMeta } from './ledger.js';
import { runChecks } from './anomaly.js';

export async function ingest(env, { days = 2, after, before, skipChecks = false } = {}) {
  const token = await getAccessToken(env);
  let q = 'from:axis.bank.in';
  if (after || before) {                 // date-range chunk (backfill)
    if (after) q += ` after:${after}`;
    if (before) q += ` before:${before}`;
  } else {
    q += ` newer_than:${days}d`;          // rolling window (hourly run)
  }
  const ids = await listMessageIds(token, q, 45);   // stay under the 50-subrequest cap
  const overrides = await getOverrides(env.DB);
  const nowE = Math.floor(Date.now() / 1000);

  const txns = [];
  const subs = [];
  for (const id of ids) {
    let msg;
    try { msg = await getMessage(token, id); } catch (e) { console.log('skip', id, String(e)); continue; }
    const t = parseAlert(msg);
    if (t) {
      t.category = categorize(t, overrides);
      t.created_at = nowE;
      txns.push(t);
      continue;
    }
    const sub = parseCardAutopay(msg);
    if (sub) subs.push({ ...sub, ts: Math.floor(Number(msg.internalDate || nowE * 1000) / 1000) });
  }

  const { inserted, rows } = await insertTxns(env.DB, txns);
  for (const s of subs)
    await upsertSubscription(env.DB, {
      merchant: s.merchant, currency: s.currency, amount: s.amount, ts: s.ts, source: 'card_autopay',
    });
  await setMeta(env.DB, 'last_ingest', nowE);

  if (rows.length && !skipChecks) {
    try { await runChecks(env, rows); } catch (e) { console.log('checks failed', String(e)); }
  }
  return { scanned: ids.length, parsed: txns.length, inserted, subs: subs.length };
}
