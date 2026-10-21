import { describe, expect, it } from "vitest";
import { LEVEL_1 } from "./level1";
import { LEVEL_CITADEL, LEVEL_HOTEL, LEVEL_HUNT, LEVEL_PARISH, LEVEL_TOWER, LEVEL_WARZONE } from "./maps";
import { LEVEL_TUNING as T } from "./levelTuning";
import { NO_INPUT, PlatformerSim, type LevelDef } from "./platformer";

/** Bot đi ngang: chạy phải, bắn, nhảy khi gặp tường/hố/gai, giữ nhảy khi sát tường (tự leo), lướt qua hố rộng */
function platformBot(def: LevelDef, maxSec = 300) {
  const sim = new PlatformerSim(def, { seed: 1 });
  let f = 0;
  let dashUntil = 0;
  while (!sim.bossActive && f++ < 60 * maxSec) {
    const p = sim.player;
    p.hp = T.player.maxHp;
    const c = Math.floor(p.x);
    const feet = Math.round(p.y);
    const solid = (cc: number, r: number) => sim.tile(cc, r) === "#";
    const ground = (cc: number) => solid(cc, feet - 1) || sim.tile(cc, feet - 1) === "=";
    const wallAhead = solid(c + 1, feet) || solid(c + 1, feet + 1);
    const gapAhead = [1, 2].some((d) => !ground(c + d) || sim.tile(c + d, feet) === "^");
    let gapLen = 0;
    while (gapLen < 10 && !ground(c + 1 + gapLen) && !solid(c + 1 + gapLen, feet)) gapLen++;
    if (p.onGround && gapLen >= 4) dashUntil = f + 20;
    const jump = p.onGround ? wallAhead || gapAhead : p.vy > 0 || p.wallNear !== 0;
    sim.step({ ...NO_INPUT, right: true, jump, shoot: f % 8 < 4, dash: f < dashUntil });
  }
  return sim;
}

/** Bot bay: nhắm vào giữa khe trống rộng nhất phía trước, gần độ cao hiện tại nhất; luôn bắn */
function shmupBot(def: LevelDef, maxSec = 200) {
  const sim = new PlatformerSim(def, { seed: 1 });
  let f = 0;
  let crashes = 0;
  sim.onEvent = () => {};
  const hp0 = () => sim.player.hp;
  while (!sim.bossActive && f++ < 60 * maxSec) {
    const p = sim.player;
    const before = hp0();
    let best = p.y;
    let bestScore = -1e9;
    for (let y = 1; y < sim.height - 2; y += 0.5) {
      let clear = true;
      for (let dx = 0; dx <= 7 && clear; dx++)
        for (let dy = 0; dy <= 2 && clear; dy++) if (sim.tile(Math.floor(p.x + dx), Math.floor(y + dy)) === "#") clear = false;
      if (!clear) continue;
      const score = -Math.abs(y - p.y);
      if (score > bestScore) {
        bestScore = score;
        best = y;
      }
    }
    sim.step({ ...NO_INPUT, up: best > p.y + 0.2, down: best < p.y - 0.2, shoot: f % 8 < 4 });
    // Chỉ đếm va chạm địa hình (trúng đạn không tính)
    const q = sim.player;
    let inRock = false;
    for (let c = Math.floor(q.x - q.w / 2); c <= Math.floor(q.x + q.w / 2); c++)
      for (let r = Math.floor(q.y + 0.3); r <= Math.floor(q.y + q.h - 0.3); r++) if (sim.tile(c, r) === "#") inRock = true;
    if (inRock && sim.player.hp < before) crashes++;
    sim.player.hp = T.player.maxHp;
  }
  return { sim, crashes };
}

