// parser.js — deterministic parser for Axis Bank / UPI transaction-alert emails.
//
// No model is involved here: money, dates and references are extracted with
// regexes tuned to the exact Axis templates. Returns a normalised transaction
// object, or null for non-transactional mail (statements, offers, autopay
// activations, etc). Categorisation and merchant prettifying happen elsewhere.

const AMT = String.raw`([\d,]+\.\d{2})`;

export function toNum(s) {
  return parseFloat(String(s).replace(/,/g, ''));
}

// ---- IST time helpers -------------------------------------------------------
// The bank stamps every alert in IST (UTC+5:30). We store a real UTC epoch plus
// pre-rendered IST strings so grouping "by day" never drifts across midnight.
const IST_OFFSET_S = (5 * 60 + 30) * 60;

export function istToEpoch(y, mon, d, hh, mm, ss) {
  return Math.floor(Date.UTC(y, mon - 1, d, hh, mm, ss) / 1000) - IST_OFFSET_S;
}

export function istParts(epoch) {
  const d = new Date((epoch + IST_OFFSET_S) * 1000);
  const p = (n) => String(n).padStart(2, '0');
  const day = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  return { day, time, ist: `${day} ${time}` };
}

// ---- field extractors -------------------------------------------------------
function extractAmountDirection(subject, body) {
  let m;
  if ((m = body.match(new RegExp(`Amount\\s+Debited:\\s*INR\\s*${AMT}`, 'i'))))
    return { direction: 'debit', amount: toNum(m[1]) };
  if ((m = body.match(new RegExp(`Amount\\s+Credited:\\s*INR\\s*${AMT}`, 'i'))))
    return { direction: 'credit', amount: toNum(m[1]) };
  if ((m = body.match(new RegExp(`credited with INR\\s*${AMT}`, 'i'))))
    return { direction: 'credit', amount: toNum(m[1]) };
  if ((m = body.match(new RegExp(`debited with INR\\s*${AMT}`, 'i'))))
    return { direction: 'debit', amount: toNum(m[1]) };
  // last resort: the subject line itself carries both
  if ((m = subject.match(new RegExp(`INR\\s*${AMT}\\s*was\\s*(debited|credited)`, 'i'))))
    return { direction: m[2].toLowerCase(), amount: toNum(m[1]) };
  return null;
}

function extractTime(body, internalDateMs) {
  let m;
  // "Date & Time: 12-08-26, 07:52:47 IST"  (DD-MM-YY)
  if ((m = body.match(/Date\s*&\s*Time:\s*(\d{2})-(\d{2})-(\d{2}),?\s*(\d{2}):(\d{2}):(\d{2})/i)))
    return istToEpoch(2000 + +m[3], +m[2], +m[1], +m[4], +m[5], +m[6]);
  // NEFT: "on 04-08-2026 at 19:04:22 IST"  (DD-MM-YYYY)
  if ((m = body.match(/on\s*(\d{2})-(\d{2})-(\d{4})\s*at\s*(\d{2}):(\d{2}):(\d{2})/i)))
    return istToEpoch(+m[3], +m[2], +m[1], +m[4], +m[5], +m[6]);
  // fallback to Gmail's internalDate
  if (internalDateMs) return Math.floor(Number(internalDateMs) / 1000);
  return null;
}

