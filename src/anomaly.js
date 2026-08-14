// anomaly.js — real-time checks on genuinely new debit rows during ingestion:
// unusually large debits, first-ever payments to a merchant, and per-category
// monthly budget breaches. Each alert is de-duplicated (pings you once). Slack.
import { debitStats, sumAmount, getBudgets, alertOnce, merchantSeenBefore } from './ledger.js';
import { send, esc, b, i } from './slack.js';
import { inr, thisMonth, DAY } from './timeutil.js';

export async function runChecks(env, rows) {
  const db = env.DB;
  const nowE = Math.floor(Date.now() / 1000);
  const debits = rows.filter((r) => r.direction === 'debit' && r.currency === 'INR');
  if (!debits.length) return;

  const stats = await debitStats(db, { from: nowE - 30 * DAY, to: nowE });
  const dyn = stats.n >= 5 ? stats.mean * 5 : Infinity;   // 5x your 30-day mean
  const BIG_ABS = 25000;

  for (const t of debits) {
    if (t.amount >= BIG_ABS || t.amount >= dyn) {
      if (await alertOnce(db, `anom:${t.id}`))
        await send(env,
          `⚠️ ${b('Large debit')}\n${inr(t.amount)} → ${esc(t.counterparty || '?')}\n${i(esc(t.ts_ist) + ' · ' + esc(t.channel))}\n\nIf this wasn't you, block UPI via your bank app.`);
    } else if (t.amount >= 3000) {
      const seen = await merchantSeenBefore(db, t.counterparty, t.ts);
      if (!seen && await alertOnce(db, `newm:${t.id}`))
        await send(env, `🆕 First payment to ${b(esc(t.counterparty || '?'))}: ${inr(t.amount)}\n${i(esc(t.ts_ist))}`);
    }
  }

  const mtd = thisMonth(nowE);
  const budgets = await getBudgets(db);
  const cats = [...new Set(debits.map((t) => t.category).filter(Boolean))];
  for (const cat of cats) {
    const cap = budgets[cat];
    if (!cap) continue;
    const { sum } = await sumAmount(db, { from: mtd.from, to: mtd.to, direction: 'debit', category: cat });
    const pct = sum / cap;
    if (pct >= 1 && await alertOnce(db, `bud100:${cat}:${mtd.label}`))
      await send(env, `🚨 ${b(esc(cat))} is over budget this month: ${inr(sum)} / ${inr(cap)} (${Math.round(pct * 100)}%)`);
    else if (pct >= 0.8 && await alertOnce(db, `bud80:${cat}:${mtd.label}`))
      await send(env, `🟠 ${b(esc(cat))} at ${Math.round(pct * 100)}% of budget: ${inr(sum)} / ${inr(cap)}`);
  }
}
