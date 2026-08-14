// claude.js — thin Anthropic Messages API helper. Used only where judgement
// helps: the report one-liner and chat intent routing. All money math stays in
// code. Defaults to Haiku to keep the agent cheap.
export async function askClaude(env, system, user, opts = {}) {
  const { max_tokens = 500, model = 'claude-haiku-4-5-20251001' } = opts;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error(`claude ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return (j.content || []).map((c) => c.text || '').join('').trim();
}

// Parse a JSON object out of a model reply that may be fenced or chatty.
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(raw.slice(s, e + 1)); } catch { return null; }
}