function extractInfo(body) {
  // "Transaction Info: UPI/P2M/222631984403/Idealprepaid India"
  let m = body.match(/Transaction\s*Info:\s*(.+?)(?:\s+If this transaction|\s+Feel free|\s+Call us|\s+To block|\s+\*\*\*\*|$)/i);
  if (m) {
    const raw = m[1].trim();
    const u = raw.match(/^UPI\/(P2M|P2A|P2P|P2PA)\/(\w+)\/(.+)$/i);
    if (u) {
      const rest = u[3].trim();
      return { channel: 'UPI', upi_type: u[1].toUpperCase(), ref: u[2],
               counterparty: rest.split('/')[0].trim(), counterparty_raw: rest };
    }
    return { channel: 'UPI', upi_type: null, ref: null,
             counterparty: raw, counterparty_raw: raw };
  }
  // NEFT / IMPS / RTGS: "by NEFT/SBIN426216377184/CITA"
  m = body.match(/by\s+(NEFT|IMPS|RTGS)\/([A-Za-z0-9]+)\/([^\s.]+)/i);
  if (m)
    return { channel: m[1].toUpperCase(), upi_type: null, ref: m[2],
             counterparty: m[3].trim(), counterparty_raw: m[0].replace(/^by\s+/i, '') };
  return { channel: null, upi_type: null, ref: null, counterparty: null, counterparty_raw: null };
}

