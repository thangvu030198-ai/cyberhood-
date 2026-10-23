// Bot chơi như người thật cho màn đi ngang / nhìn từ trên / bay bắn: né đạn và vùng nguy hiểm, vượt chướng ngại,
// bắn quái, đánh trùm theo mẹo của từng trùm. Dùng cho chơi thử tự động (playtest.test.ts) và quay phim giới thiệu.

import { WEAPONS } from "./gear";
import { LEVEL_TUNING as T } from "./levelTuning";
import { NO_INPUT, type Input, type PlatformerSim } from "./platformer";

/** Bot né đạn: có đạn địch bay tới gần ngang người thì nhảy */
function threat(sim: PlatformerSim) {
  const p = sim.player;
  return sim.shots.some((s) => s.enemy && Math.abs(s.y - (p.y + 0.9)) < 1.3 && Math.abs(s.x - p.x) < 3.2 && Math.sign(p.x - s.x) === Math.sign(s.vx || 1));
}

/** Có vùng nguy hiểm (đang báo hoặc đang bùng) phủ lên điểm (x, y) không, trong khoảng `ahead` giây tới */
function hazardAt(sim: PlatformerSim, x: number, y: number, w: number, h: number, ahead = 2) {
  const top = sim.mode === "topdown";
  for (const z of sim.hazards) {
    if (sim.time > z.endAt || z.liveAt - sim.time > ahead) continue;
    const cx = x;
    const cy = top ? y + h / 2 : y + h / 2;
    const hw = w / 2 + 0.25;
    const hh = (top ? w : h) / 2 + 0.25;
    if (z.shape === "rect" && cx + hw > z.x0 && cx - hw < z.x1 && cy + hh > z.y0 && cy - hh < z.y1) return z;
    if (z.shape === "circle" && Math.hypot(Math.max(cx - hw, Math.min(z.x0, cx + hw)) - z.x0, Math.max(cy - hh, Math.min(z.y0, cy + hh)) - z.y0) < z.r) return z;
    if (z.shape === "line") {
      const vx = z.x1 - z.x0;
      const vy = z.y1 - z.y0;
      const l = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((cx - z.x0) * vx + (cy - z.y0) * vy) / l));
      if (Math.hypot(cx - z.x0 - vx * t, cy - z.y0 - vy * t) < z.r + Math.min(hw, hh)) return z;
    }
  }
  return null;
}

/**
 * Né như người chơi: đang đứng trong vùng đỏ thì chạy sang chỗ an toàn gần nhất; tia quét sát sàn
 * (cả phòng) thì nhảy đúng lúc. Gặp lính khiên / quái sát mặt thì chém cận chiến.
 */
export function dodge(sim: PlatformerSim, input: Input, f: number): Input {
  const p = sim.player;
  const top = sim.mode === "topdown";
  const fly = sim.mode === "shmup";
  const out = { ...input };
  // Cận chiến: quái thường đứng sát trước mặt, hoặc lính khiên trong tầm chém
  const front = sim.enemies.find((e) => e.alive && e.awake && e.kind !== "boss" && (top ? Math.hypot(e.x - p.x, e.y - p.y) < 2.2 : Math.abs(e.y - p.y) < 1.5 && (e.x - p.x) * p.facing > -0.3 && Math.abs(e.x - p.x) < (e.trait === "shield" ? 2.6 : 1.9)));
  // Nút L đổi súng ↔ kiếm: quái sát mặt thì rút kiếm, xa ra thì cầm súng lại (trang bị kiếm thì giữ kiếm)
  const want = front || sim.bladeGear ? "sword" : "gun";
  if (p.weaponMode !== want && f % 9 === 0 && sim.time - p.swapAt > 0.4) out.melee = true;
  if (front && p.weaponMode === "sword") out.shoot = f % 9 < 2;
  const z = hazardAt(sim, p.x, p.y, p.w, p.h);
  if (!z) return out;
  if (!top && !fly && z.shape === "rect" && z.y1 - z.y0 < 2.2 && z.x1 - z.x0 > 8) {
    // Tia quét sát sàn khắp phòng: nhảy khi sắp bùng
    out.jump = z.liveAt - sim.time < 0.3 && sim.time < z.endAt;
    if (!p.onGround) out.jump = true;
    return out;
  }
  // Tìm chỗ an toàn gần nhất
  const found = { at: null as [number, number] | null, d: 1e9 };
  const tryAt = (x: number, y: number) => {
    if (x < 1 || x > sim.width - 2) return;
    if (hazardAt(sim, x, y, p.w, p.h, 3)) return;
    if (!top && !fly) {
      // Phải có đất dưới chân, không lao xuống vực
      const r = Math.round(y) - 1;
      const c = Math.floor(x);
      if (sim.tile(c, r) !== "#" && sim.tile(c, r) !== "=") return;
      if (sim.tile(c, Math.round(y)) === "#") return;
    }
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < found.d) (found.d = d), (found.at = [x, y]);
  };
  if (top || fly) {
    for (let r = 0.8; r <= 5; r += 0.6) for (let a = 0; a < 16; a++) tryAt(p.x + Math.cos((a / 16) * Math.PI * 2) * r, p.y + Math.sin((a / 16) * Math.PI * 2) * r);
  } else for (let d = 0.4; d <= 7; d += 0.3) for (const sgn of [1, -1]) tryAt(p.x + sgn * d, p.y);
  if (!found.at) return out;
  const [tx, ty] = found.at;
  out.left = tx < p.x - 0.1;
  out.right = tx > p.x + 0.1;
  if (top || fly) {
    out.up = ty > p.y + 0.1;
    out.down = ty < p.y - 0.1;
  }
  // Còn xa thì lướt cho kịp
  out.dash = found.d > 2 && z.liveAt - sim.time < 0.6;
  return out;
}

