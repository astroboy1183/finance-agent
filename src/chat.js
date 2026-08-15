// chat.js — the Slack chat brain. Fast rule-based commands first; anything
// conversational is classified by Claude into a fixed intent + params, then a
// deterministic ledger query runs. The model NEVER returns numbers or SQL — it
// only picks intent + filters, so every figure the user sees is real.
import { askClaude, extractJson } from './claude.js';
import { send, esc, b, i } from './slack.js';
import {
  sumAmount, byCategory, listTxns, topMerchants, listSubscriptions,
  addManual, setBudget, getBudgets, setOverride, recategorize, getMeta, setMeta,
  upsertBill, deactivateBill,
} from './ledger.js';
import { billsStatus } from './bills.js';
import { categorize, merchantKey } from './categorize.js';

const ord = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; };
import { inr, subAmount, yesterday, today, thisMonth, prevMonth, lastWeek, lastDays, nowEpoch } from './timeutil.js';

const HELP = `🤖 ${b('Finance bot — what I can do')}

Ask me naturally, e.g.:
• "how much did I spend this month?"
• "food spend last 7 days"
• "show my transactions today"
• "top merchants this month"
• "how much to Nandus PG?"

Commands:
• \`add 200 cash lunch\` — log a cash spend
• \`budget food 8000\` — set a monthly cap
• \`categorise swiggy as food\` — fix a category
• \`subs\` — list subscriptions
• \`bills\` · \`add bill rent 16000 due 9\` — track bills & due dates
• \`today\` / \`yesterday\` / \`month\` — quick reports
• \`help\``;

function resolveRange(p) {
  if (p?.days) return lastDays(Number(p.days));
  switch (p?.period) {
    case 'today': return today();
    case 'yesterday': return yesterday();
    case 'this_week': case 'week': return lastWeek();
    case 'last_month': return prevMonth();
    case 'this_month': case 'month': default: return thisMonth();
  }
}

async function execIntent(env, it) {
  const db = env.DB;
  const r = resolveRange(it);
  const dir = it.direction === 'credit' ? 'credit' : 'debit';
  const word = dir === 'credit' ? 'received' : 'spent';

  switch (it.intent) {
    case 'spend_total': {
      const { sum, count } = await sumAmount(db, { from: r.from, to: r.to, direction: dir, category: it.category || undefined });
      const cat = it.category ? ` on ${b(esc(it.category))}` : '';
      return `You ${word} ${b(inr(sum))}${cat} (${r.label}) · ${count} txn${count !== 1 ? 's' : ''}.`;
    }
    case 'category_breakdown': {
      const cats = await byCategory(db, { from: r.from, to: r.to, direction: dir });
      const tot = cats.reduce((a, c) => a + (c.category !== 'income' ? c.s : 0), 0);
      const lines = cats.filter((c) => c.category !== 'income').map((c) => `  • ${esc(c.category)} — ${inr(c.s)} ${i('(' + c.c + ')')}`).join('\n');
      return `${b('By category')} (${r.label}) — total ${inr(tot)}\n${lines || '  —'}`;
    }
    case 'top_merchants': {
      const top = await topMerchants(db, { from: r.from, to: r.to, direction: dir, limit: Math.min(it.limit || 8, 15) });
      return top.length ? `${b('Top merchants')} (${r.label})\n${top.map((t) => `  • ${esc(t.counterparty)} — ${inr(t.s)} ${i('(' + t.c + ')')}`).join('\n')}` : `No spending found (${r.label}).`;
    }
    case 'search_merchant': {
      const txns = await listTxns(db, { from: r.from, to: r.to, merchant: it.merchant, limit: 15 });
      const tot = txns.filter((t) => t.direction === 'debit').reduce((a, t) => a + t.amount, 0);
      if (!txns.length) return `No transactions matching “${esc(it.merchant || '')}” (${r.label}).`;
      return `${b(esc(it.merchant))} (${r.label}) — ${inr(tot)} over ${txns.length}\n${txns.map((t) => `  ${t.direction === 'credit' ? '+' : '−'}${inr(t.amount)} · ${esc(t.counterparty || '?')} ${i(esc(t.ts_ist.slice(0, 16)))}`).join('\n')}`;
    }
    case 'list_txns': {
      const txns = await listTxns(db, { from: r.from, to: r.to, direction: it.direction || undefined, category: it.category || undefined, merchant: it.merchant || undefined, limit: Math.min(it.limit || 15, 30) });
      if (!txns.length) return `No transactions (${r.label}).`;
      return `${b('Transactions')} (${r.label})\n${txns.map((t) => `  ${t.direction === 'credit' ? '+' : '−'}${inr(t.amount)} · ${esc(t.counterparty || '?')} ${i(esc(t.ts_ist.slice(0, 16)))}`).join('\n')}`;
    }
    case 'subscriptions': {
      const subs = await listSubscriptions(db);
      return subs.length ? `${b('Subscriptions')}\n${subs.map((s) => `  • ${esc(s.merchant)} — ${subAmount(s.currency, s.amount)}`).join('\n')}` : 'No subscriptions detected yet.';
    }
    case 'help': default:
      return HELP;
  }
}

