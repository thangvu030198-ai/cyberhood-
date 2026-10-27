/* CYBERHOOD site: owner-editable content, hologram hero, marketplace, Early Access flow (wallet → X → post → Hunter Pass). */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const cap = (name) => (window.claude && window.claude.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
let toastT;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 2600); }

/* ---------- Site config (owner-editable, stored in db site/config) ---------- */
const DEF = {
  heroEyebrow: 'Season 0 · Genesis · Browser demo live',
  heroTitle1: 'Hunt the',
  heroTitle2: 'Neon City',
  heroSub: 'A cyberpunk loot hunter you play in the browser. Run contracts, raid an ancient beast, race karts and duel in the arena. Every rare drop is a Genesis item.',
  ctaPlay: 'Play Demo',
  ctaEA: 'Get Early Access',
  fact1v: '6', fact1k: 'Game modes',
  fact2v: '100 v 100', fact2k: 'Citadel siege',
  fact3v: '444', fact3k: 'Genesis items',
  eaTitle: 'Claim your Hunter Pass before Season 0',
  eaSub: 'Four steps, about two minutes. Your account is tied to your wallet, and early rewards are credited to it at launch.',
  rewards: 'Priority spot on the Genesis allowlist\nFounding Hunter badge in game and on the leaderboard\nBonus starter chest when Season 0 opens\nReferral points for every Hunter who joins with your link',
  modesTitle: 'Six ways to play, one city that remembers your loot',
  modesSub: 'Every screenshot is captured in the browser build. Hunters meet in Neon City, then step through a gate into a contract, a siege, a raid, a race or a duel.',
  seasonTitle: 'Five chapters to the Genesis drop',
  seasonSub: 'Each chapter unlocks a new key tier and a new boss. Hunters with a Pass start with a head start in every chapter.',
  footer: 'We don’t drop tokens. We drop loot.',
  gameUrl: 'https://claude.ai/artifact/KxxQ7gNmSDB2hFEEUHdvVQ',
  siteUrl: 'https://claude.ai/artifact/KkhfuzczuPsUBR3kU8FraN',
  xHandle: 'CyberhoodHQ',
  discordUrl: '',
  hashtags: 'CYBERHOOD, Web3Gaming, NFTGaming',
  aiEndpoint: '',
  accent: '#ff2a8a', accent2: '#22e6ff',
  model: 'vex', scan: true, rain: true, ticker: true,
};
// Self-hosted: assets/js/config.js sets window.CH_CONFIG (gameUrl, siteUrl, xHandle…) without editing this file
const DEF2 = { ...DEF, ...(window.CH_CONFIG || {}) };
let cfg = { ...DEF2, ...store.get('ch.cfg', {}) };
const FIELDS = {
  Content: [
    ['heroEyebrow', 'Hero · small line'], ['heroTitle1', 'Hero · title line 1'], ['heroTitle2', 'Hero · title line 2 (glitch)'], ['heroSub', 'Hero · paragraph', 'area'],
    ['ctaPlay', 'Button · play'], ['ctaEA', 'Button · early access'],
    ['fact1v', 'Fact 1 value'], ['fact1k', 'Fact 1 label'], ['fact2v', 'Fact 2 value'], ['fact2k', 'Fact 2 label'], ['fact3v', 'Fact 3 value'], ['fact3k', 'Fact 3 label'],
    ['eaTitle', 'Early access · title'], ['eaSub', 'Early access · text', 'area'], ['rewards', 'Rewards (one per line)', 'area'],
    ['modesTitle', 'Game modes · title'], ['modesSub', 'Game modes · text', 'area'], ['seasonTitle', 'Season · title'], ['seasonSub', 'Season · text', 'area'], ['footer', 'Footer line'],
  ],
  Links: [
    ['gameUrl', 'Demo game URL'], ['siteUrl', 'This site’s public URL (used in posts and referral links)'], ['xHandle', 'Project X handle (no @)'], ['discordUrl', 'Discord invite link (https://discord.gg/…)'], ['hashtags', 'Hashtags (comma separated)'],
    ['aiEndpoint', 'Post AI endpoint (your server, keeps the OpenAI key secret). Empty = built-in AI'],
  ],
  Theme: [['accent', 'Accent (pink)', 'color'], ['accent2', 'Accent 2 (cyan)', 'color'], ['model', 'Hero character', 'select:vex|hacker'], ['scan', 'CRT scanlines', 'bool'], ['rain', 'Neon rain', 'bool'], ['ticker', 'LED ticker', 'bool']],
};

