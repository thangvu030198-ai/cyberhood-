import { describe, expect, it } from "vitest";
import { LEVEL_1, LevelBuilder } from "./level1";
import { LEVEL_TUNING as T } from "./levelTuning";
import { NO_INPUT, PlatformerSim, type Input, type LevelDef } from "./platformer";

/** Màn thử nghiệm nhỏ: đất phẳng cao 2, tuỳ chỉnh thêm qua `extra` */
function testLevel(extra: (b: LevelBuilder) => void = () => {}, over: Partial<LevelDef> = {}): LevelDef {
  const b = new LevelBuilder(60, 16);
  b.ground(0, 0, 16).ground(59, 59, 16).ground(1, 58, 2);
  extra(b);
  return { id: "t", name: "t", rows: b.rows(), start: [5.5, 2], checkpoints: [], enemies: [], pickups: [], bossArena: [200, 210], theme: "quarantine", ...over };
}

function play(sim: PlatformerSim, frames: number, input: Partial<Input> | ((f: number) => Partial<Input>)) {
  for (let f = 0; f < frames; f++) sim.step({ ...NO_INPUT, ...(typeof input === "function" ? input(f) : input) });
}

function ready(def: LevelDef) {
  const sim = new PlatformerSim(def);
  play(sim, Math.ceil(T.introTime / T.step) + 2, {});
  expect(sim.status).toBe("playing");
  return sim;
}

