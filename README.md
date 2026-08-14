# finance-agent

Personal finance agent. Reads Axis Bank + UPI transaction alerts from Gmail,
builds a ledger in Cloudflare D1, and surfaces it three ways:

- **Morning report** (06:xx IST) — yesterday's spend by category + month-to-date.
- **Slack chat** — ask anything ("how much on food last 10 days?"), log cash
  ("add 200 cash lunch"), set budgets, fix categories.
- **Dashboard** — passphrase-gated, spend over 7 / 10 / 20 / 30 / 100-day windows.

Plus real-time large-debit / new-merchant / budget-breach alerts, subscription
tracking, and weekly (Sun) / monthly (1st) rollups.

## Architecture

One Cloudflare Worker + one D1 database + one Slack app. A single hourly cron
(`5 * * * *`) ingests new emails; the 06:xx IST run also fires the briefings
(dedup-guarded so each sends once). Money math is 100% SQL — the model
(Claude Haiku) only writes the one-line narrative and routes chat messages to a
fixed set of intents (never returns numbers or SQL).

```
Gmail (Axis alerts) → parser → categorise → D1 ledger ─┬→ morning/weekly/monthly → Slack
                                                        ├→ chat (Slack Events API)
                                                        └→ dashboard (GET /)
```

Card AutoPays (incl. USD, e.g. Anthropic) are tracked as **subscriptions**, not
counted in INR spend — the card bill settles from the A/c as one debit, so
counting them would double-count.

## Layout

- `src/parser.js` — deterministic Axis/UPI/NEFT parser (+ card-autopay detector).
- `src/categorize.js` — rule-based merchant→category; learned overrides win.
- `src/ledger.js` — all D1 reads/writes (every aggregate is SQL).
- `src/gmail.js` — OAuth refresh + Gmail REST (read-only).
- `src/ingest.js` — hourly pipeline (rolling window; date-range for backfill).
- `src/anomaly.js` — real-time large-debit / new-merchant / budget alerts.
- `src/reports.js` — morning / weekly / monthly briefings.
- `src/chat.js` — Slack event handling + intent routing.
- `src/slack.js` — chat.postMessage + request-signature verification.
- `src/dashboard.js` — self-contained HTML dashboard.
- `src/index.js` — Worker entry (fetch + scheduled).
- `schema.sql`, `wrangler.toml`, `test/parser.test.mjs`.

## Endpoints

- `GET /` — dashboard (passphrase → cookie).
- `POST /slack/events` — Slack Events API (signature-verified).
- `GET /health` — `{ ok, last_ingest, slack_ready }`.
- `GET /ingest?key=…[&days=N | &after=YYYY/MM/DD&before=YYYY/MM/DD][&nochecks=1]`.
- `GET /report?key=…&type=morning|weekly|monthly`.

## Secrets (Worker)

`GMAIL_CLIENT_ID` `GMAIL_CLIENT_SECRET` `GMAIL_REFRESH_TOKEN` `ANTHROPIC_API_KEY`
`SLACK_BOT_TOKEN` `SLACK_SIGNING_SECRET` `SLACK_CHANNEL`(optional) `DASH_PASS`
`INGEST_KEY`. Gmail creds reuse the existing `gmail.readonly` grant. Nothing
sensitive is committed (see `.gitignore`; `.dev.vars.example` lists the names).

## Dev

```
npm test                    # parser tests against real templates
npx wrangler dev            # local (needs .dev.vars)
npx wrangler deploy         # publish
wrangler d1 execute finance --remote --file=schema.sql
```
