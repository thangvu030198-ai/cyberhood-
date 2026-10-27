// CYBERHOOD early-access registrations on your own server (replaces the artifact-only "Edit site · Signups").
//   POST /api/signup          the website sends each finished Hunter Pass here
//   GET  /admin               password-protected list (HTTP Basic auth)
//   GET  /admin/signups.csv   CSV export
// No dependencies; Node 18+. Data: one JSON line per write in DATA_FILE (latest line per wallet wins).
//
// Env: ADMIN_PASSWORD (required for /admin) · ADMIN_USER (default admin) · PORT (8791)
//      DATA_FILE (/var/lib/cyberhood/signups.jsonl) · ALLOWED_ORIGINS (comma list)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { recoverAddress, sameAddress } from './ethsig.mjs';

const PORT = +(process.env.PORT || 8791);
const DATA = process.env.DATA_FILE || '/var/lib/cyberhood/signups.jsonl';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ORIGINS = new Set((process.env.ALLOWED_ORIGINS || 'https://cyberhood.xyz,https://www.cyberhood.xyz').split(',').map((s) => s.trim()).filter(Boolean));

/* ---------- storage ---------- */
const rows = new Map(); // address(lowercase) -> record
function load() {
  if (!fs.existsSync(DATA)) return;
  for (const line of fs.readFileSync(DATA, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { const r = JSON.parse(line); rows.set(r.address.toLowerCase(), r); } catch { /* skip a torn last line */ }
  }
}
function persist(r) {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  fs.appendFileSync(DATA, JSON.stringify(r) + '\n', { mode: 0o600 });
}

/* ---------- validation ---------- */
const RE = {
  address: /^0x[0-9a-fA-F]{40}$/,
  x: /^[A-Za-z0-9_]{1,15}$/,
  postUrl: /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}(\?.*)?$/,
  accountId: /^CH-[0-9A-F]{4}-[0-9A-F]{4}$/,
  ref: /^H[A-Z0-9]{4,12}$/,
  signature: /^0x[0-9a-fA-F]{130}$/,
};
const str = (v, max) => String(v ?? '').slice(0, max);

/** The website asks the wallet to sign a message naming that wallet; accept only that, for this address */
export function verifySignature(address, message, signature) {
  if (!RE.signature.test(signature || '') || typeof message !== 'string' || message.length > 600) return false;
  if (!message.startsWith('CYBERHOOD Early Access') || !message.toLowerCase().includes(`wallet: ${address.toLowerCase()}`)) return false;
  return sameAddress(recoverAddress(message, signature), address);
}

export function clean(b) {
  if (!RE.address.test(b.address || '')) return { error: 'address' };
  if (!RE.x.test(b.x || '')) return { error: 'x' };
  if (!RE.postUrl.test(b.postUrl || '')) return { error: 'postUrl' };
  const verified = verifySignature(b.address, b.message, b.signature);
  return {
    address: b.address,
    accountId: RE.accountId.test(b.accountId || '') ? b.accountId : '',
    verified, // checked here from the signature, never trusted from the browser
    wallet: str(b.wallet, 40),
    chainId: str(b.chainId, 20),
    x: b.x,
    postUrl: b.postUrl,
    postText: str(b.postText, 600),
    ref: RE.ref.test(b.ref || '') ? b.ref : '',
    refBy: RE.ref.test(b.refBy || '') && b.refBy !== b.ref ? b.refBy : '',
    signature: verified ? b.signature : '',
    message: verified ? b.message : '',
  };
}