function applyCfg() {
  $$('[data-cfg]').forEach((el) => {
    const v = cfg[el.dataset.cfg] ?? '';
    el.textContent = v;
    if (el.classList.contains('g')) el.dataset.t = v;
  });
  $$('[data-cfg-show]').forEach((el) => { el.hidden = !cfg[el.dataset.cfgShow]; });
  const r = document.documentElement.style;
  r.setProperty('--pink', cfg.accent); r.setProperty('--cyan', cfg.accent2); r.setProperty('--scan', cfg.scan ? 1 : 0);
  const rw = $('#rewards'); rw.textContent = '';
  String(cfg.rewards).split('\n').map((s) => s.trim()).filter(Boolean).forEach((t) => {
    const d = document.createElement('div'); d.append(document.createElement('i'), document.createTextNode(t)); rw.append(d);
  });
  const h = handle(cfg.xHandle);
  $('#footX').hidden = !h; if (h) $('#footX').href = 'https://x.com/' + h;
  $('#topX').hidden = !h; if (h) $('#topX').href = 'https://x.com/' + h;
  // Discord: only real invite links (discord.gg / discord.com/invite)
  const dc = /^https:\/\/(discord\.gg|(www\.)?discord\.com\/invite)\/[\w-]+\/?$/.test(String(cfg.discordUrl || '').trim()) ? String(cfg.discordUrl).trim() : '';
  ['#topDc', '#footDc', '#passDc'].forEach((id) => { const el = $(id); if (el) { el.hidden = !dc; if (dc) el.href = dc; } });
  $('#followBtn').hidden = !h; if (h) { $('#followBtn').href = 'https://x.com/intent/follow?screen_name=' + h; $('#followH').textContent = '@' + h; }
  $('#launch').href = cfg.gameUrl;
  if (holoModel && holoModel !== cfg.model) startHolo();
}
const handle = (s) => String(s || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, '').split(/[/?#]/)[0];

/* ---------- Data ---------- */
const NFT = [
  ['Thunder Spear', 'Weapon', 'Mythic', 0.049], ['Leviathan Scale', 'Armor', 'Mythic', 0.046], ['Frost Fang Blade', 'Weapon', 'Epic', 0.026],
  ['Oni Helm', 'Armor', 'Legendary', 0.032], ['Chrono Cube', 'Relic', 'Legendary', 0.036], ['Nova Bomb', 'Relic', 'Epic', 0.024],
  ['Cosmic Edge', 'Weapon', 'Legendary', 0.038], ['Extra Coin', 'Relic', 'Rare', 0.015], ['Blood Crystal', 'Relic', 'Epic', 0.025],
  ['Aegis Battery Plate', 'Armor', 'Legendary', 0.037], ['Arcane Skullblade', 'Weapon', 'Epic', 0.027], ['Chitin Gauntlets', 'Armor', 'Rare', 0.016],
  ['Crystal Starburst', 'Relic', 'Rare', 0.018], ['Cyber Pulse Gauntlets', 'Armor', 'Epic', 0.026], ['Dark Enigma Armor', 'Armor', 'Legendary', 0.035],
  ['Demonic Bow', 'Weapon', 'Legendary', 0.039], ['Void Crystal', 'Relic', 'Mythic', 0.045], ['Frostbound Scythe', 'Weapon', 'Epic', 0.029],
  ['Frostbound Warhammer', 'Weapon', 'Legendary', 0.036], ['Neon Supply Crate', 'Relic', 'Common', 0.01], ['Golden Raven Mask', 'Armor', 'Epic', 0.023],
  ['Iron Beak Helm', 'Armor', 'Legendary', 0.033], ['Solar Lion Medallion', 'Relic', 'Legendary', 0.04], ['Longreach War Axe', 'Weapon', 'Rare', 0.019],
  ['Molten Inferno Axe', 'Weapon', 'Mythic', 0.048], ['Nebula Rose', 'Relic', 'Epic', 0.022], ['Circuit Core Egg', 'Relic', 'Mythic', 0.05],
  ['Neon Sniper Elite', 'Weapon', 'Epic', 0.03], ['MPRS Sniper Rifle', 'Weapon', 'Rare', 0.02], ['Aether Revolver', 'Weapon', 'Legendary', 0.034],
  ['Thorned Scythe', 'Weapon', 'Epic', 0.028], ['Valor Shield', 'Armor', 'Rare', 0.017], ['Winged Crusader Armor', 'Armor', 'Mythic', 0.044],
].map(([name, kind, rarity, price], i) => ({ name, kind, rarity, price, i }));
/** Số bản mỗi mẫu theo độ hiếm: 6×4 + 10×8 + 10×14 + 6×25 + 1×50 = 444 vật phẩm Genesis */
const EDITIONS = { Mythic: 4, Legendary: 8, Epic: 14, Rare: 25, Common: 50 };
const SUPPLY = NFT.reduce((t, n) => t + EDITIONS[n.rarity], 0);
const eth = (p) => p.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + ' ETH';
const RC = { Common: '#9aa3b5', Rare: '#3fa9ff', Epic: '#b45cff', Legendary: '#ffb800', Mythic: '#ff2a6d' };
const RORDER = ['Mythic', 'Legendary', 'Epic', 'Rare', 'Common'];
const ORIGIN = { Weapon: 'Boss drops and contract chests', Armor: 'Raid and siege rewards', Relic: 'Rare chest and Genesis egg drops' };
const ROWS = Math.ceil(NFT.length / 6);
document.documentElement.style.setProperty('--rows-pct', ROWS * 100 + '%');
let seed = 2077; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hex = () => { let s = '0x'; for (let k = 0; k < 4; k++) s += Math.floor(rnd() * 16).toString(16); return s + '…' + Math.floor(rnd() * 65536).toString(16).padStart(4, '0'); };
NFT.forEach((n, i) => { n.id = '#' + String(i + 1).padStart(3, '0'); n.ed = EDITIONS[n.rarity]; n.owner = hex(); n.likes = 120 + ((i * 3779) % 2400); n.listed = (i * 37) % 24; });
const usd = (e) => '$' + Math.round(e * 3100).toLocaleString('en-US');
const pos = (i) => `${(i % 6) * 20}% ${(Math.floor(i / 6) * 100) / (ROWS - 1)}%`;

/* ---------- Ticker ---------- */
(function ticker() {
  const ev = [['SALE', 's'], ['LISTED', 'l'], ['OFFER', 'o'], ['MINT', 'm']];
  const row = Array.from({ length: 14 }, (_, k) => {
    const n = NFT[(k * 7 + 3) % NFT.length]; const e = ev[k % 4];
    return `<span><b class="${e[1]}">${e[0]}</b> ${esc(n.name)} ${n.id} · ${eth(n.price * (0.95 + ((k * 37) % 10) / 100))}</span>`;
  }).join('');
  $('#ticker').innerHTML = row + row;
})();

/* ---------- Modes ---------- */
const MODES = [
  { img: 'hub_street', tag: 'Hub', t: 'Neon City', m: 'Co-op hub · Live', d: 'Walk the safe zone with other Hunters, take contracts at the board, shop the Neon Bazaar and watch drops on the giant LED screens.' },
  { img: 'lv_citadel_raid', tag: '2.5D', t: 'Contract stages', m: '6 maps · Solo', d: 'Side-scrolling runs through Quarantine Zone, Hollow Hotel, Warzone, Hollow Parish and the Citadel. Every boss has its own trick.' },
  { img: 'siege', tag: '3D', t: 'IXO Ice Citadel', m: '50 v 50 · 100 v 100 · Daily', d: 'Break three generators, ram the gate, hold two watchtowers, then defend the Citadel Core for 60 seconds.' },
  { img: 'raid', tag: 'Raid', t: 'Ancient Beast Gate', m: '4–10 players · Weekly', d: 'Dodge the Electric Leviathan’s discharge from the rooftops, break its scales and sync three Mechs to knock it down.' },
  { img: 'kart', tag: 'Race', t: 'Neon Kart', m: '6 racers · 3 laps', d: 'Drift until the sparks turn orange, release for turbo, and fire items at whoever is ahead.' },
  { img: 'duel', tag: 'Arena', t: 'Arena Duel', m: '1 v 1 · 8 ranks', d: 'Jab, hook, roundhouse and sweep your way up eight rival ranks, on keyboard or touch.' },
];
$('#modeGrid').innerHTML = MODES.map((m, i) => `<button class="mode hud" type="button" data-i="${i}"><div class="shot"><video poster="assets/img/game/${m.img}.webp" muted loop playsinline preload="none" aria-label="${esc(m.t)} gameplay" width="1600" height="900"><source src="assets/video/${m.img}.mp4" type="video/mp4"><source src="assets/video/${m.img}.webm" type="video/webm"></video><span class="tag">${m.tag}</span></div><div class="body"><span class="meta">${m.m}</span><h3>${m.t}</h3><p>${m.d}</p></div></button>`).join('');
{
  const vids = [...document.querySelectorAll('#modeGrid video, .reel video')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!still && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { const v = e.target; if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(() => {}); } else v.pause(); }), { threshold: 0.35 });
    vids.forEach((v) => io.observe(v));
  }
}
$('#modeGrid').addEventListener('click', (e) => {
  const b = e.target.closest('.mode'); if (!b) return; const m = MODES[+b.dataset.i];
  // Lightbox: play the full clip large; the screenshot <img> stays hidden
  let v = $('#lbVid');
  if (!v) { v = document.createElement('video'); v.id = 'lbVid'; v.muted = true; v.loop = true; v.playsInline = true; v.controls = true; $('#lbImg').before(v); }
  $('#lbImg').hidden = true;
  v.poster = `assets/img/game/${m.img}.webp`; v.innerHTML = `<source src="assets/video/${m.img}.mp4" type="video/mp4"><source src="assets/video/${m.img}.webm" type="video/webm">`; v.load(); v.setAttribute('aria-label', m.t);
  $('#lbCap').textContent = `${m.t} · ${m.m}`; openOv('#lb'); v.play().catch(() => {});
});