// ---- main -------------------------------------------------------------------
// msg = { subject, body, gmailId, internalDate }  (body = decoded plain text)
export function parseAlert(msg) {
  const subject = msg.subject || '';
  const body = (msg.body || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  // Skip obvious non-transaction mail early.
  if (/\b(e-?statement|statement for|loan offer|special offer|activated|otp|one time password)\b/i.test(subject)
      && !/was (debited|credited)/i.test(subject))
    return null;

  const ad = extractAmountDirection(subject, body);
  if (!ad || !(ad.amount > 0)) return null;

  const ts = extractTime(body, msg.internalDate);
  if (!ts) return null;

  const info = extractInfo(body);
  const { day, ist } = istParts(ts);

  return {
    id: msg.gmailId,                 // dedup key: one alert email == one txn
    ts,
    ts_ist: ist,
    day_ist: day,
    direction: ad.direction,
    amount: ad.amount,
    currency: 'INR',
    channel: info.channel || 'BANK',
    upi_type: info.upi_type,
    counterparty: info.counterparty,
    counterparty_raw: info.counterparty_raw,
    ref: info.ref,
    source: 'gmail',
    gmail_id: msg.gmailId,
  };
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// Card AutoPay emails. Two shapes matter:
//   1. "Auto Pay of INR X for MERCHANT has been processed on your ... Card" —
//      an ACTUAL charge with the exact rupee amount. `charge: true`. The ingester
//      records these as CARD debits (there's no separate card-bill debit in this
//      account's alerts, so no double-count).
//   2. "successful AutoPay transaction: Transaction Amount: USD/INR X Merchant
//      Name: NAME AutoPay ID: …" — the AutoPay summary. When the subject says
//      ACTIVATED it's just the mandate/limit being set (no money moved yet);
//      a USD amount can't be counted in ₹ spend regardless. Tracked as a
//      subscription only.
// "Upcoming / to be debited" notices don't match either and are ignored.
export function parseCardAutopay(msg) {
  const body = clean(msg.body);
  const subject = msg.subject || '';
  let m;
  if ((m = body.match(new RegExp(`Auto ?Pay of INR\\s*${AMT}\\s*for\\s+(.+?)\\s+has been processed`, 'i'))))
    return { currency: 'INR', amount: toNum(m[1]), merchant: clean(m[2]),
             charge: true, kind: 'card_autopay', gmail_id: msg.gmailId };
  if ((m = body.match(new RegExp(`successful AutoPay transaction:.*?Transaction Amount:\\s*(USD|INR)\\s*${AMT}\\s*Merchant Name:\\s*([A-Za-z0-9 .&'-]{2,40}?)\\s*AutoPay ID`, 'i')))) {
    const currency = m[1].toUpperCase();
    const amount = toNum(m[2]);       // the amount actually charged (0 = a setup pre-auth, no money moved)
    return { currency, amount, merchant: clean(m[3]),
             charge: amount > 0,      // money moved → real spend, in any currency
             kind: 'card_autopay', gmail_id: msg.gmailId };
  }
  return null;
}

// Parse a bank transaction SMS into a normalized transaction, or null. First
// pass tuned to common Axis SMS shapes; refine against real samples. Catches the
// card charges (Udemy, international) that email never sends. Returns partial —
// the ingester fills ts/category and cross-source-dedupes against email.
export function parseSms(text) {
  const s = (text || '').replace(/\r/g, '');
  if (!s.trim()) return null;
  const flat = s.replace(/\s+/g, ' ').trim();

  // Skip anything that isn't a completed money movement: OTPs, mandate setup /
  // reminders, PIN/security, account linking, promos, statements.
  if (/\b(otp|one[- ]time password|verification code)\b/i.test(flat)) return null;
  if (/\b(mandate|will be debited|upcoming|has been successfully created|is being linked|account is being linked|mobile no\.? update|incorrect pin|set the upi pin|security question|one step away|pre-?approved|not interested|apply now|e-?statement|register|reward|cashback|% ?off|loan offer)\b/i.test(flat)) return null;

  // amount + direction
  let m = flat.match(/INR\s*([\d,]+(?:\.\d{1,2})?)\s*(debited|credited)/i)
       || flat.match(/(debited|credited)\s*(?:with|by)?\s*INR\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return null;
  let amount, direction;
  if (/^INR/i.test(m[0])) { amount = toNum(m[1]); direction = m[2]; } else { direction = m[1]; amount = toNum(m[2]); }
  if (!(amount > 0)) return null;
  direction = /credited/i.test(direction) ? 'credit' : 'debit';

  const isCard = /BLOCKCARD/i.test(flat) || /on your Axis Bank Card/i.test(flat) || /Auto ?Pay of INR/i.test(flat);
  let channel = isCard ? 'CARD' : (/UPI\//i.test(s) ? 'UPI' : /NEFT/i.test(flat) ? 'NEFT' : /IMPS/i.test(flat) ? 'IMPS' : /RTGS/i.test(flat) ? 'RTGS' : 'BANK');
  let counterparty = null, counterparty_raw = null, upi_type = null, ref = null, ts = null;

  let u;
  if ((u = s.match(/UPI\/(P2M|P2A|P2P|P2PA)\/(\w+)\/([^\n\r]+)/i))) {          // UPI account txn
    upi_type = u[1].toUpperCase(); ref = u[2]; counterparty_raw = u[3].trim();
    counterparty = counterparty_raw.replace(/\s{2,}/g, ' ').trim();
  } else if ((m = flat.match(/on\s+(.+?)\s+(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s*IST/i))) { // card confirmation
    counterparty = m[1].replace(/\s{2,}/g, ' ').trim(); counterparty_raw = counterparty;
    ts = istToEpoch(+m[4], +m[3], +m[2], +m[5], +m[6], +m[7]);
  } else if ((m = flat.match(/Auto ?Pay of INR\s*[\d,.]+\s*for\s+(.+?)\s+has been processed/i))) { // card autopay
    counterparty = m[1].trim(); counterparty_raw = counterparty;
  } else if ((m = flat.match(/Info\s*[-:]\s*(NEFT|IMPS|RTGS)\/([A-Za-z0-9]+)\/([^.\s]+)/i))) { // NEFT/IMPS credit
    channel = m[1].toUpperCase(); ref = m[2]; counterparty = m[3].trim(); counterparty_raw = m[0].replace(/^Info\s*[-:]\s*/i, '');
  }

  if (!ts) {   // "15-02-26, 16:45:30"  or  "04-08-26 at 19:04:22"
    const d = s.match(/(\d{2})-(\d{2})-(\d{2,4})[, ]+(?:at\s+)?(\d{2}):(\d{2}):(\d{2})/);
    if (d) { const yy = d[3].length === 2 ? 2000 + +d[3] : +d[3]; ts = istToEpoch(yy, +d[2], +d[1], +d[4], +d[5], +d[6]); }
  }
  return { amount, direction, channel, upi_type, counterparty, counterparty_raw, ref, ts };
}
