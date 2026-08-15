// bills.js — recurring-bill guardian. "Paid" is derived live from the ledger
// (a matching debit this month), so nothing to mark by hand. Reminders fire 3
// days before the due date and when overdue, once each per month.
import { listBills, billPaidBetween, alertOnce, upsertBill } from './ledger.js';
import { send, esc, b } from './slack.js';
import { inr, thisMonth, nowEpoch, istDay, DAY } from './timeutil.js';
import { istToEpoch } from './parser.js';

const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };

function dueDateEpoch(dueDay, now) {
  const [y, m] = istDay(now).split('-').map(Number);
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return istToEpoch(y, m, Math.min(dueDay, dim), 10, 0, 0);
}

// Prefer an explicit next_due read from a merchant email; fall back to the
// day-of-month estimate learned from payment history.
function dueEpoch(bl, now) {
  if (bl.next_due && /^\d{4}-\d{2}-\d{2}$/.test(bl.next_due)) {
    const [y, m, d] = bl.next_due.split('-').map(Number);
    return istToEpoch(y, m, d, 10, 0, 0);
  }
  return dueDateEpoch(bl.due_day, now);
}

export async function billsStatus(env) {
  const db = env.DB, now = nowEpoch(), mtd = thisMonth(now);
  const out = [];
  for (const bl of await listBills(db)) {
    const paid = await billPaidBetween(db, bl, mtd.from, now + 1);
    const daysUntil = Math.round((dueEpoch(bl, now) - now) / DAY);
    let status = 'upcoming';
    if (paid) status = 'paid';
    else if (daysUntil < 0) status = 'overdue';
    else if (daysUntil <= 3) status = 'due-soon';
    out.push({ name: bl.name, amount: bl.amount, due_day: bl.due_day, daysUntil, status,
      kind: bl.kind || 'bill', paidOn: paid ? paid.day_ist : null, paidAmt: paid ? paid.amount : null });
  }
  const rank = { overdue: 0, 'due-soon': 1, upcoming: 2, paid: 3 };
  out.sort((a, c) => (rank[a.status] - rank[c.status]) || (a.daysUntil - c.daysUntil));
  return out;
}

export async function checkBills(env) {
  const db = env.DB, now = nowEpoch(), mtd = thisMonth(now), month = istDay(now).slice(0, 7);
  for (const bl of await listBills(db)) {
    const paid = await billPaidBetween(db, bl, mtd.from, now + 1);
    if (paid) {
      // Keep the expected amount current — recharge/plan amounts drift over time.
      if (bl.amount && paid.amount && Math.abs(paid.amount - bl.amount) / bl.amount > 0.1)
        await upsertBill(db, { id: bl.id, name: bl.name, match_str: bl.match_str, amount: Math.round(paid.amount), due_day: bl.due_day, category: bl.category });
      continue; // already paid this month
    }
    const daysUntil = Math.round((dueEpoch(bl, now) - now) / DAY);
    const amt = bl.amount ? ` — ${inr(bl.amount)}` : '';
    if (daysUntil < 0) {
      if (await alertOnce(db, `bill-over:${bl.id}:${month}`))
        await send(env, `🔴 ${b('Overdue bill')} · ${esc(bl.name)}${amt} was due on the ${bl.due_day}${ordinal(bl.due_day)} and isn't paid yet.`);
    } else if (daysUntil <= 3 && (bl.kind || 'bill') !== 'subscription') {
      // Subscriptions auto-debit — no "pay me" heads-up needed; only an overdue
      // alert above (a missed auto-debit is worth knowing) fires for them.
      const when = daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;
      if (await alertOnce(db, `bill-soon:${bl.id}:${month}`))
        await send(env, `🟠 ${b('Bill due ' + when)} · ${esc(bl.name)}${amt} (due the ${bl.due_day}${ordinal(bl.due_day)}).`);
    }
  }
}