/* ---------- Season ---------- */
const CHAPS = [
  ['season/bronze.webp', 'Weeks 1–2', 'Bronze contracts', 'Clear the Quarantine Zone and the Hollow Hotel. Bronze chest keys drop from every boss.'],
  ['season/jade.webp', 'Weeks 3–4', 'Jade raids', 'The Ancient Beast Gate opens. Squads of 4–10 break Leviathan scales for Jade keys.'],
  ['season/crystal.webp', 'Weeks 5–6', 'Crystal siege', '100 v 100 at the IXO Ice Citadel. Hold the core to earn Crystal keys.'],
  ['season/colossus.webp', 'Week 7', 'Colossus awakens', 'Three synced Mechs against the Colossus. The finale boss drops Mythic gear.'],
  ['season/genesis.webp', 'Finale', 'Genesis egg', 'Every key you hold cracks the Genesis egg. What hatches is minted to your wallet.'],
];
$('#chaps').innerHTML = CHAPS.map(([img, wk, t, d]) => `<div class="chap hud"><div class="pic"><img src="assets/img/${img}" alt="" loading="lazy" width="720" height="540"></div><span class="wk">${wk}</span><h3>${t}</h3><p>${d}</p></div>`).join('');

/* ---------- Marketplace ---------- */
let fav = store.get('ch.fav', {});
const st = { kind: 'All', rar: null, q: '', sort: 'rec', page: 0 };
/* Pagination: every page shows whole rows (3 rows × the grid's current column count); leftovers go to the next page */
const COLS_MQ = [[matchMedia('(min-width:1100px)'), 4], [matchMedia('(min-width:760px)'), 3]];
const cols = () => (COLS_MQ.find(([m]) => m.matches) || [0, 2])[1];
const perPage = () => cols() * (cols() === 2 ? 4 : 3);
const pager = document.createElement('nav'); pager.className = 'pager'; pager.id = 'pager'; pager.setAttribute('aria-label', 'Marketplace pages');
$('#empty').before(pager);
const floor = Math.min(...NFT.map((n) => n.price));
$('#stats').innerHTML = [['Floor', eth(floor)], ['Top', eth(Math.max(...NFT.map((n) => n.price)))], ['Items', SUPPLY.toLocaleString('en-US')], ['Designs', String(NFT.length)]]
  .map(([k, v], i) => `<div><span>${k}</span><strong class="${i === 0 ? 'up' : ''}">${v}</strong></div>`).join('');
$('#tabs').innerHTML = ['All', 'Weapon', 'Armor', 'Relic'].map((k) => `<button type="button" data-k="${k}" aria-pressed="${k === 'All'}">${k === 'All' ? 'All' : k === 'Armor' ? 'Armor' : k + 's'}</button>`).join('');
$('#rar').innerHTML = RORDER.map((r) => `<button type="button" data-r="${r}" aria-pressed="false"><i style="background:${RC[r]}"></i>${r}</button>`).join('');
const art = (n) => `<div class="art" style="--rc:${RC[n.rarity]}"><div class="px" style="background-position:${pos(n.i)}" role="img" aria-label="${esc(n.name)} pixel art"></div><span class="rk">${n.rarity}</span><span class="lk">♥ ${(n.likes + (fav[n.i] ? 1 : 0)).toLocaleString('en-US')}</span></div>`;
function render() {
  const list = NFT.filter((n) => (st.kind === 'All' || n.kind === st.kind) && (!st.rar || n.rarity === st.rar) && (!st.q || n.name.toLowerCase().includes(st.q)));
  if (st.sort === 'lo') list.sort((a, b) => a.price - b.price);
  else if (st.sort === 'hi') list.sort((a, b) => b.price - a.price);
  else if (st.sort === 'rar') list.sort((a, b) => RORDER.indexOf(a.rarity) - RORDER.indexOf(b.rarity) || b.price - a.price);
  else list.sort((a, b) => a.listed - b.listed);
  const per = perPage(), pages = Math.max(1, Math.ceil(list.length / per));
  st.page = Math.min(st.page, pages - 1);
  const from = st.page * per, shown = list.slice(from, from + per);
  pager.hidden = pages < 1 || list.length === 0;
  pager.innerHTML = `<span class="count">${list.length ? `${from + 1}–${from + shown.length} of ${list.length}` : ''}</span><div class="pages">`
    + `<button type="button" data-p="${st.page - 1}" aria-label="Previous page" ${st.page === 0 ? 'disabled' : ''}>‹</button>`
    + Array.from({ length: pages }, (_, k) => `<button type="button" data-p="${k}" aria-label="Page ${k + 1}" aria-current="${k === st.page ? 'page' : 'false'}">${k + 1}</button>`).join('')
    + `<button type="button" data-p="${st.page + 1}" aria-label="Next page" ${st.page >= pages - 1 ? 'disabled' : ''}>›</button></div>`;
  $('#grid').innerHTML = shown.map((n) => `<button class="card" type="button" data-i="${n.i}" style="--rc:${RC[n.rarity]}">${art(n)}<div class="info"><span class="cl"><i></i>CYBERHOOD Genesis · ${n.ed} editions</span><span class="nm">${esc(n.name)} ${n.id}</span><span class="pr"><strong>${eth(n.price)}</strong><span>${usd(n.price)}</span></span></div></button>`).join('');
  // A short last row sits centred (grid has 2 tracks per card), never stranded on the left
  const c = cols(), rem = shown.length % c;
  if (rem) $('#grid').children[shown.length - rem].style.gridColumnStart = c - rem + 1;
  $('#empty').hidden = list.length > 0;
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.kind = b.dataset.k; st.page = 0; $$('#tabs button').forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); });
$('#rar').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; st.rar = st.rar === b.dataset.r ? null : b.dataset.r; st.page = 0; $$('#rar button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.r === st.rar)); render(); });
$('#q').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); st.page = 0; render(); });
$('#sort').addEventListener('change', (e) => { st.sort = e.target.value; st.page = 0; render(); });
pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-p]'); if (!b || b.disabled) return;
  st.page = +b.dataset.p; render();
  const top = $('#market .bar');
  if (top.getBoundingClientRect().top < 0) window.__lenis ? window.__lenis.scrollTo(top, { offset: -80 }) : top.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
