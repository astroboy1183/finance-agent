// gmail.js — read-only Gmail access from the Worker, reusing the existing
// gmail.readonly OAuth grant (client id/secret + refresh token stored as
// Worker secrets). No Google SDK: we mint an access token per run and hit the
// Gmail REST API with fetch.

export async function getAccessToken(env) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GMAIL_CLIENT_ID,
      client_secret: env.GMAIL_CLIENT_SECRET,
      refresh_token: env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  if (!r.ok) throw new Error(`gmail token ${r.status}: ${await r.text()}`);
  return (await r.json()).access_token;
}

export async function listMessageIds(token, q, max = 100) {
  const ids = [];
  let pageToken = '';
  do {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=100${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`gmail list ${r.status}: ${await r.text()}`);
    const j = await r.json();
    for (const m of j.messages || []) ids.push(m.id);
    pageToken = j.nextPageToken || '';
  } while (pageToken && ids.length < max);
  return ids.slice(0, max);
}

export async function getMessage(token, id) {
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`gmail get ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const headers = {};
  for (const h of j.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
  return {
    gmailId: id,
    subject: headers.subject || '',
    from: headers.from || '',
    internalDate: j.internalDate,
    body: extractBody(j.payload),
  };
}

function b64urlDecode(data) {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function stripHtml(s) {
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function extractBody(payload) {
  const parts = [];
  (function walk(p) {
    if (!p) return;
    if (p.mimeType?.startsWith('text/') && p.body?.data) parts.push([p.mimeType, b64urlDecode(p.body.data)]);
    for (const s of p.parts || []) walk(s);
  })(payload);
  const plain = parts.find(([m]) => m === 'text/plain');
  if (plain) return plain[1];
  const html = parts.find(([m]) => m === 'text/html');
  if (html) return stripHtml(html[1]);
  return '';
}