describe("platformer: di chuyển", () => {
  it("đứng vững trên mặt đất", () => {
    const sim = ready(testLevel());
    play(sim, 60, {});
    expect(sim.player.y).toBeCloseTo(2, 3);
    expect(sim.player.onGround).toBe(true);
  });

  it("chạy sang phải với tốc độ runSpeed", () => {
    const sim = ready(testLevel());
    const x0 = sim.player.x;
    play(sim, 60, { right: true });
    expect(sim.player.x - x0).toBeCloseTo(T.player.runSpeed, 0);
  });

  it("giữ nút nhảy lên cao hơn 2 ô, nhấp nhanh thì nhảy thấp", () => {
    let sim = ready(testLevel());
    let top = 0;
    play(sim, 60, (f) => {
      top = Math.max(top, sim.player.y);
      return { jump: f < 40 };
    });
    expect(top - 2).toBeGreaterThan(2.2);
    sim = ready(testLevel());
    top = 0;
    play(sim, 60, (f) => {
      top = Math.max(top, sim.player.y);
      return { jump: f < 3 };
    });
    expect(top - 2).toBeLessThan(1.5);
  });

  it("nhảy qua vực rộng 3 ô khi chạy, lướt rồi nhảy qua vực 6 ô", () => {
    for (const [gap, dash] of [
      [3, false],
      [6, true],
    ] as const) {
      // Xoá đất cột 12..12+gap-1
      const rows = testLevel().rows.map((r, i, all) => (i >= all.length - 2 ? r.slice(0, 12) + ".".repeat(gap) + r.slice(12 + gap) : r));
      const sim = ready({ ...testLevel(), rows });
      play(sim, 200, () => {
        const p = sim.player;
        const edge = p.x > 11 && p.x < 12;
        return { right: true, dash: dash && p.x > 8 && p.x < 12, jump: edge || !p.onGround };
      });
      expect(sim.player.x, `vực ${gap}`).toBeGreaterThan(20);
      expect(sim.status).toBe("playing");
    }
  });

  it("rơi xuống vực thì chết và hồi sinh ở checkpoint", () => {
    const rows = testLevel().rows.map((r, i, all) => (i >= all.length - 2 ? r.slice(0, 20) + ".".repeat(10) + r.slice(30) : r));
    const sim = ready({ ...testLevel(), rows, checkpoints: [[15.5, 2]] });
    play(sim, 300, (f) => ({ right: f < 200 }));
    expect(sim.deaths).toBe(1);
    expect(sim.status).toBe("playing");
    expect(sim.player.x).toBeCloseTo(15.5, 1);
    expect(sim.player.hp).toBe(T.player.maxHp);
  });

  it("bám tường trượt chậm, nhảy tường leo lên được trục đứng", () => {
    // Trục đứng hẹp: hai bức tường cách nhau 3 ô, cao 12
    const sim = ready(testLevel((b) => b.ground(10, 11, 14).ground(15, 16, 14)));
    sim.player.x = 13.5;
    let side = 1;
    let pressedAt = 0;
    let top = 0;
    play(sim, 900, (f) => {
      const p = sim.player;
      top = Math.max(top, p.y);
      if (p.wallJumpLock > 0) side = Math.sign(p.vx) || side;
      else if (p.wall !== 0) {
        side = p.wall;
        // Đang bám tường: nhấn nhảy lại (giữ ~0.25s để nhảy cao)
        if (f - pressedAt > 16) pressedAt = f;
      }
      return { right: side > 0, left: side < 0, jump: f - pressedAt < 14 };
    });
    expect(top).toBeGreaterThan(14);
    // Rơi dọc tường mà ép vào tường thì trượt chậm
    const s2 = ready(testLevel((b) => b.ground(10, 11, 14)));
    s2.player.x = 12.45;
    s2.player.y = 10;
    play(s2, 30, { left: true });
    expect(s2.player.wall).toBe(-1);
    expect(s2.player.vy).toBeCloseTo(-T.player.wallSlide, 3);
  });

  it("giữ hướng vào một bức tường và bấm nhảy liên tục thì leo lên được chính bức tường đó", () => {
    const sim = ready(testLevel((b) => b.ground(10, 11, 13)));
    sim.player.x = 12.6;
    let top = 0;
    let pressedAt = -99;
    play(sim, 600, (f) => {
      const p = sim.player;
      top = Math.max(top, p.y);
      if ((p.wall !== 0 || f === 0) && f - pressedAt > 12) pressedAt = f;
      return { left: true, jump: f - pressedAt < 10 };
    });
    // Leo qua đỉnh tường cao 13 rồi đứng trên đó
    expect(top).toBeGreaterThan(12.9);
  });

  it("giữ hướng vào tường + giữ Space: tự leo đều lên tường, không văng xa khỏi tường", () => {
    const sim = ready(testLevel((b) => b.ground(10, 11, 13)));
    sim.player.x = 12.45;
    let maxGap = 0;
    let top = 0;
    play(sim, 400, () => {
      const p = sim.player;
      top = Math.max(top, p.y);
      if (p.y > 3 && p.y < 12) maxGap = Math.max(maxGap, p.x - p.w / 2 - 12);
      return { left: true, jump: true };
    });
    expect(top).toBeGreaterThan(12.9);
    expect(maxGap).toBeLessThan(0.45);
  });

  it("đứng được trên bậc một chiều và nhảy xuyên từ dưới lên", () => {
    const sim = ready(testLevel((b) => b.ledge(4, 8, 4)));
    play(sim, 50, (f) => ({ jump: f < 30 }));
    play(sim, 60, {});
    expect(sim.player.y).toBeCloseTo(4, 2);
  });
});