COLS_MQ.forEach(([m]) => m.addEventListener('change', () => render()));
render();
let curItem = 0;
function openItem(i) {
  const n = NFT[i]; curItem = i;
  $('#shBox').innerHTML = `${art(n)}<div class="body"><span class="eyebrow">CYBERHOOD Genesis ✓</span><h3 id="shName">${esc(n.name)} ${n.id}</h3><p class="count">Owned by ${n.owner}</p>
  <div class="traits"><div><span>Type</span><b>${n.kind}</b></div><div><span>Rarity</span><b style="color:${RC[n.rarity]}">${n.rarity}</b></div><div><span>Editions</span><b>${n.ed} of ${SUPPLY}</b></div><div><span>Season</span><b>0</b></div></div>
  <div class="price"><span>Current price</span><div><strong>${eth(n.price)}</strong><small>${usd(n.price)}</small></div>
  <div class="acts" style="display:flex;flex-wrap:wrap;gap:8px"><button class="btn primary small" type="button" data-a="buy">Buy now</button><button class="btn ghost small" type="button" data-a="buy">Make offer</button><button class="btn ghost small" type="button" data-a="fav" aria-pressed="${!!fav[i]}">${fav[i] ? '♥ Saved' : '♡ Save'}</button></div></div>
  <div class="msg warn" id="shNote" hidden>Trading opens with the Season 0 launch. Hunters with an Early Access pass get first pick. <button class="btn cyan small" type="button" data-a="ea" style="margin-top:8px">Get Early Access</button></div>
  <p class="count">Where it comes from: ${ORIGIN[n.kind]}</p></div><button class="x" type="button" data-close aria-label="Close">✕</button>`;
  openOv('#sheet');
}
$('#grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openItem(+c.dataset.i); });
$('#sheet').addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  if (b.dataset.a === 'fav') {
    fav[curItem] = !fav[curItem]; store.set('ch.fav', fav);
    b.textContent = fav[curItem] ? '♥ Saved' : '♡ Save'; b.setAttribute('aria-pressed', !!fav[curItem]);
    $('#shBox .lk').textContent = '♥ ' + (NFT[curItem].likes + (fav[curItem] ? 1 : 0)).toLocaleString('en-US'); render();
  } else if (b.dataset.a === 'ea') { closeOv('#sheet'); openFlow(); }
  else $('#shNote').hidden = false;
});

/* ---------- Overlays ---------- */
let lastFocus = null;
function openOv(sel) { lastFocus = document.activeElement; const o = $(sel); o.hidden = false; document.body.style.overflow = 'hidden'; const f = o.querySelector('[data-close],button,input'); f && f.focus({ preventScroll: true }); }
function closeOv(sel) { $(sel).hidden = true; $(sel).querySelectorAll('video').forEach((v) => v.pause()); if (!$$('.ov').some((o) => !o.hidden)) document.body.style.overflow = ''; lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); }
$$('.ov').forEach((o) => o.addEventListener('click', (e) => { if (e.target === o || e.target.closest('[data-close]')) closeOv('#' + o.id); }));
addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; const o = $$('.ov').reverse().find((x) => !x.hidden); if (o) closeOv('#' + o.id); else if (!$('#editor').hidden) $('#editor').hidden = true; });

/* ---------- Hologram hero ---------- */
let holo = null, holoModel = null;
const HOT = [0, 24, 26, 15, 3, 16, 32, 29].map((i) => NFT[i]);
function startHolo() {
  if (!window.CHHolo || !window.THREE) { $('#holoLoad').textContent = 'HOLOGRAM OFFLINE'; return; }
  if (holo) holo.dispose();
  holoModel = cfg.model;
  $('#holoLoad').hidden = false; $('#holoLoad').textContent = 'LOADING HUNTER…';
  holo = window.CHHolo.start($('#holo'), {
    model: `assets/models/${cfg.model === 'hacker' ? 'hacker' : 'vex'}.glb.wasm`, idle: 'assets/models/idle.glb.wasm', atlas: 'assets/img/nft-atlas.png',
    items: HOT, focusX: 0.68,
    onPick: (it) => openItem(it.i),
    onReady: () => { $('#holoLoad').hidden = true; },
    onError: () => { $('#holoLoad').textContent = 'HOLOGRAM OFFLINE'; },
  });
}

/* ---------- Early access flow ---------- */
const K = 'ch.ea';
let ea = store.get(K, {});
const short = (a) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');
const saveEa = () => { store.set(K, ea); chip(); };
function chip() {
  const done = !!ea.accountId;
  $('#walletChip').hidden = !ea.address; $('#walletChipT').textContent = done ? `${ea.accountId} · ${short(ea.address)}` : short(ea.address);
  $('#topEA').hidden = !!ea.address;
}
let step = 0;
function msg(t, kind) { const m = $('#flowMsg'); m.hidden = !t; m.className = 'msg' + (kind ? ' ' + kind : ''); m.textContent = t || ''; }
function go(n) {
  step = n; msg('');
  $$('#flow .pane').forEach((p) => { p.hidden = +p.dataset.step !== n; });
  $$('#prog div').forEach((d, i) => { d.className = i < n ? 'done' : i === n ? 'on' : ''; });
  $('#flowT').textContent = n === 3 ? 'Welcome, Hunter' : 'Early access';
  if (n === 0) renderWallets(), showAddr();
  if (n === 1) { $('#xIn').value = ea.x || ''; checkX(); }
  if (n === 2) { if (!ea.postText) genPost(); else { $('#postTx').value = ea.postText; postUpd(); } $('#urlIn').value = ea.postUrl || ''; checkUrl(); }
  if (n === 3) renderPass();
}
let flowMode = 'ea';
function openFlow(mode) {
  flowMode = mode || 'ea';
  openOv('#flow');
  go(ea.accountId ? 3 : !ea.address ? 0 : !ea.x ? 1 : 2);
  if (flowMode === 'play' && !ea.accountId) msg('Complete these steps once to unlock the demo and claim your Hunter Pass.', '');
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-flow]'); if (b) { e.preventDefault(); openFlow(b.dataset.flow); } });
$('#walletChip').addEventListener('click', () => openFlow('ea'));
$('#flow').addEventListener('click', (e) => {
  if (e.target.closest('[data-next]')) go(step + 1);
  if (e.target.closest('[data-back]')) go(step - 1);
});