/** Tháp leo: tìm đường trên lưới ô đứng được (đi bộ, rơi, nhảy ≤ 2 ô lên / 4 ô ngang, leo tường) tới sân thượng */
function climbReachable(def: LevelDef) {
  const sim = new PlatformerSim(def);
  const t = (c: number, r: number) => sim.tile(c, r);
  const free = (c: number, r: number) => t(c, r) !== "#";
  const stand = (c: number, r: number) => free(c, r) && free(c, r + 1) && (t(c, r - 1) === "#" || t(c, r - 1) === "=") && t(c, r) !== "^";
  const key = (c: number, r: number) => `${c},${r}`;
  const start: [number, number] = [Math.floor(def.start[0]), def.start[1]];
  const seen = new Set([key(...start)]);
  const queue = [start];
  let top = start[1];
  const push = (c: number, r: number) => {
    if (r < 0 || r >= sim.height || !stand(c, r) || seen.has(key(c, r))) return;
    seen.add(key(c, r));
    queue.push([c, r]);
  };
  while (queue.length) {
    const [c, r] = queue.shift()!;
    top = Math.max(top, r);
    for (const dc of [-1, 1]) {
      // đi bộ / rơi xuống
      if (stand(c + dc, r)) push(c + dc, r);
      else if (free(c + dc, r)) {
        let rr = r;
        while (rr > 0 && !stand(c + dc, rr)) rr--;
        push(c + dc, rr);
      }
      // leo tường: sát tường thì lên được tới đỉnh tường
      if (!free(c + dc, r) && !free(c + dc, r + 1)) {
        let rr = r;
        while (rr < sim.height && !free(c + dc, rr) && free(c, rr + 2)) rr++;
        if (free(c + dc, rr)) push(c + dc, rr);
      }
    }
    // nhảy: lên tối đa 2 ô (xuyên được bậc một chiều, không xuyên ô đặc phía trên đầu)
    for (let up = 1; up <= 2; up++) {
      if (!free(c, r + up + 1)) break;
      for (let dc = -4; dc <= 4; dc++) if (Math.abs(dc) <= (up === 2 ? 3 : 4)) push(c + dc, r + up);
    }
  }
  return top;
}

describe("các map", () => {
  for (const def of [LEVEL_1, LEVEL_HOTEL, LEVEL_TOWER, LEVEL_WARZONE, LEVEL_CITADEL, LEVEL_HUNT, LEVEL_PARISH]) {
    describe(`${def.name} (${def.mode ?? "platform"})`, () => {
      it("bản đồ hợp lệ: hàng đều nhau, điểm xuất phát/checkpoint/rương không nằm trong khối đặc, đúng 1 trùm", () => {
        const sim = new PlatformerSim(def);
        expect(new Set(def.rows.map((r) => r.length)).size).toBe(1);
        const flying = def.mode === "shmup" || def.mode === "topdown";
        const ok = (x: number, y: number) => {
          const free = (t: string) => t !== "#" && t !== "o";
          const here = free(sim.tile(Math.floor(x), y)) && free(sim.tile(Math.floor(x), y + 1));
          const below = sim.tile(Math.floor(x), y - 1);
          return here && (flying || below === "#" || below === "=");
        };
        for (const [x, y] of [def.start, ...def.checkpoints]) expect(ok(x, y), `${def.id} điểm (${x}, ${y})`).toBe(true);
        for (const c of def.chests ?? []) expect(ok(c.x, c.y), `${def.id} rương (${c.x}, ${c.y})`).toBe(true);
        for (const en of def.enemies) expect(sim.tile(Math.floor(en.x), Math.floor(en.y)), `${def.id} địch ${en.kind} (${en.x}, ${en.y})`).toMatch(/[.^=]/);
        expect(def.enemies.filter((x) => x.kind === "boss").length).toBe(1);
      });

      if ((def.mode ?? "platform") === "platform")
        it("đi được tới phòng trùm (bot chạy, nhảy, leo tường, lướt)", () => {
          const sim = platformBot(def);
          expect(sim.bossActive, `${def.id} dừng ở x=${sim.player.x.toFixed(1)} y=${sim.player.y.toFixed(1)}`).toBe(true);
          expect(sim.deaths).toBeLessThanOrEqual(3);
        });

      if (def.mode === "climb")
        it("có đường leo từ đáy lên sân thượng phòng trùm", () => {
          expect(climbReachable(def)).toBeGreaterThanOrEqual(def.bossFloor!);
        });

      if (def.mode === "topdown")
        it("có lối đi từ điểm xuất phát tới khu mục tiêu, mọi rương và checkpoint", () => {
          const sim = new PlatformerSim(def);
          const ok = (c: number, r: number) => !"#^o".includes(sim.tile(c, r));
          const seen = new Set<string>();
          const q: [number, number][] = [[Math.floor(def.start[0]), Math.floor(def.start[1])]];
          while (q.length) {
            const [c, r] = q.shift()!;
            const k = `${c},${r}`;
            if (seen.has(k) || !ok(c, r)) continue;
            seen.add(k);
            q.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
          }
          const at = (x: number, y: number) => seen.has(`${Math.floor(x)},${Math.floor(y)}`);
          expect(at(def.bossArena[0] + 3, 20)).toBe(true);
          for (const c of def.chests ?? []) expect(at(c.x, c.y), `rương (${c.x}, ${c.y})`).toBe(true);
          for (const [x, y] of def.checkpoints) expect(at(x, y), `checkpoint (${x}, ${y})`).toBe(true);
        });

      if (def.mode === "shmup")
        it("bay tới phòng trùm, ít va chạm địa hình", () => {
          const { sim, crashes } = shmupBot(def);
          expect(sim.bossActive, `dừng ở x=${sim.player.x.toFixed(1)}`).toBe(true);
          expect(crashes).toBeLessThanOrEqual(3);
        });
    });
  }
});

