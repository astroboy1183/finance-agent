// reports.js — scheduled briefings (morning / weekly / monthly), Slack mrkdwn.
// All figures come from ledger SQL; Claude only adds an optional one-line nudge.
import { sumAmount, byCategory, listTxns, topMerchants, listSubscriptions } from './ledger.js';
import { send, esc, b, i } from './slack.js';
import { inr, subAmount, yesterday, thisMonth, lastWeek, prevMonth, daysInMonthSoFar } from './timeutil.js';
import { askClaude } from './claude.js';

const hhmm = (ist) => esc(ist.slice(11, 16));
const catLines = (rows) =>
  rows.filter((r) => r.category !== 'income').map((r) => `  • ${esc(r.category)} — ${inr(r.s)} ${i('(' + r.c + ')')}`).join('\n');

async function nudge(env, prompt) {
  try {
    const n = await askClaude(env,
      'You are a terse personal-finance assistant. Reply with ONE short, specific, friendly line under 18 words. No emojis, no preamble, no lists.',
      prompt, { max_tokens: 60 });
    return n ? `\n\n💡 ${i(esc(n))}` : '';
  } catch { return ''; }
}

export async function morningReport(env) {
  const db = env.DB, y = yesterday();
  const debit = await sumAmount(db, { from: y.from, to: y.to, direction: 'debit' });
  const credit = await sumAmount(db, { from: y.from, to: y.to, direction: 'credit' });

  if (debit.count === 0 && credit.count === 0) {
    await send(env, `☀️ ${b('Good morning!')}\nNo transactions on ${esc(y.label)} — a no-spend day. 🎉`);
    return;
  }
  const cats = await byCategory(db, { from: y.from, to: y.to, direction: 'debit' });
  const txns = await listTxns(db, { from: y.from, to: y.to, direction: 'debit', limit: 20 });
  const mtd = thisMonth();
  const mtdSum = (await sumAmount(db, { from: mtd.from, to: mtd.to, direction: 'debit' })).sum;
  const days = daysInMonthSoFar();
  const avg = days ? mtdSum / days : 0;

  let head = `☀️ ${b('Yesterday — ' + esc(y.label))}\n\n💸 Spent: ${b(inr(debit.sum))} · ${debit.count} txn${debit.count !== 1 ? 's' : ''}`;
  if (credit.sum > 0) head += `\n💰 Received: ${b(inr(credit.sum))}`;
  if (avg > 0) {
    const dp = Math.round((debit.sum / avg - 1) * 100);
    head += `\n📊 ${dp >= 0 ? '▲' : '▼'} ${Math.abs(dp)}% vs daily avg (${inr(avg)})`;
  }
  const list = txns.map((t) => `  ${inr(t.amount)} — ${esc(t.counterparty || '?')} ${i(hhmm(t.ts_ist))}`).join('\n');
  let body = `${head}\n\n${b('By category')}\n${catLines(cats) || '  —'}\n\n${b('Transactions')}\n${list}\n\n${b('Month so far:')} ${inr(mtdSum)} ${i('· ' + days + 'd · ' + inr(avg) + '/day')}`;
  body += await nudge(env, `Yesterday spent ₹${Math.round(debit.sum)} vs daily average ₹${Math.round(avg)}. Top: ${cats.slice(0, 3).map((c) => `${c.category} ₹${Math.round(c.s)}`).join(', ')}.`);
  await send(env, body);
}

export async function weeklyReport(env) {
  const db = env.DB, w = lastWeek();
  const cur = await sumAmount(db, { from: w.from, to: w.to, direction: 'debit' });
  const prev = await sumAmount(db, { from: w.from - 7 * 86400, to: w.from, direction: 'debit' });
  const credit = await sumAmount(db, { from: w.from, to: w.to, direction: 'credit' });
  const cats = await byCategory(db, { from: w.from, to: w.to, direction: 'debit' });
  const top = await topMerchants(db, { from: w.from, to: w.to, limit: 5 });
  const dp = prev.sum > 0 ? Math.round((cur.sum / prev.sum - 1) * 100) : null;

  let body = `📅 ${b('Weekly review — last 7 days')}\n\n💸 Spent: ${b(inr(cur.sum))} · ${cur.count} txns`;
  if (credit.sum > 0) body += `\n💰 Income: ${b(inr(credit.sum))}`;
  if (dp !== null) body += `\n${dp >= 0 ? '▲' : '▼'} ${Math.abs(dp)}% vs the week before (${inr(prev.sum)})`;
  body += `\n\n${b('By category')}\n${catLines(cats) || '  —'}`;
  if (top.length) body += `\n\n${b('Top merchants')}\n${top.map((t) => `  • ${esc(t.counterparty)} — ${inr(t.s)}`).join('\n')}`;
  body += await nudge(env, `This week spent ₹${Math.round(cur.sum)} vs ₹${Math.round(prev.sum)} last week. Top category ${cats[0]?.category || '-'}.`);
  await send(env, body);
}

export async function monthlyReport(env) {
  const db = env.DB, pm = prevMonth();
  const debit = await sumAmount(db, { from: pm.from, to: pm.to, direction: 'debit' });
  const credit = await sumAmount(db, { from: pm.from, to: pm.to, direction: 'credit' });
  const cats = await byCategory(db, { from: pm.from, to: pm.to, direction: 'debit' });
  const top = await topMerchants(db, { from: pm.from, to: pm.to, limit: 6 });
  const subs = await listSubscriptions(db);
  const net = credit.sum - debit.sum;
  const rate = credit.sum > 0 ? Math.round((net / credit.sum) * 100) : null;

  let body = `🗓️ ${b('Monthly report — ' + esc(pm.label))}\n\n💸 Spent: ${b(inr(debit.sum))}\n💰 Income: ${b(inr(credit.sum))}\n🏦 Net: ${b(inr(net))}`;
  if (rate !== null) body += ` ${i('(' + rate + '% saved)')}`;
  body += `\n\n${b('By category')}\n${catLines(cats) || '  —'}`;
  if (top.length) body += `\n\n${b('Top merchants')}\n${top.map((t) => `  • ${esc(t.counterparty)} — ${inr(t.s)}`).join('\n')}`;
  if (subs.length) body += `\n\n${b('Subscriptions on file')}\n${subs.map((s) => `  • ${esc(s.merchant)} — ${subAmount(s.currency, s.amount)}`).join('\n')}`;
  body += await nudge(env, `Last month spent ₹${Math.round(debit.sum)}, earned ₹${Math.round(credit.sum)}, saved ${rate}%. Biggest category ${cats[0]?.category || '-'}.`);
  await send(env, body);
}
