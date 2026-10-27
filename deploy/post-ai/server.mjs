// CYBERHOOD post writer: drafts an X post on a chosen topic with OpenAI. Keeps the API key on the server.
// The website calls POST /api/post (nginx proxies it here). No dependencies; Node 18+.
//
// Env (put the key in /etc/cyberhood/post-ai.env, never in the repo or the website):
//   OPENAI_API_KEY   required
//   OPENAI_MODEL     default gpt-4o-mini
//   PORT             default 8790
//   ALLOWED_ORIGINS  comma list, default https://cyberhood.xyz,https://www.cyberhood.xyz
//   OPENAI_BASE      default https://api.openai.com/v1 (tests point it at a stub)
import http from 'node:http';

const KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const PORT = +(process.env.PORT || 8790);
const BASE = (process.env.OPENAI_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
const ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'https://cyberhood.xyz,https://www.cyberhood.xyz').split(',').map((s) => s.trim()).filter(Boolean));
if (!KEY) console.warn('post-ai: OPENAI_API_KEY is not set; every request falls back to the site templates');

/* Topics are fixed here so the endpoint can't be used as a free general-purpose OpenAI proxy */
export const TOPICS = {
  hub: 'Neon City, the 3D co-op hub where Hunters meet, trade and watch drops on giant LED screens',
  contracts: 'side-scrolling contract stages with a boss at the end of every map',
  siege: 'the 100 v 100 siege of the IXO Ice Citadel: break three shield generators, ram the gate, hold the core',
  raid: 'the 4-10 player raid on the Electric Leviathan, breaking its scales from the rooftops',
  kart: 'Neon Kart racing: drift until the sparks turn orange, release for turbo, fire items',
  duel: '1 v 1 arena duels up eight rival ranks with jab, hook, roundhouse and sweep combos',
  genesis: 'Genesis pixel-art weapons, armor and relics earned by playing, 444 items in Season 0',
  hook: 'the on-chain economy built on a Uniswap v4 hook where rewards follow play activity, not holdings',
  season: 'Season 0 early access and the Hunter Pass tied to the player wallet',
};

const GAME = 'CYBERHOOD is a cyberpunk loot-hunting game that runs in the browser on desktop and phone. Hunters meet in Neon City, a co-op hub, then step through gates into contracts, a 100 v 100 siege, a raid boss, kart races and arena duels. The game drops loot, not tokens. Early access for Season 0 is open and gives a Hunter Pass tied to the wallet.';

export function buildMessages({ topic, handle }) {
  return [
    { role: 'system', content: `You write short, natural posts for X (Twitter) for gamers. ${GAME}` },
    { role: 'user', content: [
      `Write one X post by a player who just joined CYBERHOOD early access. Topic: ${TOPICS[topic]}.`,
      'Language: English.',
      'At most 200 characters. First person, excited but genuine, at most 2 emoji.',
      handle ? `Mention @${handle} exactly once.` : 'Do not mention any account.',
      'No hashtags and no links (they are added after).',
      'Never promise money, profit, prices, token amounts, airdrops or yield.',
      'Reply with only the post text.',
    ].join('\n') },
  ];
}

/* Small in-memory rate limit per IP: 6 per minute, 40 per day */
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip) || { m: [], d: [] };
  h.m = h.m.filter((t) => now - t < 60_000);
  h.d = h.d.filter((t) => now - t < 86_400_000);
  if (h.m.length >= 6 || h.d.length >= 40) { hits.set(ip, h); return true; }
  h.m.push(now); h.d.push(now); hits.set(ip, h);
  if (hits.size > 50_000) hits.clear();
  return false;
}

const clean = (s) => String(s || '').replace(/^["“'\s]+|["”'\s]+$/g, '').replace(/https?:\/\/\S+/g, '').replace(/(^|\s)#\w+/g, '').trim().slice(0, 280);

async function draft(body) {
  const r = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages: buildMessages(body), temperature: 0.9, max_tokens: 160 }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`openai ${r.status}`);
  const j = await r.json();
  return clean(j.choices?.[0]?.message?.content);
}

function send(res, code, obj, origin) {
  const h = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  if (origin && ORIGINS.has(origin)) Object.assign(h, { 'access-control-allow-origin': origin, vary: 'Origin' });
  res.writeHead(code, h);
  res.end(JSON.stringify(obj));
}

export const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    if (!ORIGINS.has(origin)) { res.writeHead(403); return res.end(); }
    res.writeHead(204, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600', vary: 'Origin' });
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/api/post/health') return send(res, 200, { ok: true, model: MODEL, key: !!KEY });
  if (req.method !== 'POST' || !req.url.startsWith('/api/post')) return send(res, 404, { error: 'not found' });
  // Browsers always send Origin on cross-site POST; same-site requests through nginx may omit it
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: 'origin' });
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  if (limited(ip)) return send(res, 429, { error: 'slow down' }, origin);
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 2048) req.destroy(); });
  req.on('end', async () => {
    let b;
    try { b = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'json' }, origin); }
    const body = {
      topic: Object.hasOwn(TOPICS, b.topic) ? b.topic : 'season',
      handle: String(b.handle || '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15),
    };
    if (!KEY) return send(res, 503, { error: 'not configured' }, origin);
    try {
      const text = await draft(body);
      if (!text) return send(res, 502, { error: 'empty' }, origin);
      send(res, 200, { text, topic: body.topic }, origin);
    } catch (e) {
      console.error('post-ai', e.message);
      send(res, 502, { error: 'upstream' }, origin);
    }
  });
});

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  server.listen(PORT, '127.0.0.1', () => console.log(`post-ai on 127.0.0.1:${PORT} · model ${MODEL}`));
}
