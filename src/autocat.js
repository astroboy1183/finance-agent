// autocat.js — categorise merchants the rule-based pass couldn't place. Any
// transaction left "uncategorized" is sent (merchant name only, no amounts of
// consequence) to Claude, which maps it to a known category. The answer is
// stored as a learned override in merchant_map, so it applies to every future
// transaction from that merchant automatically and is never asked again.
import { askClaude, extractJson } from './claude.js';
import { getOverrides, setOverride, recategorize } from './ledger.js';
import { merchantKey } from './categorize.js';

const CATS = [
  'food', 'groceries', 'travel', 'recharge', 'shopping', 'utilities',
  'subscriptions', 'health', 'rent', 'education', 'entertainment', 'transfer', 'other',
];

const SYSTEM =
  `Categorise each Indian merchant/payee into EXACTLY ONE of: ${CATS.join(', ')}. ` +
  'Use "transfer" for a person-to-person payment, "other" only when genuinely unclassifiable. ' +
  'Reply with ONLY JSON matching the numbered list: {"cats":[{"i":1,"category":"food"}]}';

// Learn categories for still-unknown merchants. Cheap: only merchants without an
// existing override are sent, and once learned they never come back here.
export async function categorizeUnknowns(env) {
  const db = env.DB;
  const r = await db.prepare(
    `SELECT counterparty, COUNT(*) AS n
       FROM transactions
      WHERE category='uncategorized' AND direction='debit'
        AND counterparty IS NOT NULL AND counterparty<>''
      GROUP BY LOWER(counterparty)
      ORDER BY n DESC
      LIMIT 25`,
  ).all();
  const rows = r.results || [];
  if (!rows.length) return { unknown: 0, learned: 0 };

  const overrides = await getOverrides(db);
  const todo = rows.filter((x) => !overrides.has(merchantKey(x.counterparty)));
  if (!todo.length) return { unknown: rows.length, learned: 0 };

  const list = todo.map((x, i) => `${i + 1}. "${x.counterparty}"`).join('\n');
  let parsed;
  try {
    parsed = extractJson(await askClaude(env, SYSTEM, list, { max_tokens: 700 }));
  } catch (e) {
    console.log('autocat: model failed', String(e));
    return { unknown: rows.length, learned: 0, error: String(e) };
  }
  const cats = parsed && Array.isArray(parsed.cats) ? parsed.cats : [];

  let learned = 0;
  for (const c of cats) {
    const idx = Number(c.i) - 1;
    const cat = String(c.category || '').toLowerCase();
    if (idx < 0 || idx >= todo.length || !CATS.includes(cat)) continue;
    const merchant = todo[idx].counterparty;
    await setOverride(db, merchantKey(merchant), { category: cat }); // remembered for the future
    await recategorize(db, merchant, cat); // fix the existing rows
    learned++;
  }
  return { unknown: rows.length, learned };
}