export function sidePlay(sim: PlatformerSim, f: number, state: { dashUntil: number; lastX: number; stillFor: number }): Input {
  const p = sim.player;
  const boss = sim.boss;
  const c = Math.floor(p.x);
  const feet = Math.round(p.y);
  const solid = (cc: number, r: number) => sim.tile(cc, r) === "#";
  const ground = (cc: number) => solid(cc, feet - 1) || sim.tile(cc, feet - 1) === "=";
  // Đánh trùm
  if (sim.bossActive && boss && boss.alive) {
    const dx = boss.x - p.x;
    const style = sim.def.bossStyle ?? "brute";
    const dir = dx > 0 ? 1 : -1;
    const near = Math.abs(dx) < 4;
    let move = 0;
    if (style === "charger") {
      // Đứng sát tường đối diện để nó lao vào tường; gồng thì chuẩn bị nhảy
      const [ax, bx] = sim.def.bossArena;
      // Chọn bức tường phía bên kia so với trùm, không đi xuyên qua nó
      const wallX = boss.x > (ax + bx) / 2 ? ax + 1.5 : bx - 0.5;
      if (Math.abs(p.x - wallX) > 0.6 && boss.move !== "charge") move = p.x < wallX ? 1 : -1;
      const jump = (boss.move === "charge" && Math.abs(dx) < 5) || threat(sim);
      const stunned = sim.time < boss.stunUntil;
      if (stunned) {
        // Trùm choáng ngay chỗ mình đứng (thường là đang đứng trên đầu nó): lùi ra 3 ô, quay lại bắn
        // Cầm kiếm thì áp sát trong tầm chém
        const blade = WEAPONS[sim.weapon].style === "blade";
        const tooClose = Math.abs(dx) < (blade ? 1.9 : 2.8);
        const away = tooClose ? -dir : 0;
        const turn = !tooClose && p.facing !== dir;
        const go = away || (Math.abs(dx) > (blade ? 2.8 : 6) ? dir : 0) || (turn ? dir : 0);
        return { ...NO_INPUT, left: go < 0, right: go > 0, jump: threat(sim), shoot: !tooClose && f % 6 < 3 };
      }
      // Nó lao tới: nhảy vọt qua đầu sang phía sau lưng nó
      const over = boss.move === "charge" && Math.abs(dx) < 6;
      return { ...NO_INPUT, left: over ? dir < 0 : move < 0, right: over ? dir > 0 : move > 0, jump, shoot: false };
    }
    // Chung: giữ khoảng cách vừa, quay mặt về trùm, bắn khi trúng được, nạp đạn lúc trùm có khiên
    if (Math.abs(dx) < 3.5) move = -dir;
    else if (Math.abs(dx) > 9) move = dir;
    const faceFix = move === 0 && p.facing !== dir;
    const canHit = !boss.guard;
    // Khiên: giữ nút để nạp đầy chờ lộ điểm yếu; riêng Director Vane phải bắn liên tục để hạ tên lửa
    const shoot = canHit || style === "overlord" ? f % 10 < 5 : true;
    const releaseCharge = canHit && p.charge > 1.3;
    return {
      ...NO_INPUT,
      left: move < 0 || (faceFix && dir < 0),
      right: move > 0 || (faceFix && dir > 0),
      jump: threat(sim) || (p.onGround && near),
      shoot: releaseCharge ? false : shoot,
    };
  }
  // Vượt màn
  const wallAhead = solid(c + 1, feet) || solid(c + 1, feet + 1);
  const gapAhead = [1, 2].some((d) => !ground(c + d) || sim.tile(c + d, feet) === "^");
  let gapLen = 0;
  while (gapLen < 10 && !ground(c + 1 + gapLen) && !solid(c + 1 + gapLen, feet)) gapLen++;
  if (p.onGround && gapLen >= 4) state.dashUntil = f + 20;
  // Kẹt (đứng một chỗ quá lâu): thử nhảy kép
  if (Math.abs(p.x - state.lastX) < 0.05) state.stillFor++;
  else state.stillFor = 0;
  state.lastX = p.x;
  const jump = p.onGround ? wallAhead || gapAhead || threat(sim) : p.vy > 0 || p.wallNear !== 0 || (state.stillFor > 30 && f % 20 < 2);
  return { ...NO_INPUT, right: true, jump, shoot: f % 8 < 4, dash: f < state.dashUntil };
}

