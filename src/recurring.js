// recurring.js — learn the user's recurring bills & subscriptions from the
// ledger (which is built from his Axis/UPI emails + SMS) instead of hardcoding
// them. A cheap SQL pass surfaces candidate merchants; Claude judges which are
// genuine recurring commitments and names them; we reconcile into the bills
// table. Runs weekly, so the dashboard's "upcoming/paid" list stays honest as
// plans change, new subscriptions appear, and old ones lapse.
import { listBills, upsertBill, deactivateBill } from './ledger.js';
import { askClaude, extractJson } from './claude.js';
import { nowEpoch } from './timeutil.js';

const DAY = 86400;

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// Merchants seen in >=2 distinct months over the last ~7 months, with their
// month-spread, amount range and typical day — the raw signal for the model.
async function candidates(db) {
  const since = nowEpoch() - 210 * DAY;
  const r = await db.prepare(
    `SELECT LOWER(counterparty) AS merchant,
            COUNT(*) AS n,
            COUNT(DISTINCT substr(day_ist,1,7)) AS months,
            CAST(AVG(CAST(substr(day_ist,9,2) AS INT)) AS INT) AS avg_day,
            ROUND(MIN(amount)) AS lo, ROUND(MAX(amount)) AS hi, ROUND(AVG(amount)) AS avg_amt,
            MAX(category) AS cat
       FROM transactions
      WHERE direction='debit' AND currency='INR' AND ts>=? AND counterparty IS NOT NULL AND counterparty<>''
      GROUP BY merchant
      HAVING months>=2 AND hi>=50
      ORDER BY months DESC, n DESC
      LIMIT 40`,
  ).bind(since).all();
  return r.results || [];
}

const SYSTEM =
  'You identify a user\'s RECURRING bills and subscriptions from their transaction history. ' +
  'You get candidate merchants, each with: how many distinct months it appeared, transaction count, ' +
  'typical day-of-month, amount range (lo-hi), average amount, and a category. ' +
  'Decide which are genuine recurring monthly commitments the user pays or that auto-debit — e.g. ' +
  'mobile/DTH recharges, OTT/music/app subscriptions, rent, EMIs, insurance, utilities, cloud/AI subscriptions. ' +
  'EXCLUDE incidental or merely-repeated spend: food delivery, shopping, groceries, ride-hailing, fuel, ' +
  'travel/train/flight tickets, ATM withdrawals, and person-to-person transfers. When unsure, exclude. ' +
  'For each real recurring item return: ' +
  'name (clean and human, e.g. "Jio recharge", "Spotify"), ' +
  'match (a short lowercase substring that reliably identifies this merchant inside the counterparty text, e.g. "jio", "spotify"), ' +
  'amount (typical rupees as an integer — use the average unless a fixed plan is obvious), ' +
  'due_day (1-28, the typical day it hits), ' +
  'category, and ' +
  'kind ("bill" for things the user must actively pay such as prepaid recharges or utilities, ' +
  '"subscription" for things that auto-debit such as OTT/music/app/cloud). ' +
  'Reply with ONLY JSON: {"bills":[{"name":"","match":"","amount":0,"due_day":1,"category":"","kind":"bill"}]}';

// Detect recurring commitments and reconcile them into the bills table.
export async function syncRecurringBills(env) {
  const db = env.DB;
  const cand = await candidates(db);
  if (!cand.length) return { candidates: 0, detected: 0 };

  const lines = cand
    .map((c) => `- "${c.merchant}" | months=${c.months} txns=${c.n} day~${c.avg_day} | ₹${c.lo}-${c.hi} avg ₹${c.avg_amt} | category=${c.cat}`)
    .join('\n');

  let parsed;
  try {
    const reply = await askClaude(env, SYSTEM, `Candidate merchants:\n${lines}`, { max_tokens: 1500 });
    parsed = extractJson(reply);
  } catch (e) {
    console.log('recurring: model call failed', String(e));
    return { candidates: cand.length, detected: 0, error: String(e) };
  }
  const bills = parsed && Array.isArray(parsed.bills) ? parsed.bills : [];
  if (!bills.length) return { candidates: cand.length, detected: 0 };

  const existing = await listBills(db);
  const kept = new Set();
  let added = 0, updated = 0;
  for (const bi of bills) {
    const match = String(bi.match || '').toLowerCase().trim();
    if (!match || match.length < 2) continue;
    const amount = Math.round(Number(bi.amount)) || null;
    const dueDay = Math.min(28, Math.max(1, Math.round(Number(bi.due_day)) || 1));
    const kind = bi.kind === 'subscription' ? 'subscription' : 'bill';
    // Reconcile with an existing bill for the same merchant (match-token overlap),
    // so a hand-seeded "jio-recharge" is updated in place, not duplicated.
    const hit = existing.find((b) => b.match_str && (b.match_str.includes(match) || match.includes(b.match_str)));
    const id = hit ? hit.id : `auto:${slug(match)}`;
    await upsertBill(db, { id, name: bi.name || match, match_str: match, amount, due_day: dueDay, category: bi.category || null, kind });
    kept.add(id);
    hit ? updated++ : added++;
  }
  // Retire previously auto-detected bills that no longer recur. Manual/seeded
  // bills (any id without the "auto:" prefix) are never touched here.
  let retired = 0;
  for (const b of existing) {
    if (b.id.startsWith('auto:') && !kept.has(b.id)) {
      await deactivateBill(db, b.id);
      retired++;
    }
  }
  return { candidates: cand.length, detected: bills.length, added, updated, retired };
}
