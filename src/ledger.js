// ledger.js — all D1 reads/writes. Every aggregate the reports, chat and
// dashboard need is a deterministic SQL query here (never model-computed).
import { istParts } from './parser.js';

const now = () => Math.floor(Date.now() / 1000);

// ---- writes -----------------------------------------------------------------
const INSERT_COLS =
  '(id,ts,ts_ist,day_ist,direction,amount,currency,channel,upi_type,counterparty,counterparty_raw,category,ref,source,gmail_id,note,created_at)';
const INSERT_Q = `INSERT OR IGNORE INTO transactions ${INSERT_COLS} VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

function bindTxn(db, t) {
  return db.prepare(INSERT_Q).bind(
    t.id, t.ts, t.ts_ist, t.day_ist, t.direction, t.amount, t.currency || 'INR',
    t.channel, t.upi_type ?? null, t.counterparty ?? null, t.counterparty_raw ?? null,
    t.category ?? null, t.ref ?? null, t.source, t.gmail_id ?? null, t.note ?? null,
    t.created_at || now(),
  );
}

// Insert many, skipping duplicates (id primary key). Returns rows actually new.
export async function insertTxns(db, txns) {
  if (!txns.length) return { inserted: 0, rows: [] };
  const res = await db.batch(txns.map((t) => bindTxn(db, t)));
  const rows = txns.filter((_, i) => (res[i]?.meta?.changes || 0) > 0);
  return { inserted: rows.length, rows };
}

export async function addManual(db, { amount, note, category, ts }) {
  const id = 'cash-' + crypto.randomUUID();
  const p = istParts(ts);
  await bindTxn(db, {
    id, ts, ts_ist: p.ist, day_ist: p.day, direction: 'debit', amount, currency: 'INR',
    channel: 'CASH', upi_type: null, counterparty: note || 'Cash', counterparty_raw: note || 'Cash',
    category: category || 'cash', ref: null, source: 'manual', gmail_id: null, note: note || null,
    created_at: now(),
  }).run();
  return id;
}

export async function recategorize(db, merchantLike, category) {
  const r = await db.prepare(
    `UPDATE transactions SET category=? WHERE LOWER(counterparty) LIKE ? OR LOWER(counterparty_raw) LIKE ?`,
  ).bind(category, `%${merchantLike.toLowerCase()}%`, `%${merchantLike.toLowerCase()}%`).run();
  return r.meta?.changes || 0;
}

// ---- reads ------------------------------------------------------------------
export async function sumAmount(db, { from, to, direction, category, currency = 'INR' }) {
  let sql = `SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM transactions WHERE ts>=? AND ts<? AND currency=?`;
  const b = [from, to, currency];
  if (direction) { sql += ' AND direction=?'; b.push(direction); }
  if (category) { sql += ' AND category=?'; b.push(category); }
  const r = await db.prepare(sql).bind(...b).first();
  return { sum: r?.s || 0, count: r?.c || 0 };
}

export async function byCategory(db, { from, to, direction = 'debit' }) {
  const r = await db.prepare(
    `SELECT COALESCE(category,'uncategorized') category, SUM(amount) s, COUNT(*) c
     FROM transactions WHERE ts>=? AND ts<? AND direction=? AND currency='INR'
     GROUP BY category ORDER BY s DESC`,
  ).bind(from, to, direction).all();
  return r.results || [];
}

export async function listTxns(db, { from, to, direction, category, merchant, limit = 50 }) {
  let sql = `SELECT * FROM transactions WHERE ts>=? AND ts<?`;
  const b = [from, to];
  if (direction) { sql += ' AND direction=?'; b.push(direction); }
  if (category) { sql += ' AND category=?'; b.push(category); }
  if (merchant) {
    sql += ' AND (LOWER(counterparty) LIKE ? OR LOWER(counterparty_raw) LIKE ?)';
    b.push(`%${merchant.toLowerCase()}%`, `%${merchant.toLowerCase()}%`);
  }
  sql += ' ORDER BY ts DESC LIMIT ?'; b.push(Math.min(limit, 200));
  const r = await db.prepare(sql).bind(...b).all();
  return r.results || [];
}

export async function topMerchants(db, { from, to, direction = 'debit', limit = 10 }) {
  const r = await db.prepare(
    `SELECT COALESCE(counterparty,'?') counterparty, category, SUM(amount) s, COUNT(*) c
     FROM transactions WHERE ts>=? AND ts<? AND direction=? AND currency='INR'
     GROUP BY counterparty ORDER BY s DESC LIMIT ?`,
  ).bind(from, to, direction, limit).all();
  return r.results || [];
}

export async function monthlyTotals(db, { from, to }) {
  const r = await db.prepare(
    `SELECT substr(day_ist,1,7) ym,
      COALESCE(SUM(CASE WHEN direction='debit'  THEN amount END),0) debit,
      COALESCE(SUM(CASE WHEN direction='credit' THEN amount END),0) credit
     FROM transactions WHERE ts>=? AND ts<? AND currency='INR' GROUP BY ym ORDER BY ym`,
  ).bind(from, to).all();
  return r.results || [];
}

export async function channelSplit(db, { from, to, direction = 'debit' }) {
  const r = await db.prepare(
    `SELECT COALESCE(channel,'?') channel, SUM(amount) s, COUNT(*) c FROM transactions
     WHERE ts>=? AND ts<? AND direction=? AND currency='INR' GROUP BY channel ORDER BY s DESC`,
  ).bind(from, to, direction).all();
  return r.results || [];
}

export async function upiTypeSplit(db, { from, to }) {
  const r = await db.prepare(
    `SELECT COALESCE(upi_type,'OTHER') t, SUM(amount) s, COUNT(*) c FROM transactions
     WHERE ts>=? AND ts<? AND direction='debit' AND currency='INR' GROUP BY t`,
  ).bind(from, to).all();
  return r.results || [];
}

export async function sizeBuckets(db, { from, to }) {
  return await db.prepare(
    `SELECT
      COALESCE(SUM(CASE WHEN amount<200 THEN 1 END),0) b1,
      COALESCE(SUM(CASE WHEN amount>=200 AND amount<1000 THEN 1 END),0) b2,
      COALESCE(SUM(CASE WHEN amount>=1000 AND amount<5000 THEN 1 END),0) b3,
      COALESCE(SUM(CASE WHEN amount>=5000 THEN 1 END),0) b4
     FROM transactions WHERE ts>=? AND ts<? AND direction='debit' AND currency='INR'`,
  ).bind(from, to).first();
}

// ---- bills ------------------------------------------------------------------
export async function listBills(db) {
  const r = await db.prepare('SELECT * FROM bills WHERE active=1 ORDER BY due_day').all();
  return r.results || [];
}
export async function upsertBill(db, { id, name, match_str, amount, due_day, category, kind, next_due }) {
  await db.prepare(
    `INSERT INTO bills(id,name,match_str,amount,due_day,category,kind,next_due,active,created_at) VALUES(?,?,?,?,?,?,?,?,1,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, match_str=COALESCE(excluded.match_str,bills.match_str),
       amount=COALESCE(excluded.amount,bills.amount), due_day=COALESCE(excluded.due_day,bills.due_day),
       category=COALESCE(excluded.category,bills.category), kind=COALESCE(excluded.kind,bills.kind),
       next_due=COALESCE(excluded.next_due,bills.next_due), active=1`,
  ).bind(id, name, match_str || null, amount ?? null, due_day ?? null, category || null, kind || null, next_due || null, now()).run();
}
export async function deactivateBill(db, id) {
  const r = await db.prepare('UPDATE bills SET active=0 WHERE id=?').bind(id).run();
  return r.meta?.changes || 0;
}
// Has this bill been paid in [from, to)? Matches a debit by counterparty substring
// and (if an amount is set) a loose amount band. Returns the matching row or null.
export async function billPaidBetween(db, bill, from, to) {
  let sql = `SELECT day_ist, amount FROM transactions WHERE ts>=? AND ts<? AND direction='debit' AND currency='INR'`;
  const b = [from, to];
  if (bill.match_str) { sql += ' AND LOWER(counterparty) LIKE ?'; b.push(`%${bill.match_str.toLowerCase()}%`); }
  // The merchant match is the primary signal; amount is only a loose sanity guard
  // (recharge/plan amounts change month to month, so accept 0.4x–4x the expected).
  if (bill.amount) { sql += ' AND amount>=? AND amount<=?'; b.push(bill.amount * 0.4, bill.amount * 4); }
  sql += ' ORDER BY ts DESC LIMIT 1';
  return await db.prepare(sql).bind(...b).first();
}

// Cheap signature that changes whenever the ledger changes — powers live refresh.
export async function dataSignature(db) {
  const r = await db.prepare(
    `SELECT COUNT(*) c, COALESCE(MAX(created_at),0) m, COALESCE(ROUND(SUM(amount)),0) s FROM transactions`,
  ).first();
  return `${r?.c || 0}:${r?.m || 0}:${r?.s || 0}`;
}

export async function biggestDebit(db, { from, to }) {
  return await db.prepare(
    `SELECT amount, counterparty, day_ist, category FROM transactions
     WHERE ts>=? AND ts<? AND direction='debit' AND currency='INR'
     ORDER BY amount DESC LIMIT 1`,
  ).bind(from, to).first();
}

export async function dailyTotals(db, { from, to, direction = 'debit' }) {
  const r = await db.prepare(
    `SELECT day_ist, SUM(amount) s FROM transactions
     WHERE ts>=? AND ts<? AND direction=? AND currency='INR'
     GROUP BY day_ist ORDER BY day_ist`,
  ).bind(from, to, direction).all();
  return r.results || [];
}

// trailing stats for anomaly detection (debits, INR, excluding today's row)
export async function debitStats(db, { from, to }) {
  const r = await db.prepare(
    `SELECT COUNT(*) n, COALESCE(AVG(amount),0) mean, COALESCE(MAX(amount),0) mx
     FROM transactions WHERE ts>=? AND ts<? AND direction='debit' AND currency='INR'`,
  ).bind(from, to).first();
  return { n: r?.n || 0, mean: r?.mean || 0, max: r?.mx || 0 };
}

export async function merchantSeenBefore(db, counterparty, beforeTs) {
  if (!counterparty) return true;
  const r = await db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE counterparty=? AND ts<? AND direction='debit'`,
  ).bind(counterparty, beforeTs).first();
  return (r?.c || 0) > 0;
}