/** Đi 8 hướng: tìm đường BFS tới mục tiêu, bắn quái gần nhất, đánh trùm vòng quanh */
export function topPlay(sim: PlatformerSim, f: number, path: { cells: [number, number][]; at: number; lx?: number; ly?: number; still?: number }): Input {
  const p = sim.player;
  // Kẹt (đứng yên quá lâu): bỏ qua ô hiện tại, lách sang ô kế
  path.still = Math.hypot(p.x - (path.lx ?? 0), p.y - (path.ly ?? 0)) < 0.02 ? (path.still ?? 0) + 1 : 0;
  path.lx = p.x;
  path.ly = p.y;
  if ((path.still ?? 0) > 40 && path.at < path.cells.length - 1) {
    path.at++;
    path.still = 0;
  }
  const boss = sim.boss!;
  const nearest = sim.enemies.filter((e) => e.alive && e.awake && Math.hypot(e.x - p.x, e.y - p.y) < 9).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  // Mục tiêu đi: theo đường BFS tới phòng trùm, vào rồi thì vòng quanh trùm
  let tx: number;
  let ty: number;
  if (sim.bossActive && boss.alive) {
    const a = sim.time * 0.8;
    // Cầm kiếm: trùm choáng / mở điểm yếu thì áp sát trong tầm chém, còn lại vòng quanh giữ khoảng cách
    const blade = WEAPONS[sim.weapon].style === "blade";
    const open = sim.time < boss.stunUntil || (!boss.guard && sim.def.bossStyle === "watcher");
    const r = boss.move === "windup" ? 7 : blade && open ? 2 : 5;
    tx = boss.x + Math.cos(a) * r;
    ty = boss.y + Math.sin(a) * r;
  } else {
    while (path.at < path.cells.length - 1 && Math.hypot(path.cells[path.at][0] + 0.5 - p.x, path.cells[path.at][1] + 0.5 - (p.y + p.h / 2)) < 0.3) path.at++;
    [tx, ty] = path.cells[Math.min(path.at, path.cells.length - 1)].map((v) => v + 0.5) as [number, number];
  }
  const target = sim.bossActive && boss.alive ? boss : nearest;
  // Cung: giữ nút gần 1 giây cho kéo đầy rồi thả (tên xuyên, sát thương lớn)
  const bow = WEAPONS[sim.weapon].style === "bow";
  const shootPhase = bow ? Math.floor((f % 64) / 6.4) : f % 10;
  // Cung đánh trùm: kéo dây sẵn lúc trùm còn khiên / nhắm mắt, lộ điểm yếu và kéo đầy thì quay về nó mà thả
  if (bow && target === boss) {
    const release = !boss.guard && p.charge >= T.shot.chargeFull;
    if (release) {
      const dx = boss.x - p.x;
      const dy = boss.y - p.y;
      return { ...NO_INPUT, right: dx > 0.4, left: dx < -0.4, up: dy > 0.4, down: dy < -0.4 };
    }
  }
  // Khung 0–2: đứng lại bắn (ngắm hỗ trợ tự quay về quái gần nhất); khung còn lại: bắn và đi
  if (target && shootPhase < 3 && !(target === boss && boss.guard) && !(bow && target === boss)) {
    return { ...NO_INPUT, shoot: !bow || shootPhase !== 0 };
  }
  const dx = tx - p.x;
  const dy = ty - (p.y + p.h / 2);
  // Đi theo đường lưới: ưu tiên trục lệch nhiều hơn (không đi chéo cạ góc tường)
  const ax = Math.abs(dx) >= Math.abs(dy) || sim.bossActive;
  return { ...NO_INPUT, right: (ax || Math.abs(dx) > 0.15) && dx > 0.1, left: (ax || Math.abs(dx) > 0.15) && dx < -0.1, up: (!ax || Math.abs(dy) > 0.15) && dy > 0.1, down: (!ax || Math.abs(dy) > 0.15) && dy < -0.1, shoot: !!target && (bow ? target === boss || (f % 64 > 4 && f % 64 < 60) : shootPhase < 6 && !(target === boss && boss.guard)), dash: sim.bossActive && boss.move === "windup" && f % 30 === 0 };
}

