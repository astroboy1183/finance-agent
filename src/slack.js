// slack.js — outbound (chat.postMessage) + inbound request verification for the
// Slack app. Replaces the Telegram layer. Messages use Slack mrkdwn.
import { getMeta } from './ledger.js';

// Slack mrkdwn only needs &, <, > escaped in text.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const b = (s) => `*${s}*`;
export const i = (s) => `_${s}_`;

// Where proactive messages go: the DM channel captured on first message, or an
// explicit SLACK_CHANNEL override.
export async function defaultChannel(env) {
  return env.SLACK_CHANNEL || (await getMeta(env.DB, 'slack_dm_channel', null));
}

export async function send(env, text, opts = {}) {
  const channel = opts.channel || (await defaultChannel(env));
  if (!channel) { console.log('slack: no target channel yet (DM the bot once)'); return false; }
  const r = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${env.SLACK_BOT_TOKEN}` },
    body: JSON.stringify({ channel, text, mrkdwn: true, unfurl_links: false, unfurl_media: false }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) console.log('slack send failed:', JSON.stringify(j));
  return !!j.ok;
}

function timingSafeEq(a, bb) {
  if (a.length !== bb.length) return false;
  let out = 0;
  for (let k = 0; k < a.length; k++) out |= a.charCodeAt(k) ^ bb.charCodeAt(k);
  return out === 0;
}

// Verify Slack's v0 request signature (HMAC-SHA256 over `v0:ts:rawBody`).
export async function verifySlack(env, ts, rawBody, sig) {
  if (!env.SLACK_SIGNING_SECRET || !ts || !sig) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false; // replay window
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.SLACK_SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`v0:${ts}:${rawBody}`));
  const hex = [...new Uint8Array(mac)].map((x) => x.toString(16).padStart(2, '0')).join('');
  return timingSafeEq(`v0=${hex}`, sig);
}