// ---- meta / config ----------------------------------------------------------
export async function getMeta(db, k, def = null) {
  const r = await db.prepare('SELECT v FROM meta WHERE k=?').bind(k).first();
  return r ? r.v : def;
}
export async function setMeta(db, k, v) {
  await db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
    .bind(k, String(v)).run();
}

export async function getOverrides(db) {
  const r = await db.prepare('SELECT raw_key,nice_name,category FROM merchant_map').all();
  const m = new Map();
  for (const row of r.results || []) m.set(row.raw_key, { nice_name: row.nice_name, category: row.category });
  return m;
}
export async function setOverride(db, key, { nice_name = null, category = null }) {
  await db.prepare(
    `INSERT INTO merchant_map(raw_key,nice_name,category) VALUES(?,?,?)
     ON CONFLICT(raw_key) DO UPDATE SET
       nice_name=COALESCE(excluded.nice_name,merchant_map.nice_name),
       category=COALESCE(excluded.category,merchant_map.category)`,
  ).bind(key, nice_name, category).run();
}

export async function getBudgets(db) {
  const r = await db.prepare('SELECT category,monthly_cap FROM budgets').all();
  const m = {};
  for (const row of r.results || []) m[row.category] = row.monthly_cap;
  return m;
}
export async function setBudget(db, category, cap) {
  await db.prepare(
    'INSERT INTO budgets(category,monthly_cap) VALUES(?,?) ON CONFLICT(category) DO UPDATE SET monthly_cap=excluded.monthly_cap',
  ).bind(category, cap).run();
}

