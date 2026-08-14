// Offline proof that the parser + categoriser match the REAL Axis templates
// (bodies below are lightly redacted copies of actual alert emails).
// Run: node test/parser.test.mjs
import { parseAlert, parseCardAutopay, istParts } from '../src/parser.js';
import { categorize, prettyName } from '../src/categorize.js';

let pass = 0, fail = 0;
const eq = (got, want, label) => {
  const ok = got === want;
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

const S = [
  { gmailId: 'g1', subject: 'INR 300.00 was debited from your A/c no. XXXX.',
    body: `12-08-2026 Dear Appalla Jayanth, Here's the summary of your transaction: Amount Debited: INR 300.00 Account Number: XXNNNN Date & Time: 12-08-26, 07:52:47 IST Transaction Info: UPI/P2M/222631984403/Idealprepaid India If this transaction was not initiated by you: To block UPI: SMS BLOCKUPI to +919951860002 Call us at: 18001035577` },
  { gmailId: 'g2', subject: 'INR 785.00 was credited to your A/c.',
    body: `12-08-2026 Dear Appalla Jayanth, Here's the summary of your transaction: Amount Credited: INR 785.00 Account Number: XXNNNN Date & Time: 12-08-26, 14:31:09 IST Transaction Info: UPI/P2A/178572662246/PayU/UTIB/Makemytr Feel free to connect with us for any clarification. Call us at: 18001035577` },
  { gmailId: 'g3', subject: 'INR 16000.00 was debited from your A/c no. XXXX.',
    body: `09-08-2026 Dear Appalla Jayanth, Here's the summary of your transaction: Amount Debited: INR 16000.00 Account Number: XXNNNN Date & Time: 09-08-26, 18:22:53 IST Transaction Info: UPI/P2M/263402547141/Nandus mens PG If this transaction was not initiated by you:` },
  { gmailId: 'g4', subject: 'Credit transaction alert for Axis Bank A/c',
    body: `04-08-2026 Dear Appalla Jayanth, Thank you for banking with us. We wish to inform you that your A/c no. XXXX has been credited with INR 100000.00 on 04-08-2026 at 19:04:22 IST by NEFT/SBIN426216377184/CITA. To check your available balance, please click here.` },
  { gmailId: 'g5', subject: 'AXIS BANK : Statement for August 2026',
    body: `Axis Bank Dear MR APPALLA JAYANTH, We would like to thank you for opting for E-Statements and helping us in our endeavour to be more environment friendly.` },
  { gmailId: 'g6', subject: 'AutoPay for Anthropic: ACTIVATED',
    body: `14-08-2026 Dear Customer, Here's the summary of your successful AutoPay transaction: Transaction Amount: USD 118.00 Merchant Name: Anthropic AutoPay ID: YbA8NkKlTg Axis Bank Card No. XXNNNN Max Limit: USD 118.00` },
  { gmailId: 'g7', subject: 'Notification from Axis Bank',
    body: `19-06-2026 Dear Customer, Thank you for banking with us. Auto Pay of INR 393.53 for RAILWAY has been processed on your Axis Bank Card no. XX3026. Manage Auto Pay with ID rC1L89.` },
];

// --- g1: UPI P2M debit (a recharge) ---
const t1 = parseAlert(S[0]);
eq(t1.direction, 'debit', 'g1 direction');
eq(t1.amount, 300, 'g1 amount');
eq(t1.channel, 'UPI', 'g1 channel');
eq(t1.upi_type, 'P2M', 'g1 upi_type');
eq(t1.counterparty, 'Idealprepaid India', 'g1 merchant');
eq(t1.day_ist, '2026-08-12', 'g1 day (IST)');
eq(t1.ts_ist, '2026-08-12 07:52:47', 'g1 timestamp (IST)');
eq(categorize(t1), 'recharge', 'g1 category');

// --- g2: UPI P2A credit ---
const t2 = parseAlert(S[1]);
eq(t2.direction, 'credit', 'g2 direction');
eq(t2.amount, 785, 'g2 amount');
eq(t2.upi_type, 'P2A', 'g2 upi_type');
eq(categorize(t2), 'income', 'g2 category (inbound=income)');

// --- g3: big UPI P2M debit (rent) ---
const t3 = parseAlert(S[2]);
eq(t3.amount, 16000, 'g3 amount');
eq(t3.counterparty, 'Nandus mens PG', 'g3 merchant');
eq(categorize(t3), 'rent', 'g3 category');

// --- g4: NEFT credit (salary-size) ---
const t4 = parseAlert(S[3]);
eq(t4.direction, 'credit', 'g4 direction');
eq(t4.amount, 100000, 'g4 amount');
eq(t4.channel, 'NEFT', 'g4 channel');
eq(t4.day_ist, '2026-08-04', 'g4 day (IST)');
eq(categorize(t4), 'income', 'g4 category');

// --- g5: statement → not a transaction ---
eq(parseAlert(S[4]), null, 'g5 statement ignored');

// --- g6: USD card AutoPay with a real Transaction Amount → a charge (spend) ---
eq(parseAlert(S[5]), null, 'g6 USD autopay not an A/c txn');
const c6 = parseCardAutopay(S[5]);
eq(c6.currency, 'USD', 'g6 autopay currency');
eq(c6.amount, 118, 'g6 autopay amount');
eq(c6.merchant, 'Anthropic', 'g6 autopay merchant');
eq(c6.charge, true, 'g6 USD autopay with amount>0 is a real charge');

// --- g8: $0 setup pre-auth → NOT a charge (no money moved) ---
const c8 = parseCardAutopay({ gmailId: 'g8', subject: 'AutoPay for Foo: ACTIVATED',
  body: "Here's the summary of your successful AutoPay transaction: Transaction Amount: USD 0.00 Merchant Name: Foo AutoPay ID: ZZ Max Limit: USD 20.00" });
eq(c8.charge, false, 'g8 $0 pre-auth is not a charge');

// --- g7: INR card autopay PROCESSED → a real charge (counts as CARD spend) ---
eq(parseAlert(S[6]), null, 'g7 card autopay not an A/c txn');
const c7 = parseCardAutopay(S[6]);
eq(c7.amount, 393.53, 'g7 autopay amount');
eq(c7.merchant, 'RAILWAY', 'g7 autopay merchant');
eq(c7.charge, true, 'g7 processed autopay is a charge');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
