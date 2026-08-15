-- finance-agent D1 schema. Apply with:
--   wrangler d1 execute finance --file=schema.sql   (add --remote for prod)

CREATE TABLE IF NOT EXISTS transactions (
  id               TEXT PRIMARY KEY,   -- gmail msg id (dedup) or 'cash-<uuid>'
  ts               INTEGER NOT NULL,   -- real UTC epoch of the transaction
  ts_ist           TEXT NOT NULL,      -- 'YYYY-MM-DD HH:MM:SS' in IST (display)
  day_ist          TEXT NOT NULL,      -- 'YYYY-MM-DD' in IST (grouping)
  direction        TEXT NOT NULL,      -- 'debit' | 'credit'
  amount           REAL NOT NULL,      -- positive
  currency         TEXT NOT NULL DEFAULT 'INR',
  channel          TEXT,               -- UPI | NEFT | IMPS | RTGS | CASH | BANK
  upi_type         TEXT,               -- P2M | P2A | null
  counterparty     TEXT,               -- cleaned merchant/payee
  counterparty_raw TEXT,               -- raw Transaction Info remainder
  category         TEXT,               -- resolved category
  ref              TEXT,               -- bank reference number
  source           TEXT NOT NULL,      -- 'gmail' | 'manual'
  gmail_id         TEXT,
  note             TEXT,
  created_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txn_ts  ON transactions(ts);
CREATE INDEX IF NOT EXISTS idx_txn_day ON transactions(day_ist);
CREATE INDEX IF NOT EXISTS idx_txn_dir ON transactions(direction);
CREATE INDEX IF NOT EXISTS idx_txn_cat ON transactions(category);

CREATE TABLE IF NOT EXISTS meta (       -- checkpoints & misc key/value
  k TEXT PRIMARY KEY,
  v TEXT
);

CREATE TABLE IF NOT EXISTS budgets (    -- monthly cap per category
  category    TEXT PRIMARY KEY,
  monthly_cap REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_map ( -- learned overrides (beats rule engine)
  raw_key   TEXT PRIMARY KEY,
  nice_name TEXT,
  category  TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions ( -- card autopays / recurring debits
  merchant   TEXT PRIMARY KEY,
  currency   TEXT NOT NULL DEFAULT 'INR',
  amount     REAL,
  last_seen  INTEGER,
  source     TEXT                          -- 'card_autopay' | 'recurring'
);

CREATE TABLE IF NOT EXISTS alerts_sent ( -- dedup for anomaly/budget pings
  k  TEXT PRIMARY KEY,
  ts INTEGER
);

CREATE TABLE IF NOT EXISTS bills ( -- recurring bills to remind about (paid = matched live from the ledger)
  id         TEXT PRIMARY KEY,   -- slug
  name       TEXT NOT NULL,
  match_str  TEXT,               -- counterparty substring used to auto-detect payment
  amount     REAL,               -- typical amount
  due_day    INTEGER,            -- day of month it's due (1-31)
  category   TEXT,
  kind       TEXT DEFAULT 'bill', -- 'bill' = you actively pay (recharge/utility); 'subscription' = auto-debits
  next_due   TEXT,               -- YYYY-MM-DD read from a merchant email; overrides the due_day estimate
  active     INTEGER DEFAULT 1,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS sms_raw ( -- every forwarded SMS (audit + parser tuning)
  id     TEXT PRIMARY KEY,
  ts     INTEGER,
  sender TEXT,
  body   TEXT,
  parsed INTEGER DEFAULT 0,   -- 1 if it produced a transaction
  note   TEXT                 -- 'unparsed' | 'dup-of-email' | null
);
