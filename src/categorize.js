// categorize.js — deterministic, rule-based merchant categorisation.
//
// Cheap and offline: a keyword map covers the common India merchants, P2A
// (person-to-account) UPI defaults to "transfer". Anything unmatched becomes
// "uncategorized" — the user can fix it once via chat ("categorise X as food")
// and the correction is remembered in the merchant_map table, which overrides
// these rules on future transactions.

const RULES = [
  ['food',          /swiggy|zomato|restaurant|\bhotel\b|cafe|bakery|domino|kfc|mcdonald|biryani|foods?|dhaba|pizza|burger|eatery|mess|canteen|tiffin|new green ash/i],
  ['groceries',     /bigbasket|blinkit|zepto|dmart|d-?mart|grocery|kirana|supermarket|reliance fresh|more retail|jiomart|instamart/i],
  ['travel',        /irctc|makemytr|make ?my ?trip|redbus|\bola\b|uber|rapido|indigo|\bair ?asia|vistara|spicejet|railway|petrol|diesel|fuel|\bhp\b|iocl|indian oil|bharat petroleum|bpcl|hpcl|\btoll\b|metro|namma/i],
  ['recharge',      /idealprepaid|recharge|\bjio\b|airtel|\bvi\b|vodafone|\bdth\b|prepaid|postpaid|mobikwik/i],
  ['shopping',      /amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|lifestyle|pantaloons|reliance digital/i],
  ['utilities',     /electricity|\bbescom\b|tsspdcl|water bill|gas bill|\bbill ?desk|broadband|\bwifi\b|\bact\b|hathway|jio ?fiber|tata ?power|adani/i],
  ['subscriptions', /netflix|spotify|prime video|hotstar|youtube|anthropic|openai|github|google ?(one|cloud)|icloud|adobe|notion|canva|subscription|membership/i],
  ['health',        /pharmacy|apollo|medplus|\bhospital\b|clinic|medical|diagnostic|\blab\b|1mg|pharmeasy|netmeds|practo/i],
  ['rent',          /\brent\b|\bpg\b\b|\blease\b|mens pg|womens pg|hostel|landlord/i],
  ['education',     /udemy|coursera|byju|unacademy|\bcollege\b|university|tuition|course|fees?/i],
  ['entertainment', /bookmyshow|pvr|inox|cinepolis|gaming|\bgame\b|steam/i],
];

// Normalise a merchant string into a stable key for the merchant_map table.
export function merchantKey(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ').slice(0, 4).join(' ');   // first few tokens — stable across truncation
}

// txn: parsed transaction. overrides: Map(merchantKey -> {category, nice_name}).
export function categorize(txn, overrides) {
  const key = merchantKey(txn.counterparty_raw || txn.counterparty);
  if (overrides && overrides.has(key) && overrides.get(key).category)
    return overrides.get(key).category;

  if (txn.direction === 'credit') {
    if (txn.amount >= 15000) return 'income';
    return 'income';                       // all inbound money is income/refund
  }
  const hay = `${txn.counterparty_raw || ''} ${txn.counterparty || ''}`;
  for (const [cat, re] of RULES) if (re.test(hay)) return cat;
  if (txn.upi_type === 'P2A') return 'transfer';   // sent to a person
  return 'uncategorized';
}

export function prettyName(txn, overrides) {
  const key = merchantKey(txn.counterparty_raw || txn.counterparty);
  if (overrides && overrides.has(key) && overrides.get(key).nice_name)
    return overrides.get(key).nice_name;
  const n = (txn.counterparty || '').trim();
  if (!n) return txn.channel === 'UPI' ? 'UPI transfer' : (txn.channel || 'Bank');
  // Title-case-ish, keep short.
  return n.replace(/\s+/g, ' ').slice(0, 40);
}