// Rule-based fast paths for the imperative commands (no model call needed).
async function tryCommand(env, text) {
  const db = env.DB;
  let m;
  if ((m = text.match(/^\/?(start|help)\b/i))) return HELP;
  if (/^\/?(subs|subscriptions)\b/i.test(text)) return execIntent(env, { intent: 'subscriptions' });

  // bills
  if (/^\/?bills?\b/i.test(text) && !/^add\s/i.test(text)) {
    const bills = await billsStatus(env);
    if (!bills.length) return 'No bills tracked yet. Add one: `add bill rent 16000 due 9`';
    return `${b('Bills this month')}\n` + bills.map((bl) => {
      const icon = bl.status === 'paid' ? '✅' : bl.status === 'overdue' ? '🔴' : bl.status === 'due-soon' ? '🟠' : '⚪';
      const when = bl.status === 'paid' ? `paid ${bl.paidOn || ''}` : bl.status === 'overdue' ? `${-bl.daysUntil}d overdue` : bl.status === 'due-soon' ? (bl.daysUntil === 0 ? 'due today' : `in ${bl.daysUntil}d`) : `due the ${bl.due_day}${ord(bl.due_day)}`;
      return `  ${icon} ${esc(bl.name)} — ${bl.amount ? inr(bl.amount) : ''} · ${when}`;
    }).join('\n');
  }
  if ((m = text.match(/^add\s+bill\s+(.+?)\s+₹?\s*([\d,]+(?:\.\d+)?)\s+due\s+(\d{1,2})/i))) {
    const name = m[1].trim(), amount = parseFloat(m[2].replace(/,/g, '')), day = Math.min(31, Math.max(1, parseInt(m[3], 10)));
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cat = categorize({ direction: 'debit', counterparty: name, counterparty_raw: name, upi_type: null }, null);
    await upsertBill(db, { id, name, match_str: name.split(/\s+/)[0], amount, due_day: day, category: cat });
    return `✅ Bill added: ${b(esc(name))} — ${inr(amount)} due the ${day}${ord(day)}. I'll remind you 3 days before + on the day, and mark it paid when the payment shows up.`;
  }
  if ((m = text.match(/^remove\s+bill\s+(.+)/i))) {
    const name = m[1].trim(), id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const n = await deactivateBill(db, id);
    return n ? `✅ Removed bill “${esc(name)}”.` : `No bill matching “${esc(name)}”.`;
  }
  if (/^\/?today\b/i.test(text)) return execIntent(env, { intent: 'category_breakdown', period: 'today' });
  if (/^\/?yesterday\b/i.test(text)) return execIntent(env, { intent: 'list_txns', period: 'yesterday' });
  if (/^\/?month\b/i.test(text)) return execIntent(env, { intent: 'category_breakdown', period: 'this_month' });

  // add 200 cash lunch   |   add 200 lunch (cash implied)
  if ((m = text.match(/^add\s+₹?\s*([\d,]+(?:\.\d+)?)\s*(?:cash\s+)?(.*)$/i))) {
    const amount = parseFloat(m[1].replace(/,/g, ''));
    const note = (m[2] || 'Cash').trim() || 'Cash';
    const guess = categorize({ direction: 'debit', counterparty: note, counterparty_raw: note, upi_type: null }, null);
    const cat = guess === 'uncategorized' ? 'cash' : guess;
    await addManual(db, { amount, note, category: cat, ts: nowEpoch() });
    return `✅ Logged cash spend: ${b(inr(amount))} — ${esc(note)} ${i('(' + cat + ')')}`;
  }
  // budget food 8000
  if ((m = text.match(/^budget\s+([a-z/&-]+)\s+₹?\s*([\d,]+(?:\.\d+)?)/i))) {
    const cap = parseFloat(m[2].replace(/,/g, ''));
    await setBudget(db, m[1].toLowerCase(), cap);
    return `✅ Budget set: ${b(esc(m[1].toLowerCase()))} = ${inr(cap)}/month`;
  }
  if (/^budgets?\b/i.test(text)) {
    const bg = await getBudgets(db);
    const keys = Object.keys(bg);
    return keys.length ? `${b('Budgets')}\n${keys.map((k) => `  • ${esc(k)} — ${inr(bg[k])}/mo`).join('\n')}` : 'No budgets set. Try `budget food 8000`.';
  }
  // categorise swiggy as food
  if ((m = text.match(/^categori[sz]e\s+(.+?)\s+as\s+([a-z/&-]+)/i))) {
    const merchant = m[1].trim(), cat = m[2].toLowerCase();
    await setOverride(db, merchantKey(merchant), { category: cat });
    const n = await recategorize(db, merchant, cat);
    return `✅ “${esc(merchant)}” → ${b(esc(cat))} (updated ${n} past txn${n !== 1 ? 's' : ''}).`;
  }
  return null;
}

