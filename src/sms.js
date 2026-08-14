// sms.js — ingest a single forwarded bank SMS. Parses it, cross-source-dedupes
// against email (so UPI txns present in both aren't double-counted), inserts the
// card/other charges email misses, and always stores the raw SMS for auditing +
// parser tuning.
import { parseSms, istParts } from './parser.js';
import { categorize } from './categorize.js';
import { insertTxns, getOverrides, saveRawSms, crossSourceExists } from './ledger.js';
import { runChecks } from './anomaly.js';

async function hashId(s) {
  const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return 'sms-' + [...new Uint8Array(b)].slice(0, 10).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function handleSms(env, { sender, text, ts }) {
  const db = env.DB;
  const nowE = Math.floor(Date.now() / 1000);
  const id = await hashId(`${sender}|${text}`);
  const parsed = parseSms(text);
  let inserted = 0, dup = false;

  if (parsed) {
    const txTs = parsed.ts || ts || nowE;
    dup = await crossSourceExists(db, { ts: txTs, amount: parsed.amount, direction: parsed.direction });
    if (!dup) {
      const overrides = await getOverrides(db);
      const p = istParts(txTs);
      const row = {
        id, ts: txTs, ts_ist: p.ist, day_ist: p.day, direction: parsed.direction,
        amount: parsed.amount, currency: 'INR', channel: parsed.channel, upi_type: parsed.upi_type,
        counterparty: parsed.counterparty, counterparty_raw: parsed.counterparty_raw || parsed.counterparty,
        ref: parsed.ref, source: 'sms', gmail_id: null, note: 'via sms', created_at: nowE,
      };
      row.category = categorize(row, overrides);
      const res = await insertTxns(db, [row]);
      inserted = res.inserted;
      if (res.rows.length) { try { await runChecks(env, res.rows); } catch (e) { console.log('sms checks', String(e)); } }
    }
  }

  await saveRawSms(db, { id, ts: ts || nowE, sender, body: text, parsed: !!parsed, note: dup ? 'dup-of-email' : (parsed ? null : 'unparsed') });
  return { parsed: !!parsed, inserted, dup };
}
