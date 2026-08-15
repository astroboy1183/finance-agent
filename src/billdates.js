// billdates.js — upgrade the bill guardian from guessing to reading. It scans
// recent merchant emails (recharge / OTT / subscription / invoice confirmations,
// NOT the bank alerts) and has Claude pull the actual next renewal/expiry date,
// which is written onto the matching bill as `next_due` — so reminders fire on
// the real cycle end (e.g. "Jio valid till 14 Sep") instead of an estimated
// day-of-month. Read-only Gmail; one model call per run (all emails batched).
import { getAccessToken, listMessageIds, getMessage } from './gmail.js';
import { askClaude, extractJson } from './claude.js';
import { listBills, upsertBill } from './ledger.js';

// Confirmation-style emails from the usual recurring merchants, last ~40 days.
const QUERY =
  'newer_than:40d (subject:(recharge OR subscription OR renew OR renewal OR invoice OR receipt OR ' +
  '"payment successful" OR "valid till" OR "valid until" OR expires OR "auto pay" OR "auto-pay" OR membership OR "order confirmation") ' +
  'OR from:(jio OR airtel OR vodafone OR netflix OR spotify OR youtube OR hotstar OR udemy OR coursera OR openai OR anthropic OR "prime" OR google))';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const SYSTEM =
  'You read a batch of a user\'s emails and extract RECURRING bills/subscriptions and their NEXT charge/renewal/expiry date. ' +
  'For each genuine recurring commitment return: ' +
  'name (clean, e.g. "Jio recharge", "Netflix"), ' +
  'match (a short lowercase token that identifies the merchant inside a bank counterparty string, e.g. "jio", "netflix"), ' +
  'amount (INR integer if the email states it, else null), ' +
  'next_due (the next renewal/expiry/validity/next-billing date as YYYY-MM-DD if the email states one, else null), ' +
  'kind ("bill" for prepaid recharge/utility the user actively pays, "subscription" for auto-debit). ' +
  'Ignore promotions, OTPs, and one-off purchases with no recurring charge. When unsure, omit it. ' +
  'Reply with ONLY JSON: {"bills":[{"name":"","match":"","amount":0,"next_due":"YYYY-MM-DD","kind":"bill"}]}';

export async function syncBillDates(env) {
  const db = env.DB;
  let token;
  try { token = await getAccessToken(env); } catch (e) { return { scanned: 0, error: String(e) }; }
  const ids = await listMessageIds(token, QUERY, 15); // stay well under the subrequest cap
  if (!ids.length) return { scanned: 0, updated: 0 };

  const digests = [];
  for (const id of ids) {
    let m;
    try { m = await getMessage(token, id); } catch { continue; }
    const body = (m.body || '').replace(/\s+/g, ' ').slice(0, 700);
    digests.push(`--- EMAIL ${digests.length + 1}\nFrom: ${m.from}\nSubject: ${m.subject}\n${body}`);
  }
  if (!digests.length) return { scanned: ids.length, updated: 0 };

  let parsed;
  try {
    const user = `Today is ${todayIso()}.\n\n${digests.join('\n\n')}`;
    parsed = extractJson(await askClaude(env, SYSTEM, user, { max_tokens: 1400 }));
  } catch (e) {
    console.log('billdates: model failed', String(e));
    return { scanned: ids.length, updated: 0, error: String(e) };
  }
  const bills = parsed && Array.isArray(parsed.bills) ? parsed.bills : [];
  if (!bills.length) return { scanned: ids.length, detected: 0, updated: 0 };

  const existing = await listBills(db);
  let updated = 0, added = 0;
  for (const bi of bills) {
    const match = String(bi.match || '').toLowerCase().trim();
    if (!match || match.length < 2) continue;
    const nextDue = /^\d{4}-\d{2}-\d{2}$/.test(bi.next_due || '') ? bi.next_due : null;
    if (!nextDue && !bi.amount) continue; // nothing useful to add
    const amount = Math.round(Number(bi.amount)) || null;
    const dueDay = nextDue ? Number(nextDue.slice(8, 10)) : null;
    const kind = bi.kind === 'subscription' ? 'subscription' : 'bill';
    // Reconcile with an existing bill for the same merchant, else create one.
    const hit = existing.find((b) => b.match_str && (b.match_str.includes(match) || match.includes(b.match_str)));
    const id = hit ? hit.id : `auto:${match.replace(/[^a-z0-9]+/g, '-')}`;
    await upsertBill(db, {
      id, name: bi.name || match, match_str: match, amount,
      due_day: dueDay, category: hit ? hit.category : null, kind, next_due: nextDue,
    });
    hit ? updated++ : added++;
  }
  return { scanned: ids.length, detected: bills.length, updated, added };
}
