// Chơi thử tự động như người chơi thật: máu thật (không hồi), đi hết màn, đánh trùm theo mẹo của từng trùm,
// mỗi map chơi nhiều lượt với hạt giống khác nhau. In bảng kết quả (thời gian, số lần chết, máu mất) và
// kiểm tra màn nào cũng qua được trong thời gian hợp lý ở độ khó Thường với súng tay mặc định.

import { describe, expect, it } from "vitest";
import { LEVEL_1 } from "./level1";
import { LEVEL_CITADEL, LEVEL_HOTEL, LEVEL_HUNT, LEVEL_PARISH, LEVEL_WARZONE } from "./maps";
import { WEAPONS } from "./gear";
import { LEVEL_TUNING as T } from "./levelTuning";
import { NO_INPUT, PlatformerSim, type Input, type LevelDef, type SimOptions } from "./platformer";

type Report = { map: string; seed: number; cleared: boolean; time: number; deaths: number; hpLost: number; bossTime: number; stuck: string };

/** Bot né đạn: có đạn địch bay tới gần ngang người thì nhảy */
function threat(sim: PlatformerSim) {
  const p = sim.player;
  return sim.shots.some((s) => s.enemy && Math.abs(s.y - (p.y + 0.9)) < 1.3 && Math.abs(s.x - p.x) < 3.2 && Math.sign(p.x - s.x) === Math.sign(s.vx || 1));
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
  // Khung 0: quay mặt về mục tiêu (nhả nút bắn để đổi hướng ngắm); khung còn lại: bắn và đi
  if (target && shootPhase === 0 && !(target === boss && boss.guard) && !(bow && target === boss)) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    return { ...NO_INPUT, right: dx > 0.4, left: dx < -0.4, up: dy > 0.4, down: dy < -0.4 };
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

export function playthrough(def: LevelDef, seed: number, opts: SimOptions = {}, maxSec = 420, human = 0.03): Report {
  const sim = new PlatformerSim(def, { seed, ...opts });
  let hpLost = 0;
  let bossAt = 0;
  const state = { dashUntil: 0, lastX: 0, stillFor: 0 };
  const path = { cells: [] as [number, number][], at: 0 };
  let deaths = 0;
  const [ax, bx] = def.bossArena;
  const goal: [number, number] = [Math.floor((ax + bx) / 2), Math.floor(sim.boss!.y)];
  if (def.mode === "topdown") path.cells = bfs(sim, [Math.floor(def.start[0]), Math.floor(def.start[1])], goal);
  let lastHp = sim.player.hp;
  let f = 0;
  // Phản xạ người thật: thỉnh thoảng phản ứng trễ vài khung (giữ nguyên thao tác cũ), mỗi seed một kiểu
  let rs = seed * 9301 + 49297;
  const rnd = () => ((rs = (rs * 233280 + 49297) % 2147483647) / 2147483647);
  let lag = 0;
  let last: Input = NO_INPUT;
  for (; f < 60 * maxSec && sim.status !== "cleared"; f++) {
    const fresh = def.mode === "topdown" ? topPlay(sim, f, path) : def.mode === "shmup" ? shmupPlay(sim, f) : sidePlay(sim, f, state);
    if (lag <= 0 && rnd() < human) lag = 2 + Math.floor(rnd() * 8);
    const input = lag-- > 0 ? last : fresh;
    last = input;
    sim.step(input);
    if (sim.player.hp < lastHp) hpLost += lastHp - sim.player.hp;
    lastHp = sim.player.hp;
    if (sim.bossActive && !bossAt) bossAt = sim.time;
    // Chết thì lộ trình đi 8 hướng tính lại từ checkpoint
    if (def.mode === "topdown" && sim.status === "playing" && sim.deaths !== deaths) {
      deaths = sim.deaths;
      const p = sim.player;
      const cells = bfs(sim, [Math.floor(p.x), Math.floor(p.y)], goal);
      if (cells.length) {
        path.cells = cells;
        path.at = 0;
      }
    }
  }
  return {
    map: def.id,
    seed,
    cleared: sim.status === "cleared",
    time: Math.round(sim.time),
    deaths: sim.deaths,
    hpLost,
    bossTime: sim.status === "cleared" ? Math.round(sim.clearedAt - bossAt) : -1,
    stuck: sim.status === "cleared" ? "" : `x=${sim.player.x.toFixed(1)} y=${sim.player.y.toFixed(1)} boss=${sim.bossActive ? sim.boss!.hp.toFixed(1) : "-"}`,
  };
}

export const MAPS = [LEVEL_1, LEVEL_HOTEL, LEVEL_WARZONE, LEVEL_CITADEL, LEVEL_HUNT, LEVEL_PARISH];

describe("chơi thử tự động (như người chơi)", () => {
  for (const def of MAPS)
    it(`${def.name}: qua màn ở độ khó Thường, súng tay mặc định`, () => {
      const runs = [1, 2, 3].map((seed) => playthrough(def, seed));
      console.log(runs.map((r) => `${r.map.padEnd(14)} seed ${r.seed} · ${r.cleared ? "QUA" : "KẸT"} · ${r.time}s · chết ${r.deaths} · mất ${r.hpLost} máu · trùm ${r.bossTime}s ${r.stuck}`).join("\n"));
      for (const r of runs) {
        expect(r.cleared, `${r.map} seed ${r.seed} ${r.stuck}`).toBe(true);
        expect(r.deaths, `${r.map} seed ${r.seed}`).toBeLessThanOrEqual(6);
      }
    }, 120000);
});

describe("chơi thử ở độ khó cao (báo cáo)", () => {
  it("Khó: bot vẫn qua hết; Ác mộng: thử thách thật (bot không né giỏi như người)", () => {
    const hard = MAPS.map((def) => playthrough(def, 1, { difficulty: "hard" }));
    const nm = MAPS.map((def) => playthrough(def, 1, { difficulty: "nightmare" }));
    const line = (tag: string) => (r: Report) => `${tag} ${r.map.padEnd(14)} · ${r.cleared ? "QUA" : "KẸT"} · ${r.time}s · chết ${r.deaths} · mất ${r.hpLost} máu · trùm ${r.bossTime}s ${r.stuck}`;
    console.log([...hard.map(line("KHÓ    ")), ...nm.map(line("ÁC MỘNG"))].join("\n"));
    expect(hard.filter((r) => r.cleared).length).toBe(MAPS.length);
  }, 300000);
});