const CLASSIFY_SYS = `You route a personal-finance chat message to ONE intent. Output ONLY JSON, no prose.
Intents: spend_total, category_breakdown, top_merchants, search_merchant, list_txns, subscriptions, help.
Fields (include only what applies):
  intent: string (required)
  period: one of "today","yesterday","this_week","this_month","last_month"  (omit if days given)
  days: integer  (for "last N days")
  category: string  (food, groceries, travel, recharge, shopping, utilities, subscriptions, health, rent, transfer, income)
  direction: "debit" | "credit"
  merchant: string  (for search_merchant, the name to match)
  limit: integer
Default period is this_month. "spend/spent/how much" -> spend_total (add category if named). "breakdown/where did money go/by category" -> category_breakdown. "biggest/top" -> top_merchants. "to X / at X / did I pay X" -> search_merchant with merchant=X. "show/list transactions" -> list_txns.
Example: "food last 10 days" -> {"intent":"spend_total","category":"food","days":10}`;

export async function handleMessage(env, text) {
  const cmd = await tryCommand(env, text);
  if (cmd !== null) return cmd;
  let intent;
  try {
    const out = await askClaude(env, CLASSIFY_SYS, text, { max_tokens: 150 });
    intent = extractJson(out);
  } catch (e) { console.log('classify failed', String(e)); }
  if (!intent || !intent.intent) return `I didn't catch that.\n\n${HELP}`;
  return execIntent(env, intent);
}

// Slack Events API entrypoint. Trust-on-first-use owner lock; only the owner is
// answered, and the DM channel is remembered for proactive reports.
export async function handleSlackEvent(env, event) {
  if (!event || event.type !== 'message') return;
  if (event.subtype || event.bot_id) return;            // ignore edits/joins/bot echoes
  const text = (event.text || '').trim();
  const user = event.user, channel = event.channel;
  if (!text || !channel) return;

  const owner = await getMeta(env.DB, 'slack_owner', null);
  if (!owner) {
    await setMeta(env.DB, 'slack_owner', user);
    await setMeta(env.DB, 'slack_dm_channel', channel);
  } else if (user !== owner) {
    return;                                              // silently ignore others
  }
  if (channel.startsWith('D')) await setMeta(env.DB, 'slack_dm_channel', channel);

  let reply;
  try { reply = await handleMessage(env, text); }
  catch (e) { console.log('slack handle error', String(e)); reply = '⚠️ Something went wrong handling that.'; }
  await send(env, reply || HELP, { channel });
}
