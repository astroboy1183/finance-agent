// timeutil.js — IST-aware time ranges. Everything the reports/dashboard ask for
// ("yesterday", "this month", "last 100 days") resolves to a [from, to) epoch
// pair here, so day boundaries never drift across the UTC/IST line.
import { istToEpoch, istParts } from './parser.js';

export const DAY = 86400;
export const nowEpoch = () => Math.floor(Date.now() / 1000);
export const istDay = (epoch) => istParts(epoch).day;

export function dayStart(dayStr) {
  const [y, m, d] = dayStr.split('-').map(Number);
  return istToEpoch(y, m, d, 0, 0, 0);
}

export function yesterday(now = nowEpoch()) {
  const t = dayStart(istDay(now));
  return { from: t - DAY, to: t, label: istDay(now - DAY) };
}
export function today(now = nowEpoch()) {
  return { from: dayStart(istDay(now)), to: now + 1, label: istDay(now) };
}
export function lastDays(n, now = nowEpoch()) {
  return { from: now - n * DAY, to: now + 1, label: `last ${n} days` };
}
export function thisMonth(now = nowEpoch()) {
  const [y, m] = istDay(now).split('-').map(Number);
  return { from: istToEpoch(y, m, 1, 0, 0, 0), to: now + 1, label: `${y}-${String(m).padStart(2, '0')}` };
}
export function prevMonth(now = nowEpoch()) {
  let [y, m] = istDay(now).split('-').map(Number);
  let py = y, pm = m - 1;
  if (pm === 0) { pm = 12; py--; }
  return { from: istToEpoch(py, pm, 1, 0, 0, 0), to: istToEpoch(y, m, 1, 0, 0, 0),
           label: `${py}-${String(pm).padStart(2, '0')}` };
}
export function lastWeek(now = nowEpoch()) { return lastDays(7, now); }

// Indian-grouped rupee formatting (no Intl locale dependence in Workers).
export function inr(n) {
  const neg = n < 0;
  const x = Math.abs(Math.round((Number(n) + Number.EPSILON) * 100) / 100);
  const [i, f] = x.toFixed(2).split('.');
  const last3 = i.slice(-3);
  let rest = i.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${neg ? '-₹' : '₹'}${grouped}${f === '00' ? '' : '.' + f}`;
}

export function daysInMonthSoFar(now = nowEpoch()) {
  return Number(istDay(now).split('-')[2]);
}

// Rough USD→INR for DISPLAY of foreign subscriptions only. Real spend always
// uses the exact INR from the bank's charge alert — never this.
export const USD_INR = 87.5;
export function subAmount(currency, amount) {
  if (!currency || currency === 'INR') return inr(amount);
  if (currency === 'USD') return `USD ${amount} (~${inr(amount * USD_INR)})`;
  return `${currency} ${amount}`;
}