describe("chế độ leo tháp", () => {
  it("sương dâng lên theo thời gian; đứng yên thì bị sương nuốt rồi hồi sinh ở checkpoint", () => {
    const sim = new PlatformerSim(LEVEL_TOWER, { seed: 1 });
    const y0 = sim.fogY;
    let maxFog = y0;
    let f = 0;
    while (sim.deaths === 0 && f++ < 60 * 40) {
      sim.player.hp = T.player.maxHp;
      sim.step(NO_INPUT);
      maxFog = Math.max(maxFog, sim.fogY);
    }
    expect(maxFog).toBeGreaterThan(sim.player.y);
    expect(sim.deaths).toBe(1);
    expect(sim.fogY).toBeLessThan(sim.player.y);
  });
});

describe("chế độ bay", () => {
  it("màn hình tự cuộn, người chơi bị giữ trong khung hình, bay lên xuống tự do", () => {
    const sim = new PlatformerSim(LEVEL_WARZONE, { seed: 1 });
    for (let i = 0; i < 200; i++) sim.step(NO_INPUT);
    const sx = sim.scrollX;
    const y = sim.player.y;
    for (let i = 0; i < 60; i++) sim.step({ ...NO_INPUT, up: true, left: true });
    expect(sim.scrollX).toBeGreaterThan(sx + 3);
    expect(sim.player.y).toBeGreaterThan(y);
    expect(sim.player.x).toBeGreaterThanOrEqual(sim.scrollX - T.shmup.viewHalf + 1 - 1e-6);
  });
});

describe("chế độ đi 8 hướng", () => {
  it("đi chéo được, không xuyên tường, bắn theo hướng nhìn", () => {
    const sim = new PlatformerSim(LEVEL_HUNT, { seed: 1 });
    for (let i = 0; i < 120; i++) sim.step(NO_INPUT);
    const x0 = sim.player.x;
    const y0 = sim.player.y;
    for (let i = 0; i < 30; i++) sim.step({ ...NO_INPUT, right: true, up: true });
    expect(sim.player.x).toBeGreaterThan(x0 + 1);
    expect(sim.player.y).toBeGreaterThan(y0 + 1);
    // Đâm vào tường viền trái: không ra ngoài
    for (let i = 0; i < 120; i++) sim.step({ ...NO_INPUT, left: true });
    expect(sim.player.x).toBeGreaterThan(1);
    // Nhìn lên rồi bắn: đạn bay theo +y
    sim.step({ ...NO_INPUT, up: true });
    sim.step({ ...NO_INPUT, up: true, shoot: true });
    const shot = sim.shots.find((s) => !s.enemy)!;
    expect(shot.vy).toBeGreaterThan(0);
    expect(Math.abs(shot.vx)).toBeLessThan(1e-6);
  });

  it("zombie đuổi theo người chơi trên mặt đất", () => {
    const sim = new PlatformerSim(LEVEL_HUNT, { seed: 1 });
    for (let i = 0; i < 120; i++) sim.step(NO_INPUT);
    const z = sim.enemies.find((e) => e.kind === "zombie")!;
    sim.player.x = z.x - 5;
    sim.player.y = z.y;
    const zx0 = z.x;
    for (let i = 0; i < 40; i++) {
      sim.player.hp = T.player.maxHp;
      sim.step(NO_INPUT);
    }
    expect(z.x).toBeLessThan(zx0 - 0.5);
  });
});
