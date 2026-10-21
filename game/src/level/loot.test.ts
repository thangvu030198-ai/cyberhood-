import { describe, expect, it } from "vitest";
import { rarityIndex } from "../sim/config";
import { freshPity } from "../sim/loot";
import { createRng } from "../sim/rng";
import { LevelBuilder } from "./level1";
import { LEVEL_TUNING as T } from "./levelTuning";
import { LOOT, chestContents, keptOnQuit, rollEnemyDrops, type LootDrop } from "./loot";
import { NO_INPUT, PlatformerSim, type LevelDef } from "./platformer";

function flat(over: Partial<LevelDef> = {}): LevelDef {
  const b = new LevelBuilder(60, 16);
  b.ground(0, 0, 16).ground(59, 59, 16).ground(1, 58, 2);
  return { id: "t", name: "t", rows: b.rows(), start: [5.5, 2], checkpoints: [], enemies: [], pickups: [], bossArena: [200, 210], theme: "quarantine", ...over };
}

function run(sim: PlatformerSim, frames: number, input = NO_INPUT) {
  for (let i = 0; i < frames; i++) sim.step(input);
}

describe("đồ rơi", () => {
  it("tỉ lệ rơi của lính gần đúng bảng (10.000 lần hạ)", () => {
    const ctx = { rng: createRng(7), pity: freshPity(), mapMultiplier: 1 };
    const n = 10000;
    const count = { part: 0, cred: 0, chestKey: 0, keyShard: 0 } as Record<string, number>;
    for (let i = 0; i < n; i++) for (const d of rollEnemyDrops("trooper", ctx)) count[d.kind]++;
    for (const k of ["part", "cred", "chestKey", "keyShard"] as const) expect(count[k] / n).toBeCloseTo(LOOT.enemy.trooper[k], 1);
  });

  it("trùm luôn rơi 2 linh kiện từ Sử thi trở lên, kèm Chìa rương", () => {
    const ctx = { rng: createRng(1), pity: freshPity(), mapMultiplier: 1 };
    for (let i = 0; i < 50; i++) {
      const drops = rollEnemyDrops("boss", ctx);
      const parts = drops.filter((d) => d.kind === "part");
      expect(parts.length).toBe(2);
      for (const p of parts) if (p.kind === "part") expect(rarityIndex(p.part.rarity)).toBeGreaterThanOrEqual(rarityIndex("epic"));
      expect(drops.some((d) => d.kind === "chestKey")).toBe(true);
    }
  });

  it("rương vàng chỉ ra đồ Sử thi trở lên", () => {
    const ctx = { rng: createRng(3), pity: freshPity(), mapMultiplier: 1 };
    for (let i = 0; i < 50; i++)
      for (const d of chestContents("gold", ctx)) if (d.kind === "part") expect(rarityIndex(d.part.rarity)).toBeGreaterThanOrEqual(rarityIndex("epic"));
  });

  it("bỏ dở màn mất 30% đồ từ Hiếm trở xuống, giữ nguyên đồ Sử thi", () => {
    const ctx = { rng: createRng(5), pity: freshPity(), mapMultiplier: 1 };
    const low: LootDrop[] = Array.from({ length: 10 }, () => ({ kind: "part" as const, part: { ...chestPart(ctx), rarity: "rare" as const } }));
    const epic: LootDrop = { kind: "part", part: { ...chestPart(ctx), rarity: "epic" } };
    const kept = keptOnQuit([...low, epic, { kind: "cred", amount: 5 }], createRng(9));
    expect(kept.length).toBe(12 - 3);
    expect(kept).toContain(epic);
  });
});

function chestPart(ctx: { rng: () => number; pity: ReturnType<typeof freshPity>; mapMultiplier: number }) {
  const d = chestContents("bronze", ctx).find((x) => x.kind === "part")!;
  if (d.kind !== "part") throw new Error();
  return d.part;
}

describe("đồ rơi trong màn", () => {
  it("hạ địch thì đồ bật ra, rơi xuống đất, đứng gần thì tự hút vào và được tính", () => {
    const sim = new PlatformerSim(flat({ enemies: [{ kind: "trooper", x: 12, y: 2 }] }), { seed: 11 });
    run(sim, 120);
    // Ép chắc chắn có đồ rơi để kiểm tra luồng nhặt
    sim.enemies[0].hp = 1;
    const before = sim.pickups.length;
    const drops: LootDrop[] = [{ kind: "cred", amount: 4 }, { kind: "chestKey" }];
    (sim as unknown as { spawnDrops: (x: number, y: number, d: LootDrop[]) => void }).spawnDrops(9, 3, drops);
    // 4 CRED vỡ thành 2 đồng xu + 1 chìa
    expect(sim.pickups.length).toBe(before + 3);
    run(sim, 30);
    for (const k of sim.pickups.slice(before)) expect(k.y).toBeGreaterThanOrEqual(1.99);
    run(sim, 90, { ...NO_INPUT, right: true });
    expect([...new Set(sim.collected.map((d) => d.kind))].sort()).toEqual(["chestKey", "cred"]);
    expect(sim.collected.reduce((n, d) => n + (d.kind === "cred" ? d.amount : 0), 0)).toBe(4);
    expect(sim.chestKeys).toBe(1);
  });

  it("rương cần chìa: không chìa thì nhắc, có chìa thì mở và rơi đồ Hiếm trở lên", () => {
    const events: string[] = [];
    const def = flat({ chests: [{ x: 9.5, y: 2, tier: "bronze" }] });
    const locked = new PlatformerSim(def, { seed: 2 });
    locked.onEvent = (k) => events.push(k);
    run(locked, 120);
    run(locked, 60, { ...NO_INPUT, right: true });
    expect(events).toContain("chestLocked");
    expect(locked.chests[0].opened).toBe(false);

    const open = new PlatformerSim(def, { seed: 2, chestKeys: 1 });
    run(open, 120);
    run(open, 120, { ...NO_INPUT, right: true });
    run(open, 60, { ...NO_INPUT, left: true });
    expect(open.chests[0].opened).toBe(true);
    expect(open.chestKeys).toBe(0);
    const parts = open.collected.filter((d) => d.kind === "part");
    expect(parts.length).toBe(LOOT.chest.bronze.parts);
    for (const p of parts) if (p.kind === "part") expect(rarityIndex(p.part.rarity)).toBeGreaterThanOrEqual(rarityIndex("rare"));
  });

  it("hạ trùm: đồ trùm được gom tự động khi qua màn", () => {
    const sim = new PlatformerSim(flat({ enemies: [{ kind: "boss", x: 30, y: 2 }], bossArena: [20, 50] }), { seed: 4 });
    run(sim, 120);
    sim.player.x = 25;
    run(sim, 5, { ...NO_INPUT, right: true });
    sim.boss!.hp = 1;
    let f = 0;
    while (sim.status === "playing" && f++ < 600) {
      sim.player.hp = T.player.maxHp;
      sim.step({ ...NO_INPUT, shoot: f % 6 < 3 });
    }
    expect(sim.status).toBe("cleared");
    expect(sim.collected.filter((d) => d.kind === "part").length).toBe(LOOT.bossParts);
  });
});