describe("platformer: bắn và địch", () => {
  it("bắn hạ trooper, tối đa 3 viên đạn thường", () => {
    const sim = ready(testLevel(() => {}, { enemies: [{ kind: "trooper", x: 14, y: 2 }] }));
    let maxShots = 0;
    play(sim, 400, (f) => {
      maxShots = Math.max(maxShots, sim.shots.filter((s) => !s.enemy).length);
      return { shoot: f % 4 < 2 };
    });
    expect(maxShots).toBeLessThanOrEqual(T.shot.maxSmall);
    expect(sim.enemies[0].alive).toBe(false);
    expect(sim.kills).toBe(1);
  });

  it("giữ nút bắn để nạp, đạn nạp đầy xuyên qua nhiều địch", () => {
    const sim = ready(
      testLevel(() => {}, {
        enemies: [
          { kind: "drone", x: 10, y: 2.8 },
          { kind: "drone", x: 13, y: 2.8 },
        ],
      }),
    );
    sim.enemies.forEach((e) => (e.hp = T.shot.full.dmg));
    // Drone đứng yên để kiểm tra đường đạn
    for (const e of sim.enemies) e.homeY = 2.6;
    play(sim, Math.ceil(T.shot.chargeFull / T.step) + 5, { shoot: true });
    play(sim, 60, {});
    expect(sim.enemies.filter((e) => !e.alive).length).toBe(2);
  });

  it("trúng đạn thì mất máu, bất tử trong chốc lát và bị đẩy lùi", () => {
    const sim = ready(testLevel());
    // hết thời gian bất tử lúc xuất hiện
    play(sim, 90, {});
    const hp = sim.player.hp;
    sim.hurt(5, -1);
    expect(sim.player.hp).toBe(hp - 5);
    sim.hurt(5, -1);
    expect(sim.player.hp).toBe(hp - 5);
    play(sim, 10, {});
    expect(sim.player.vx).toBeLessThan(0);
    play(sim, Math.ceil(T.player.invuln / T.step), {});
    sim.hurt(5, -1);
    expect(sim.player.hp).toBe(hp - 10);
  });

  it("gai gây sát thương", () => {
    const sim = ready(testLevel((b) => b.spikes(9, 11, 2)));
    play(sim, 60, { right: true });
    expect(sim.player.hp).toBeLessThan(T.player.maxHp);
  });

  it("vào phòng trùm thì cửa đóng, hạ trùm thì qua màn", () => {
    const sim = ready(testLevel(() => {}, { enemies: [{ kind: "boss", x: 40, y: 2 }], bossArena: [20, 50] }));
    sim.player.x = 23;
    play(sim, 5, { right: true });
    expect(sim.bossActive).toBe(true);
    // Không đi lùi ra khỏi cửa được
    play(sim, 120, { left: true });
    expect(sim.player.x).toBeGreaterThan(20);
    // Bất tử để kiểm tra riêng đường bắn hạ trùm
    let f = 0;
    while (sim.status === "playing" && f++ < 60 * 90) {
      sim.player.hp = T.player.maxHp;
      const boss = sim.boss!;
      const toward = boss.x > sim.player.x ? { right: f % 30 < 2 } : { left: f % 30 < 2 };
      sim.step({ ...NO_INPUT, ...toward, shoot: f % 6 < 3 });
    }
    expect(sim.status).toBe("cleared");
  });
});

describe("màn 1", () => {
  it("bản đồ hợp lệ: mọi hàng cùng độ dài, điểm xuất phát/checkpoint đứng trên đất", () => {
    const sim = new PlatformerSim(LEVEL_1);
    expect(new Set(LEVEL_1.rows.map((r) => r.length)).size).toBe(1);
    for (const [x, y] of [LEVEL_1.start, ...LEVEL_1.checkpoints]) {
      expect(sim.tile(Math.floor(x), y - 1), `đất dưới (${x}, ${y})`).toBe("#");
      expect(sim.tile(Math.floor(x), y), `trống tại (${x}, ${y})`).toBe(".");
    }
    expect(LEVEL_1.enemies.filter((e) => e.kind === "boss").length).toBe(1);
  });

  it("bot đơn giản (chạy, nhảy ở mép, bắn liên tục) đi hết màn tới phòng trùm", () => {
    const sim = ready(LEVEL_1);
    let f = 0;
    while (!sim.bossActive && f++ < 60 * 240) {
      const p = sim.player;
      const c = Math.floor(p.x);
      const feet = Math.round(p.y);
      // Phía trước: tường cao, hoặc không có đất / có gai trong 2 ô tới
      const wallAhead = sim.tile(c + 1, feet) === "#" || sim.tile(c + 1, feet + 1) === "#";
      const gapAhead = [1, 2].some((d) => sim.tile(c + d, feet - 1) === "." || sim.tile(c + d, feet) === "^");
      const jump = p.onGround ? wallAhead || gapAhead : p.vy > 0 || p.wall !== 0;
      sim.step({ ...NO_INPUT, right: true, jump, shoot: f % 8 < 4 });
    }
    expect(sim.bossActive).toBe(true);
    expect(sim.deaths).toBeLessThanOrEqual(2);
    expect(sim.time).toBeLessThan(180);
  });
});