/* Wallets: EIP-6963 discovery plus well-known EVM wallets with install links */
const KNOWN = [
  { rdns: 'io.metamask', name: 'MetaMask', c: '#f6851b', url: 'https://metamask.io/download/', flag: 'isMetaMask', deep: (u) => 'https://metamask.app.link/dapp/' + u.replace(/^https?:\/\//, '') },
  { rdns: 'io.rabby', name: 'Rabby', c: '#7084ff', url: 'https://rabby.io/', flag: 'isRabby' },
  { rdns: 'com.coinbase.wallet', name: 'Coinbase Wallet', c: '#0052ff', url: 'https://www.coinbase.com/wallet/downloads', flag: 'isCoinbaseWallet', deep: (u) => 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(u) },
  { rdns: 'com.okex.wallet', name: 'OKX Wallet', c: '#111', url: 'https://www.okx.com/web3', flag: 'isOkxWallet', deep: (u) => 'okx://wallet/dapp/url?dappUrl=' + encodeURIComponent(u) },
  { rdns: 'com.trustwallet.app', name: 'Trust Wallet', c: '#0500ff', url: 'https://trustwallet.com/download', flag: 'isTrust', deep: (u) => 'https://link.trustwallet.com/open_url?coin_id=60&url=' + encodeURIComponent(u) },
  { rdns: 'me.rainbow', name: 'Rainbow', c: '#ff6b3d', url: 'https://rainbow.me/download', flag: 'isRainbow' },
  { rdns: 'io.zerion.wallet', name: 'Zerion', c: '#2962ef', url: 'https://zerion.io/download', flag: 'isZerion' },
  { rdns: 'app.phantom', name: 'Phantom', c: '#ab9ff2', url: 'https://phantom.com/download', flag: 'isPhantom' },
  { rdns: 'com.brave.wallet', name: 'Brave Wallet', c: '#fb542b', url: 'https://brave.com/wallet/', flag: 'isBraveWallet' },
  { rdns: 'com.bitget.web3', name: 'Bitget Wallet', c: '#00f0ff', url: 'https://web3.bitget.com/', flag: 'isBitKeep' },
];
const found = new Map();
addEventListener('eip6963:announceProvider', (e) => { const d = e.detail; if (d && d.info && d.provider) { found.set(d.info.rdns || d.info.uuid, d); if (step === 0 && !$('#flow').hidden) renderWallets(); } });
try { dispatchEvent(new Event('eip6963:requestProvider')); } catch (e) {}
const mobile = matchMedia('(pointer:coarse)').matches && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function walletList() {
  const list = [];
  found.forEach((d, key) => { const k = KNOWN.find((w) => w.rdns === d.info.rdns); list.push({ key, name: d.info.name, icon: d.info.icon, c: k ? k.c : '#333', provider: d.provider, det: true }); });
  const eth = window.ethereum;
  if (eth && !list.length) { const k = KNOWN.find((w) => eth[w.flag]) || { name: 'Browser wallet', c: '#555' }; list.push({ key: 'injected', name: k.name, c: k.c, provider: eth, det: true }); }
  KNOWN.forEach((w) => { if (!list.some((x) => x.name.toLowerCase().startsWith(w.name.toLowerCase().split(' ')[0]))) list.push({ key: w.rdns, name: w.name, c: w.c, known: w }); });
  return list;
}
let wl = [];
function renderWallets() {
  wl = walletList();
  $('#wallets').innerHTML = wl.map((w, i) => {
    const ico = w.icon && /^data:image\/(svg\+xml|png|webp|jpeg)/.test(w.icon) ? `<img src="${esc(w.icon)}" alt="">` : `<span class="ico" style="background:${w.c}">${esc(w.name[0])}</span>`;
    const sub = w.det ? 'Detected' : mobile && w.known.deep ? 'Open in app' : 'Install';
    return `<button class="wallet${w.det ? ' det' : ''}" type="button" data-w="${i}">${ico}<span><b>${esc(w.name)}</b><small>${sub}</small></span></button>`;
  }).join('');
}
$('#wallets').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-w]'); if (!b) return; const w = wl[+b.dataset.w];
  if (!w.provider) {
    const u = cfg.siteUrl || location.href;
    if (mobile && w.known.deep) { location.href = w.known.deep(u); return; }
    window.open(w.known.url, '_blank', 'noopener');
    msg(`${w.name} is not installed in this browser. Install it, reload this page, or paste your address below.`, 'warn');
    return;
  }
  await connect(w);
});
const toHex = (s) => '0x' + [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function connect(w) {
  const p = w.provider;
  try {
    msg(`Opening ${w.name}… approve the connection in your wallet.`);
    const accts = await p.request({ method: 'eth_requestAccounts' });
    const address = accts && accts[0]; if (!address) throw new Error('No account returned');
    let chainId = ''; try { chainId = await p.request({ method: 'eth_chainId' }); } catch (e) {}
    const nonce = Math.random().toString(36).slice(2, 10);
    const message = `CYBERHOOD Early Access\n\nSign this message to prove you own this wallet.\nIt is free: no transaction, no gas, no spending permission.\n\nWallet: ${address}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`;
    msg('Connected. Now sign the message in your wallet (free, no transaction).');
    let signature = '';
    try { signature = await p.request({ method: 'personal_sign', params: [toHex(message), address] }); }
    catch (e) { if (e && e.code === 4001) { setAddr(address, { wallet: w.name, chainId, verified: false }); msg('You skipped the signature. You can continue, but the wallet stays unverified until you sign.', 'warn'); return; } throw e; }
    setAddr(address, { wallet: w.name, chainId, verified: true, signature, message });
    msg('Wallet verified.', 'ok');
  } catch (e) {
    msg(e && e.code === 4001 ? 'Request rejected in the wallet.' : `Could not reach ${w.name} here${e && e.message ? ' (' + e.message + ')' : ''}. Paste your address below instead.`, 'err');
  }
}
function checksum(a) {
  const k = window.keccak_256 || window.keccak256; if (!k) return null;
  const lo = a.slice(2).toLowerCase(); const h = k(lo);
  return '0x' + [...lo].map((c, i) => (parseInt(h[i], 16) >= 8 ? c.toUpperCase() : c)).join('');
}
function validAddr(a) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return 'That is not an EVM address. It starts with 0x followed by 40 hex characters.';
  if (/^0x0{40}$/.test(a)) return 'The zero address cannot receive rewards.';
  const body = a.slice(2);
  if (body !== body.toLowerCase() && body !== body.toUpperCase()) { const c = checksum(a); if (c && c !== a) return 'Checksum mismatch: a letter has the wrong case. Copy the address again from your wallet.'; }
  return '';
}
function setAddr(address, extra) {
  const a = checksum(address) || address;
  if (ea.address && ea.address.toLowerCase() !== a.toLowerCase()) ea = {};
  Object.assign(ea, { address: a, signature: '', message: '' }, extra); saveEa(); showAddr();
}
$('#addrUse').addEventListener('click', () => {
  const a = $('#addrIn').value.trim(); const err = validAddr(a);
  if (err) return msg(err, 'err');
  setAddr(a, { wallet: 'Manual', chainId: '', verified: false }); msg('Address saved. Connect the same wallet later to verify it.', 'ok');
});
$('#addrIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#addrUse').click(); });
function showAddr() {
  const has = !!ea.address;
  $('#addrBox').hidden = !has; $('#next0').disabled = !has; $('#addrReset').hidden = !has;
  if (has) { $('#addrState').textContent = ea.verified ? `✓ Verified with ${ea.wallet}` : `Unverified · ${ea.wallet === 'Manual' ? 'pasted by hand' : ea.wallet}`; $('#addrShow').textContent = ea.address; }
}
$('#addrReset').addEventListener('click', () => { ea = {}; saveEa(); $('#addrIn').value = ''; showAddr(); msg(''); });

