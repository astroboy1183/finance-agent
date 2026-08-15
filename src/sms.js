// sms.js — ingest a single forwarded bank SMS. Handles (a) normal debit/credit
// SMS (parsed, cross-source-deduped against email, inserted), and (b) UPI-autopay
// mandate reminders (the only record of Udemy/Netflix/Spotify-style recurring
// debits) — booked as a debit on the mandate's execution date + tracked as a
// subscription. Always stores the raw SMS for auditing.
import { parseSms, parseMandate, istParts } from './parser.js';
import { categorize } from './categorize.js';
import { insertTxns, getOverrides, saveRawSms, crossSourceExists, upsertSubscription } from './ledger.js';
import { runChecks } from './anomaly.js';

async function hashId(s) {
  const b = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return 'sms-' + [...new Uint8Array(b)].slice(0, 10).map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function handleSms(env, { sender, text, ts, skipChecks = false }) {
  const db = env.DB;
  const nowE = Math.floor(Date.now() / 1000);
  const id = await hashId(`${sender}|${text}`);
  const parsed = parseSms(text);
  const mandate = parsed ? null : parseMandate(text);
  let inserted = 0, dup = false;
  const kind = parsed ? 'txn' : (mandate ? 'mandate' : null);

  if (parsed) {
    const txTs = parsed.ts || ts || nowE;
    dup = await crossSourceExists(db, { ts: txTs, amount: parsed.amount, direction: parsed.direction });
    if (!dup) {
      const overrides = await getOverrides(db);
      const p = istParts(txTs);
      const row = {
        id, ts: txTs, ts_ist: p.ist, day_ist: p.day, direction: parsed.direction, amount: parsed.amount,
        currency: 'INR', channel: parsed.channel, upi_type: parsed.upi_type, counterparty: parsed.counterparty,
        counterparty_raw: parsed.counterparty_raw || parsed.counterparty, ref: parsed.ref, source: 'sms',
        gmail_id: null, note: 'via sms', created_at: nowE,
      };
      row.category = categorize(row, overrides);
      const res = await insertTxns(db, [row]);
      inserted = res.inserted;
      if (res.rows.length && !skipChecks) { try { await runChecks(env, res.rows); } catch (e) { console.log('sms checks', String(e)); } }
    }
  } else if (mandate) {
    dup = await crossSourceExists(db, { ts: mandate.ts, amount: mandate.amount, direction: 'debit' });
    if (!dup) {
      const overrides = await getOverrides(db);
      const p = istParts(mandate.ts);
      const row = {
        id, ts: mandate.ts, ts_ist: p.ist, day_ist: p.day, direction: 'debit', amount: mandate.amount,
        currency: 'INR', channel: 'MANDATE', upi_type: null, counterparty: mandate.merchant,
        counterparty_raw: mandate.merchant, ref: null, source: 'mandate', gmail_id: null,
        note: 'autopay mandate', created_at: nowE,
      };
      row.category = categorize(row, overrides);
      const res = await insertTxns(db, [row]);
      inserted = res.inserted;
      if (res.rows.length) await upsertSubscription(db, { merchant: mandate.merchant, currency: 'INR', amount: mandate.amount, ts: mandate.ts, source: 'mandate' });
    }
  }

  await saveRawSms(db, { id, ts: ts || nowE, sender, body: text, parsed: !!(parsed || mandate), note: dup ? 'dup' : (kind || 'unparsed') });
  return { parsed: !!(parsed || mandate), inserted, dup, kind };
}