describe("trùm có mẹo", () => {
  const arena = (style: import("./platformer").BossStyle, mode?: import("./platformer").PlayMode) => {
    const b = new LevelBuilder(60, 16);
    b.ground(0, 0, 16).ground(59, 59, 16).ground(1, 58, 2);
    const def: LevelDef = { id: "t", name: "t", rows: b.rows(), start: [5.5, 2], checkpoints: [], enemies: [{ kind: "boss", x: 40.5, y: 2 }], pickups: [], bossArena: [20, 50], theme: "quarantine", bossStyle: style, mode };
    const sim = ready(def);
    sim.player.x = 25;
    play(sim, 2, {});
    expect(sim.bossActive).toBe(true);
    return sim;
  };
  const hit = (sim: PlatformerSim) => {
    const boss = sim.boss!;
    sim.shots.push({ x: boss.x, y: boss.y + 1, vx: 0, vy: 0, r: 0.3, dmg: 2, pierce: false, life: 0.5, enemy: false, level: 0 });
    const hp = boss.hp;
    play(sim, 1, {});
    return hp - boss.hp;
  };

  it("charger: có khiên thì đạn bật ra; lao vào tường thì choáng và nhận sát thương tăng", () => {
    const sim = arena("charger");
    play(sim, 10, {});
    expect(sim.boss!.guard).toBe(true);
    expect(hit(sim)).toBe(0);
    // Đứng sát tường phải để nó lao vào, nhảy lên tránh
    sim.player.x = 49;
    let stunned = false;
    for (let f = 0; f < 60 * 8 && !stunned; f++) {
      sim.player.invuln = 9;
      sim.step({ ...NO_INPUT, jump: f % 30 < 20 });
      stunned = sim.time < sim.boss!.stunUntil;
    }
    expect(stunned).toBe(true);
    play(sim, 1, {});
    expect(sim.boss!.guard).toBe(false);
    expect(hit(sim)).toBeCloseTo(2 * T.boss.stunMul, 5);
  });

  it("phantom: ẩn hình thì miễn sát thương, hiện hình thì trúng và gọi hồn ma", () => {
    const sim = arena("phantom");
    let sawGuard = false;
    let sawOpen = false;
    for (let f = 0; f < 60 * 12; f++) {
      sim.player.invuln = 9;
      sim.step(NO_INPUT);
      if (sim.boss!.guard) sawGuard = true;
      else if (sim.boss!.move === "appear") sawOpen = true;
    }
    expect(sawGuard && sawOpen).toBe(true);
    expect(sim.enemies.some((e) => e.minion)).toBe(true);
  });

  it("overlord: bắn hạ đủ tên lửa thì khiên vỡ", () => {
    const sim = arena("overlord");
    play(sim, 10, {});
    expect(sim.boss!.guard).toBe(true);
    for (let k = 0; k < T.boss.overlordBreak; k++) {
      sim.shots.push({ x: 30, y: 5, vx: 0, vy: 0, r: 0.35, dmg: 3, pierce: false, life: 5, enemy: true, level: 1, missile: true });
      sim.shots.push({ x: 30, y: 5, vx: 0, vy: 0, r: 0.2, dmg: 1, pierce: false, life: 1, enemy: false, level: 0 });
      play(sim, 1, {});
    }
    play(sim, 1, {});
    expect(sim.boss!.guard).toBe(false);
  });

  it("đập đất: rơi thẳng xuống và hạ quái quanh chỗ đáp", () => {
    const def: LevelDef = { ...testLevel(), enemies: [{ kind: "zombie", x: 7.5, y: 2 }] };
    const sim = ready(def);
    sim.enemies[0].awake = true;
    sim.enemies[0].hp = 3;
    play(sim, 12, { jump: true });
    play(sim, 1, { jump: false, down: true });
    play(sim, 2, { jump: true, down: true });
    play(sim, 40, {});
    expect(sim.enemies[0].alive).toBe(false);
  });

  it("nhảy kép: nhấn nhảy lần nữa trên không thì bay cao hơn", () => {
    const one = ready(testLevel());
    let top1 = 0;
    play(one, 70, (f) => ((top1 = Math.max(top1, one.player.y)), { jump: f < 30 }));
    const two = ready(testLevel());
    let top2 = 0;
    play(two, 90, (f) => ((top2 = Math.max(top2, two.player.y)), { jump: f < 20 || (f > 24 && f < 50) }));
    expect(top2).toBeGreaterThan(top1 + 1);
  });
});