export async function upsertSubscription(db, { merchant, currency, amount, ts, source }) {
  await db.prepare(
    `INSERT INTO subscriptions(merchant,currency,amount,last_seen,source) VALUES(?,?,?,?,?)
     ON CONFLICT(merchant) DO UPDATE SET currency=excluded.currency, amount=excluded.amount,
       last_seen=excluded.last_seen, source=excluded.source
     WHERE excluded.last_seen > subscriptions.last_seen`,
  ).bind(merchant, currency, amount, ts, source).run();
}
export async function listSubscriptions(db) {
  const r = await db.prepare('SELECT * FROM subscriptions ORDER BY last_seen DESC').all();
  return r.results || [];
}

export async function saveRawSms(db, { id, ts, sender, body, parsed, note }) {
  await db.prepare('INSERT OR IGNORE INTO sms_raw(id,ts,sender,body,parsed,note) VALUES(?,?,?,?,?,?)')
    .bind(id, ts, sender || '', body || '', parsed ? 1 : 0, note || null).run();
}
export async function recentRawSms(db, limit = 40) {
  const r = await db.prepare('SELECT ts,sender,body,parsed,note FROM sms_raw ORDER BY ts DESC LIMIT ?').bind(limit).all();
  return r.results || [];
}
// True if a transaction with (near) the same amount/time/direction already
// exists (from email) — so an SMS for the same UPI payment isn't double-counted.
export async function crossSourceExists(db, { ts, amount, direction }) {
  const r = await db.prepare(
    `SELECT COUNT(*) c FROM transactions WHERE direction=? AND currency='INR' AND ABS(amount-?)<0.5 AND ABS(ts-?)<1200`,
  ).bind(direction, amount, ts).first();
  return (r?.c || 0) > 0;
}

// Insert-or-ignore into alerts_sent; returns true the FIRST time only.
export async function alertOnce(db, key) {
  const r = await db.prepare('INSERT OR IGNORE INTO alerts_sent(k,ts) VALUES(?,?)')
    .bind(key, now()).run();
  return (r.meta?.changes || 0) > 0;
}