/* X account */
const X_RE = /^[A-Za-z0-9_]{1,15}$/;
function checkX() {
  const v = handle($('#xIn').value); const ok = X_RE.test(v);
  $('#next1').disabled = !ok;
  if ($('#xIn').value && !ok) msg('X usernames use letters, numbers and _ only, up to 15 characters.', 'err'); else msg('');
  return ok ? v : '';
}
$('#xIn').addEventListener('input', checkX);
$('#next1').addEventListener('click', () => { const v = checkX(); if (v) { if (ea.x !== v) { ea.postText = ''; ea.postUrl = ''; } ea.x = v; saveEa(); } }, true);

/* Promo post */
const lang = 'en';
const tags = () => String(cfg.hashtags || '').split(/[,\s]+/).map((t) => t.replace(/^#/, '')).filter(Boolean).map((t) => '#' + t).join(' ');
function refCode() { if (!ea.ref) { ea.ref = 'H' + ((ea.address || '').slice(-4) + Math.random().toString(36).slice(2, 6)).toUpperCase(); saveEa(); } return ea.ref; }
function refLink() { const u = cfg.siteUrl || location.href.split('#')[0]; return u + (u.includes('?') ? '&' : '?') + 'ref=' + refCode(); }
const TPL = {
  en: [
    (p) => `Just claimed my Hunter Pass for ${p.game} Season 0 🌆 A cyberpunk loot hunter in the browser: contracts, a 100 v 100 siege, raid bosses, kart races and arena duels. Early access is open.`,
    (p) => `Neon City is waking up. I'm in early for ${p.game} — co-op hub, Leviathan raids and Genesis loot you earn by playing. Grab your Hunter Pass before Season 0 ⚡`,
    (p) => `Found my next grind: ${p.game}. Run contracts, break the Citadel gate with 100 players, drift through Neon Kart. Demo is live, early access is open 🎮`,
  ],
};
let tplIx = Math.floor(Math.random() * 3);
/* Post topics: the AI writes about the one the Hunter picks; each has a hand-written fallback */
const TOPICS = [
  ['season', 'Season 0', 'Season 0 early access and the Hunter Pass tied to the player wallet',
    (p) => `Got my Hunter Pass for ${p.game} Season 0 before the gates open. See you in Neon City 🌆`],
  ['hub', 'Neon City', 'Neon City, the 3D co-op hub where Hunters meet, trade and watch drops on giant LED screens',
    (p) => `Neon City in ${p.game} is unreal: rain, LED towers and every rare drop lighting up the street ⚡`],
  ['contracts', 'Contracts', 'side-scrolling contract stages with a boss at the end of every map',
    (p) => `Six side-scrolling maps in ${p.game} and every boss has its own trick. Hooked already 🎮`],
  ['siege', 'Siege 100v100', 'the 100 v 100 siege of the IXO Ice Citadel: break three shield generators, ram the gate, hold the core',
    (p) => `100 v 100 at the IXO Ice Citadel in ${p.game}. Shields down, gate next 🧊⚔️`],
  ['raid', 'Leviathan raid', 'the 4-10 player raid on the Electric Leviathan, breaking its scales from the rooftops',
    (p) => `Squad up for the Electric Leviathan in ${p.game}. Rooftops, lightning and scales to break 🐉`],
  ['kart', 'Neon Kart', 'Neon Kart racing: drift until the sparks turn orange, release for turbo, fire items',
    (p) => `Drift till the sparks go orange, then turbo. Neon Kart in ${p.game} is my new favorite 🏎️`],
  ['duel', 'Arena duel', '1 v 1 arena duels up eight rival ranks with jab, hook, roundhouse and sweep combos',
    (p) => `Eight rivals, one ring. Climbing the arena ladder in ${p.game} one roundhouse at a time 🥊`],
  ['genesis', 'Genesis loot', 'Genesis pixel-art weapons, armor and relics earned by playing, 444 items in Season 0',
    (p) => `444 Genesis items in ${p.game} Season 0 and you earn them by playing. Hunting a Mythic 🗡️`],
  ['hook', 'Uniswap v4 hook', 'the on-chain economy built on a Uniswap v4 hook where rewards follow play activity, not holdings',
    (p) => `${p.game} runs its economy on a Uniswap v4 hook and rewards follow play, not bags. Read the litepaper 📜`],
];
let topic = 'season';
const topicOf = (id) => TOPICS.find((t) => t[0] === id) || TOPICS[0];
$('#topicTabs').innerHTML = TOPICS.map(([id, label]) => `<button type="button" data-t="${id}" aria-pressed="${id === topic}">${label}</button>`).join('');
$('#topicTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === topic) return; topic = b.dataset.t; $$('#topicTabs button').forEach((x) => x.setAttribute('aria-pressed', x === b)); genPost(); });
const xLen = (s) => [...s.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length;
function finishPost(body) {
  const tail = `\n\n${tags()}\n${refLink()}`;
  body = body.replace(/^["“]|["”]$/g, '').replace(/https?:\/\/\S+/g, '').replace(/(^|\s)#\w+/g, '').trim();
  while (xLen(body + tail) > 280 && body.length > 40) body = body.replace(/\s*\S+$/, '…').replace(/……$/, '…');
  return body + tail;
}
const PROMPT = (p) => `Write one post for X (Twitter) by a player who just joined early access for CYBERHOOD.
Game facts: a cyberpunk loot-hunting game that runs in the browser on desktop and phone. A co-op hub called Neon City where players meet. Six modes: side-scrolling contract stages, a 100 v 100 siege on the IXO Ice Citadel, a 4-10 player raid on the Electric Leviathan, Neon Kart racing, and 1 v 1 arena duels. Genesis pixel-art items are earned by playing. Early access for Season 0 is open now and gives a Hunter Pass tied to the player's wallet.
Rules:
- Language: English.
- At most 200 characters. First person, excited gamer voice, at most 2 emoji.
${p.at ? `- Mention ${p.at.trim()} exactly once.\n` : ''}- Do not include hashtags or links (they are added after).
- Never promise money, profit, prices, token amounts or airdrops.
- Topic: ${topicOf(p.topic)[2]}.
Reply with only the post text.`;
let genBusy = null;
async function genPost() {
  const ta = $('#postTx');
  const h = handle(cfg.xHandle);
  // p.game names the project once: the @handle when set ("@CyberhoodHQ"), else the plain name
  const p = { lang, topic, at: h ? '@' + h + ' ' : '', game: h ? '@' + h : 'CYBERHOOD' };
  tplIx = (tplIx + 1) % 3;
  // Fallback: the topic's own line; the generic templates only for the Season 0 topic
  const fallback = finishPost(topic === 'season' && tplIx ? TPL[lang][tplIx](p) : topicOf(topic)[3](p));
  if (genBusy) genBusy.abort();
  const ctl = new AbortController(); genBusy = ctl;
  ta.value = 'Writing your post…'; $('#genBtn').disabled = true; ta.readOnly = true;
  let text = '';
  try {
    if (cfg.aiEndpoint) {
      const r = await fetch(cfg.aiEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lang, topic, handle: handle(cfg.xHandle) }), signal: ctl.signal });
      const j = r.ok ? await r.json() : {}; text = j.text || j.post || '';
    } else {
      const sample = await Promise.race([cap('sample'), new Promise((r) => setTimeout(() => r(null), 4000))]);
      if (sample) { const r = await sample(PROMPT(p), { signal: ctl.signal, modelTier: 'quick', cache: false }); text = r && r.text || ''; }
    }
  } catch (e) { text = ''; }
  if (genBusy !== ctl) return;
  genBusy = null; $('#genBtn').disabled = false; ta.readOnly = false;
  ta.value = text.trim() ? finishPost(text.trim()) : fallback;
  postUpd();
}
function postUpd() {
  const t = $('#postTx').value; const n = xLen(t);
  $('#postCount').textContent = `${n} / 280`; $('#postCount').classList.toggle('bad', n > 280);
  $('#postBtn').href = 'https://x.com/intent/post?text=' + encodeURIComponent(t);
  ea.postText = t; saveEa();
}
$('#postTx').addEventListener('input', postUpd);
$('#genBtn').addEventListener('click', genPost);
$('#postBtn').addEventListener('click', (e) => { if (xLen($('#postTx').value) > 280) { e.preventDefault(); msg('The post is over 280 characters. Shorten it first.', 'err'); } else setTimeout(() => $('#urlIn').focus({ preventScroll: true }), 400); });
const URL_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/i;
function checkUrl() {
  const v = $('#urlIn').value.trim(); const m = v.match(URL_RE);
  let ok = !!m;
  if (v && !m) msg('Paste the link of your post. It looks like https://x.com/yourname/status/123…', 'err');
  else if (m && ea.x && m[1].toLowerCase() !== ea.x.toLowerCase()) { ok = false; msg(`That post belongs to @${m[1]}, not @${ea.x}. Post from your own account or go back and change the username.`, 'err'); }
  else msg('');
  $('#finish').disabled = !ok;
  return ok ? `https://x.com/${m[1]}/status/${m[2]}` : '';
}
$('#urlIn').addEventListener('input', checkUrl);

/* Hunter Pass */
const accountId = (a) => { const k = window.keccak_256 || window.keccak256; let h = ''; if (k) h = k(a.toLowerCase()); else { let x = 2166136261; for (const c of a.toLowerCase()) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0; h = x.toString(16).padStart(8, '0'); } return 'CH-' + h.slice(0, 4).toUpperCase() + '-' + h.slice(4, 8).toUpperCase(); };
$('#finish').addEventListener('click', async () => {
  const url = checkUrl(); if (!url || !ea.address || !ea.x) return;
  ea.postUrl = url; ea.accountId = accountId(ea.address); refCode();
  ea.createdAt = ea.createdAt || new Date().toISOString();
  const by = new URLSearchParams(location.search).get('ref'); if (by && /^H[A-Z0-9]{4,12}$/.test(by) && by !== ea.ref) ea.refBy = by;
  saveEa();
  $('#finish').disabled = true;
  ea.saved = await saveSignup();
  saveEa(); go(3);
});
async function saveSignup() {
  const [db, user] = await Promise.all([cap('db'), cap('user')]);
  const id = user ? await user.id().catch(() => null) : null;
  if (!db || !id) return 'local';
  const doc = { accountId: ea.accountId, address: ea.address, verified: !!ea.verified, wallet: ea.wallet || '', chainId: ea.chainId || '', signature: ea.signature || '', message: ea.message || '', x: ea.x, postUrl: ea.postUrl, postText: (ea.postText || '').slice(0, 600), ref: ea.ref, refBy: ea.refBy || '', createdAt: ea.createdAt };
  try { await db.doc('signups/' + id).set(doc); return 'cloud'; } catch (e) { return 'local'; }
}
function renderPass() {
  const h = parseInt((ea.accountId || 'CH-0000').replace(/\W/g, '').slice(2, 6), 16) || 0;
  $('#pass').innerHTML = `<div class="av"><div style="background-position:${pos(h % NFT.length)}"></div></div><div class="id"><span class="t">GENESIS HUNTER PASS</span><h4>${esc(ea.accountId)}</h4>
  <dl><dt>Wallet</dt><dd>${esc(short(ea.address))}${ea.verified ? ' ✓' : ''}</dd><dt>X</dt><dd>@${esc(ea.x)}</dd><dt>Status</dt><dd>${ea.verified ? 'Wallet verified' : 'Wallet unverified'}</dd><dt>Joined</dt><dd>${esc((ea.createdAt || '').slice(0, 10))}</dd><dt>Referral</dt><dd>${esc(ea.ref)}</dd></dl></div><span class="badge">EARLY ACCESS</span>`;
  const m = $('#saveMsg'); m.hidden = false;
  if (ea.saved === 'cloud') { m.className = 'msg ok'; m.textContent = 'Account issued and registered. Early rewards will be credited to this wallet.'; }
  else { m.className = 'msg warn'; m.textContent = 'Account issued on this device. Registration could not reach the server from this view, so keep this page and your wallet — you can finish registration from a signed-in view.'; }
  $('#refIn').value = refLink(); $('#launch').href = cfg.gameUrl;
}
$('#refCopy').addEventListener('click', async () => { const i = $('#refIn'); i.select(); try { await navigator.clipboard.writeText(i.value); toast('Referral link copied'); } catch (e) { try { document.execCommand('copy'); toast('Referral link copied'); } catch (er) { toast('Select the link and copy it'); } } });
$('#restart').addEventListener('click', () => { ea = {}; saveEa(); go(0); });

/* ---------- Owner editor ---------- */
let db = null, edTab = 'Content', draft = null;
function field([key, label, type = 'text']) {
  const v = draft[key]; const id = 'ed_' + key;
  if (type === 'area') return `<div class="field"><label for="${id}">${label}</label><textarea id="${id}" data-k="${key}" rows="3" style="min-height:80px">${esc(v)}</textarea></div>`;
  if (type === 'color') return `<div class="field"><label for="${id}">${label}</label><div class="colorrow"><input type="color" id="${id}" data-k="${key}" value="${esc(v)}"><span class="mono">${esc(v)}</span></div></div>`;
  if (type === 'bool') return `<label class="colorrow"><input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}> ${label}</label>`;
  if (type.startsWith('select:')) return `<div class="field"><label for="${id}">${label}</label><select id="${id}" data-k="${key}">${type.slice(7).split('|').map((o) => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></div>`;
  return `<div class="field"><label for="${id}">${label}</label><input id="${id}" data-k="${key}" value="${esc(v)}"></div>`;
}
function renderEditor() {
  $('#etabs').innerHTML = [...Object.keys(FIELDS), 'Signups'].map((t) => `<button type="button" data-t="${t}" aria-pressed="${t === edTab}">${t}</button>`).join('');
  if (edTab === 'Signups') { $('#ebody').innerHTML = '<p class="count">Loading registrations…</p>'; loadSignups(); return; }
  $('#ebody').innerHTML = FIELDS[edTab].map(field).join('') + (edTab === 'Links' ? '<p class="count">Post AI: with an endpoint, the page POSTs {x, address, lang, prompt} and expects {text}. Keep your OpenAI key on that server, never in this page.</p>' : '');
}
$('#etabs').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (b) { edTab = b.dataset.t; renderEditor(); } });
$('#ebody').addEventListener('input', (e) => {
  const el = e.target.closest('[data-k]'); if (!el) return;
  draft[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
  if (el.type === 'color') el.nextElementSibling.textContent = el.value;
  cfg = { ...draft }; applyCfg(); $('#edState').textContent = 'Unsaved changes';
});
$('#editFab').addEventListener('click', () => { draft = { ...cfg }; $('#editor').hidden = false; renderEditor(); });
$('#edClose').addEventListener('click', () => { $('#editor').hidden = true; });
$('#edReset').addEventListener('click', () => { draft = { ...DEF }; cfg = { ...DEF }; applyCfg(); renderEditor(); $('#edState').textContent = 'Defaults loaded · press Save'; });
$('#edSave').addEventListener('click', async () => {
  const out = {}; Object.keys(DEF).forEach((k) => { out[k] = draft[k] ?? DEF[k]; });
  try { await db.doc('site/config').set(out); $('#edState').textContent = 'Saved · live for every visitor'; toast('Site updated'); }
  catch (e) { $('#edState').textContent = 'Save failed: ' + (e && e.message || e); }
});
async function loadSignups() {
  try {
    const snap = await db.collection('signups').get();
    const rows = snap.docs.map((d) => d.data()).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const csv = ['accountId,address,verified,wallet,x,postUrl,ref,refBy,createdAt'].concat(rows.map((r) => [r.accountId, r.address, r.verified, r.wallet, r.x, r.postUrl, r.ref, r.refBy, r.createdAt].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
    $('#ebody').innerHTML = `<p class="count">${rows.length} registration${rows.length === 1 ? '' : 's'}</p>` + (rows.length ? `<table class="reg"><thead><tr><th>Account</th><th>Wallet</th><th>X / post</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.accountId)}<br>${esc((r.createdAt || '').slice(0, 10))}</td><td>${esc(short(r.address))} ${r.verified ? '✓' : ''}<br>${esc(r.wallet)}</td><td>@${esc(r.x)}<br>${/^https:\/\/x\.com\//.test(r.postUrl) ? `<a href="${esc(r.postUrl)}" target="_blank" rel="noopener" style="color:var(--cyan)">post ↗</a>` : ''}</td></tr>`).join('')}</tbody></table><div class="field"><label for="csv">CSV export</label><textarea id="csv" readonly>${esc(csv)}</textarea></div>` : '');
  } catch (e) { $('#ebody').innerHTML = `<p class="msg err">Could not load registrations: ${esc(e && e.message || e)}</p>`; }
}

/* ---------- Boot ---------- */
applyCfg(); chip();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startHolo); else startHolo();
(async () => {
  db = await cap('db');
  if (db) {
    db.doc('site/config').onSnapshot((s) => {
      const d = s.exists ? s.data() : null; if (!d) return;
      if (!$('#editor').hidden) return;
      cfg = { ...DEF2, ...d }; store.set('ch.cfg', cfg); applyCfg();
    }, () => {});
  }
  const user = await cap('user');
  if (user && db && await user.isOwner().catch(() => false)) $('#editFab').hidden = false;
  if (user && db && !ea.accountId) {
    const id = await user.id().catch(() => null);
    if (id) { try { const s = await db.doc('signups/' + id).get(); if (s.exists) { ea = { ...s.data(), saved: 'cloud' }; saveEa(); } } catch (e) {} }
  }
})();
if (new URLSearchParams(location.search).has('ea')) openFlow('ea');
})();