export function bfs(sim: PlatformerSim, from: [number, number], to: [number, number]) {
  const ok = (c: number, r: number) => !"#^o".includes(sim.tile(c, r));
  const key = (c: number, r: number) => r * sim.width + c;
  const prev = new Map<number, number>();
  const q: [number, number][] = [from];
  prev.set(key(...from), -1);
  while (q.length) {
    const [c, r] = q.shift()!;
    if (c === to[0] && r === to[1]) break;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n: [number, number] = [c + dc, r + dr];
      if (!ok(...n) || prev.has(key(...n))) continue;
      // Không đi sát tường để thân 0.8 ô không cạ góc
      prev.set(key(...n), key(c, r));
      q.push(n);
    }
  }
  const cells: [number, number][] = [];
  let k = key(...to);
  while (k !== -1 && prev.has(k)) {
    cells.unshift([k % sim.width, Math.floor(k / sim.width)]);
    k = prev.get(k)!;
  }
  return cells;
}

export function shmupPlay(sim: PlatformerSim, f: number): Input {
  const p = sim.player;
  const boss = sim.boss!;
  let best = p.y;
  let bestScore = -1e9;
  for (let y = 1; y < sim.height - 2; y += 0.5) {
    let clear = true;
    for (let dx = 0; dx <= 7 && clear; dx++) for (let dy = 0; dy <= 2 && clear; dy++) if (sim.tile(Math.floor(p.x + dx), Math.floor(y + dy)) === "#") clear = false;
    if (!clear) continue;
    let score = -Math.abs(y - p.y);
    // Trùm: thẳng hàng miệng rồng lúc phun lửa (để bắn), lệch hàng lúc nghỉ (né đạn)
    if (sim.bossActive && boss.alive) score = -Math.abs(y - (boss.y + 1 + (boss.guard ? 4 : 0)));
    // Né đạn địch
    if (sim.shots.some((s) => s.enemy && Math.abs(s.x - p.x) < 4 && Math.abs(s.y - y - 0.5) < 1)) score -= 5;
    if (score > bestScore) {
      bestScore = score;
      best = y;
    }
  }
  // Vũ khí tầm gần (shotgun): bay áp sát trùm như người chơi thật, giữ khoảng cách an toàn
  const close = WEAPONS[sim.weapon].style === "spread";
  const tx = sim.bossActive && boss.alive && close ? boss.x - 5 : p.x;
  return { ...NO_INPUT, up: best > p.y + 0.2, down: best < p.y - 0.2, right: tx > p.x + 0.5, left: tx < p.x - 0.5, shoot: f % 8 < 4 };
}

/** Bộ điều khiển tự chơi cho một lượt chơi: gọi mỗi bước mô phỏng, trả về thao tác (toạ độ mô phỏng) */
export function createAutoplay(sim: PlatformerSim) {
  const def = sim.def;
  const state = { dashUntil: 0, lastX: 0, stillFor: 0 };
  const path = { cells: [] as [number, number][], at: 0 };
  const [ax, bx] = def.bossArena;
  const goal: [number, number] = [Math.floor((ax + bx) / 2), Math.floor(sim.boss?.y ?? def.start[1])];
  if (def.mode === "topdown") path.cells = bfs(sim, [Math.floor(sim.player.x), Math.floor(sim.player.y)], goal);
  let deaths = sim.deaths;
  let f = 0;
  return (): Input => {
    if (def.mode === "topdown" && sim.deaths !== deaths) {
      deaths = sim.deaths;
      const cells = bfs(sim, [Math.floor(sim.player.x), Math.floor(sim.player.y)], goal);
      if (cells.length) (path.cells = cells), (path.at = 0);
    }
    const base = def.mode === "topdown" ? topPlay(sim, f, path) : def.mode === "shmup" ? shmupPlay(sim, f) : sidePlay(sim, f, state);
    return dodge(sim, base, f++);
  };
}