/* ---------- helpers ---------- */
const hits = new Map();
function limited(ip, max = 20, win = 3_600_000) {
  const now = Date.now();
  const h = (hits.get(ip) || []).filter((t) => now - t < win);
  if (h.length >= max) { hits.set(ip, h); return true; }
  h.push(now); hits.set(ip, h);
  if (hits.size > 50_000) hits.clear();
  return false;
}
function send(res, code, body, type = 'application/json', extra = {}) {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
const cors = (origin) => (origin && ORIGINS.has(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {});
function authed(req) {
  if (!ADMIN_PASSWORD) return false;
  const m = /^Basic (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const [u, ...rest] = Buffer.from(m[1], 'base64').toString().split(':');
  const want = Buffer.from(`${ADMIN_USER}:${ADMIN_PASSWORD}`), got = Buffer.from(`${u}:${rest.join(':')}`);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLS = ['createdAt', 'accountId', 'address', 'verified', 'wallet', 'x', 'postUrl', 'ref', 'refBy', 'referrals', 'updatedAt'];
function list() {
  const all = [...rows.values()].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const refCount = {};
  for (const r of all) if (r.refBy) refCount[r.refBy] = (refCount[r.refBy] || 0) + 1;
  return all.map((r) => ({ ...r, referrals: r.ref ? refCount[r.ref] || 0 : 0 }));
}
function csv() {
  // Leading =,+,-,@ would run as formulas in Excel/Sheets
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  return [COLS.join(','), ...list().map((r) => COLS.map((c) => cell(r[c])).join(','))].join('\n');
}
function adminPage() {
  const all = list();
  const verified = all.filter((r) => r.verified).length;
  const top = all.filter((r) => r.referrals).sort((a, b) => b.referrals - a.referrals).slice(0, 10);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>CYBERHOOD · Signups</title><style>
:root{color-scheme:dark}body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#07040f;color:#ece8f8}main{max-width:1200px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:22px;margin:0 0 4px}.sub{color:#a49cc8;margin:0 0 20px}.kpis{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px}
.kpis div{border:1px solid #2a2148;padding:12px 16px;min-width:140px}.kpis b{display:block;font-size:24px}.kpis span{color:#a49cc8;font-size:12px}
a{color:#22e6ff}.btn{display:inline-block;background:#ff2a8a;color:#fff;padding:10px 16px;text-decoration:none;font-weight:600;margin-bottom:20px}
.wrap{overflow-x:auto;border:1px solid #2a2148}table{border-collapse:collapse;width:100%;min-width:900px}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #1d1636;vertical-align:top}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#22e6ff;background:#110b22;position:sticky;top:0}.ok{color:#2fe38a}.no{color:#a49cc8}code{font-size:12px}
</style></head><body><main>
<h1>CYBERHOOD · Early access signups</h1><p class="sub">Wallet ✓ = the server checked the wallet signature itself.</p>
<div class="kpis"><div><b>${all.length}</b><span>Hunters registered</span></div><div><b>${verified}</b><span>Wallets verified</span></div><div><b>${all.filter((r) => r.refBy).length}</b><span>Joined by referral</span></div></div>
<a class="btn" href="/admin/signups.csv">Download CSV</a>
${top.length ? `<p class="sub">Top referrers: ${top.map((r) => `@${esc(r.x)} (${r.referrals})`).join(' · ')}</p>` : ''}
<div class="wrap"><table><thead><tr><th>Joined</th><th>Account</th><th>Wallet</th><th>X</th><th>Post</th><th>Ref</th><th>Invited</th></tr></thead><tbody>
${all.map((r) => `<tr><td>${esc(String(r.createdAt).slice(0, 16).replace('T', ' '))}</td><td><code>${esc(r.accountId)}</code></td><td><code>${esc(r.address)}</code><br><span class="${r.verified ? 'ok' : 'no'}">${r.verified ? '✓ verified' : 'not verified'}</span> · ${esc(r.wallet)}</td><td><a href="https://x.com/${esc(r.x)}" target="_blank" rel="noopener">@${esc(r.x)}</a></td><td><a href="${esc(r.postUrl)}" target="_blank" rel="noopener">post ↗</a></td><td><code>${esc(r.ref)}</code>${r.refBy ? `<br>via <code>${esc(r.refBy)}</code>` : ''}</td><td>${r.referrals}</td></tr>`).join('')}
</tbody></table></div></main></body></html>`;
}

/* ---------- server ---------- */
export const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '';
  const url = (req.url || '').split('?')[0];
  if (req.method === 'OPTIONS' && url === '/api/signup') {
    if (!ORIGINS.has(origin)) { res.writeHead(403); return res.end(); }
    res.writeHead(204, { ...cors(origin), 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '600' });
    return res.end();
  }
  if (url === '/api/signup/health') return send(res, 200, { ok: true, count: rows.size, admin: !!ADMIN_PASSWORD });
  if (url === '/admin' || url === '/admin/' || url === '/admin/signups.csv') {
    if (!authed(req)) return send(res, 401, 'Login required', 'text/plain', { 'www-authenticate': 'Basic realm="CYBERHOOD admin", charset="UTF-8"' });
    if (url === '/admin/signups.csv') return send(res, 200, '﻿' + csv(), 'text/csv; charset=utf-8', { 'content-disposition': `attachment; filename="cyberhood-signups-${new Date().toISOString().slice(0, 10)}.csv"` });
    return send(res, 200, adminPage(), 'text/html; charset=utf-8', { 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer' });
  }
  if (req.method !== 'POST' || url !== '/api/signup') return send(res, 404, { error: 'not found' });
  if (origin && !ORIGINS.has(origin)) return send(res, 403, { error: 'origin' });
  const ip = String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
  if (limited(ip)) return send(res, 429, { error: 'slow down' }, 'application/json', cors(origin));
  let raw = '';
  req.on('data', (c) => { raw += c; if (raw.length > 8192) req.destroy(); });
  req.on('end', () => {
    let b;
    try { b = JSON.parse(raw || '{}'); } catch { return send(res, 400, { error: 'json' }, 'application/json', cors(origin)); }
    const r = clean(b);
    if (r.error) return send(res, 400, { error: r.error }, 'application/json', cors(origin));
    const key = r.address.toLowerCase(), prev = rows.get(key);
    // An unsigned re-submit can't overwrite a verified registration of the same wallet
    if (prev && prev.verified && !r.verified) return send(res, 200, { ok: true, verified: true, accountId: prev.accountId }, 'application/json', cors(origin));
    const now = new Date().toISOString();
    const rec = { ...r, createdAt: prev?.createdAt || now, updatedAt: now };
    rows.set(key, rec);
    try { persist(rec); } catch (e) { console.error('signups write', e.message); return send(res, 500, { error: 'storage' }, 'application/json', cors(origin)); }
    send(res, 200, { ok: true, verified: rec.verified, accountId: rec.accountId }, 'application/json', cors(origin));
  });
});

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  load();
  if (!ADMIN_PASSWORD) console.warn('signups: ADMIN_PASSWORD not set, /admin is locked');
  server.listen(PORT, '127.0.0.1', () => console.log(`signups on 127.0.0.1:${PORT} · ${rows.size} loaded from ${DATA}`));
}
export { load, rows };
