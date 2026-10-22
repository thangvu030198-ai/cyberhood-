import { describe, expect, it } from "vitest";
import { LevelBuilder } from "./level1";
import { LEVEL_TUNING as T } from "./levelTuning";
import { NO_INPUT, PlatformerSim, type Input, type LevelDef, type SimOptions } from "./platformer";
import { ARMORS, GEAR, GEAR_IDS, rollGear, WEAPONS } from "./gear";
import { chestContents, rollEnemyDrops } from "./loot";
import { createRng } from "../sim/rng";
import { freshPity } from "../sim/loot";
import { rarityIndex } from "../sim/config";

function testLevel(over: Partial<LevelDef> = {}): LevelDef {
  const b = new LevelBuilder(60, 16);
  b.ground(0, 0, 16).ground(59, 59, 16).ground(1, 58, 2);
  return { id: "t", name: "t", rows: b.rows(), start: [5.5, 2], checkpoints: [], enemies: [], pickups: [], bossArena: [200, 210], theme: "quarantine", ...over };
}

function play(sim: PlatformerSim, frames: number, input: Partial<Input> | ((f: number) => Partial<Input>)) {
  for (let f = 0; f < frames; f++) sim.step({ ...NO_INPUT, ...(typeof input === "function" ? input(f) : input) });
}

function ready(opts: SimOptions, over: Partial<LevelDef> = {}) {
  const sim = new PlatformerSim(testLevel(over), { seed: 1, ...opts });
  play(sim, Math.ceil(T.introTime / T.step) + 2, {});
  return sim;
}

const zombieAt = (x: number) => ({ enemies: [{ kind: "zombie" as const, x, y: 2 }] });

describe("trang bị: vũ khí", () => {
  it("súng trường giữ nút là xả liên thanh, không phải bấm lại", () => {
    const sim = ready({ weapon: "ar" });
    let fired = 0;
    play(sim, 60, () => {
      fired = Math.max(fired, sim.fx.filter((f) => f.kind === "shot").length);
      return { shoot: true };
    });
    expect(fired).toBeGreaterThanOrEqual(Math.floor(1 / WEAPONS.ar.cooldown) - 1);
  });

  it("shotgun bắn chùm 3 viên, nạp đầy 5 viên xuyên", () => {
    const sim = ready({ weapon: "shotgun" });
    play(sim, 1, { shoot: true });
    expect(sim.shots.filter((s) => s.kind === "pellet")).toHaveLength(3);
    play(sim, Math.ceil(T.shot.chargeFull / T.step) + 2, { shoot: true });
    play(sim, 1, {});
    const pellets = sim.shots.filter((s) => s.kind === "pellet" && s.pierce);
    expect(pellets).toHaveLength(5);
  });

  it("cung chỉ bắn khi thả dây; kéo đầy thì tên xuyên, mạnh hơn kéo hờ", () => {
    const sim = ready({ weapon: "bow" });
    play(sim, 10, { shoot: true });
    expect(sim.shots).toHaveLength(0);
    play(sim, 1, {});
    const weak = sim.shots.find((s) => s.kind === "arrow")!;
    expect(weak.pierce).toBe(false);
    play(sim, 60, {});
    play(sim, Math.ceil(T.shot.chargeFull / T.step) + 2, { shoot: true });
    play(sim, 1, {});
    const strong = sim.shots.find((s) => s.kind === "arrow" && s !== weak)!;
    expect(strong.pierce).toBe(true);
    expect(strong.dmg).toBeGreaterThan(weak.dmg * 2);
  });

  it("kiếm chém trúng zombie đứng sát, mỗi nhát chỉ tính sát thương một lần", () => {
    const sim = ready({ weapon: "celestial" }, zombieAt(6.8));
    sim.enemies[0].awake = true;
    const hp = sim.enemies[0].hp;
    play(sim, 1, { shoot: true });
    play(sim, 12, {});
    expect(hp - sim.enemies[0].hp).toBeCloseTo(WEAPONS.celestial.dmg, 5);
  });

  it("nhát chém chặt rơi đạn địch bay tới", () => {
    const sim = ready({ weapon: "celestial" });
    sim.shots.push({ x: 7.2, y: 3, vx: -2, vy: 0, r: 0.2, dmg: 2, pierce: false, life: 2, enemy: true, level: 0 });
    play(sim, 1, { shoot: true });
    play(sim, 2, {});
    expect(sim.shots.filter((s) => s.enemy)).toHaveLength(0);
    expect(sim.player.hp).toBe(sim.maxHp);
  });

  it("nạp kiếm thì phóng sóng kiếm bay xa", () => {
    const sim = ready({ weapon: "cosmic" });
    play(sim, Math.ceil(T.shot.chargeFull / T.step) + 2, { shoot: true });
    play(sim, 1, {});
    const wave = sim.shots.find((s) => s.kind === "wave")!;
    expect(wave).toBeDefined();
    expect(wave.dmg).toBe(WEAPONS.cosmic.wave!.dmg);
  });

  it("băng kiếm làm địch chậm lại", () => {
    const sim = ready({ weapon: "frost" }, { enemies: [{ kind: "zombie", x: 6.8, y: 2 }, { kind: "zombie", x: 30, y: 2 }] });
    for (const e of sim.enemies) e.hp = 99;
    play(sim, 1, { shoot: true });
    play(sim, 3, {});
    expect(sim.enemies[0].slowUntil).toBeGreaterThan(sim.time);
    expect(sim.enemies[1].slowUntil).toBeLessThan(0);
  });

  it("lưỡi hái chém cả sau lưng", () => {
    const sim = ready({ weapon: "scythe" }, zombieAt(4.2));
    sim.enemies[0].awake = true;
    sim.player.facing = 1;
    const hp = sim.enemies[0].hp;
    play(sim, 1, { shoot: true });
    play(sim, 3, {});
    expect(sim.enemies[0].hp).toBeLessThan(hp);
  });
});

describe("trang bị: giáp", () => {
  it("giáp thêm máu tối đa và giảm sát thương", () => {
    const sim = ready({ armor: "void" });
    expect(sim.maxHp).toBe(T.player.maxHp + ARMORS.void.hp);
    expect(sim.player.hp).toBe(sim.maxHp);
    sim.player.invuln = 0;
    sim.hurt(10, 1);
    expect(sim.maxHp - sim.player.hp).toBe(Math.round(10 * (1 - ARMORS.void.reduce)));
  });
});

describe("trang bị: rơi đồ", () => {
  it("chọn trang bị theo độ hiếm: thường ra nhiều nhất, đồ tối thiểu được tôn trọng", () => {
    const rng = createRng(7);
    const count: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const g = rollGear(rng);
      count[GEAR[g].rarity] = (count[GEAR[g].rarity] ?? 0) + 1;
    }
    expect(count.common).toBeGreaterThan(count.epic);
    expect(count.epic).toBeGreaterThan(count.mythic ?? 0);
    for (let i = 0; i < 200; i++) expect(rarityIndex(GEAR[rollGear(rng, 1, "epic")].rarity)).toBeGreaterThanOrEqual(rarityIndex("epic"));
  });

  it("trùm và rương vàng hay rơi trang bị, đủ mọi món đều rơi được", () => {
    const rng = createRng(3);
    const ctx = { rng, pity: freshPity(), mapMultiplier: 2 };
    let boss = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 400; i++) {
      for (const d of rollEnemyDrops("boss", ctx)) if (d.kind === "gear") (boss++, seen.add(d.gear));
      for (const d of chestContents("gold", ctx)) if (d.kind === "gear") seen.add(d.gear);
    }
    expect(boss).toBeGreaterThan(100);
    for (let i = 0; i < 3000; i++) for (const d of rollEnemyDrops("zombie", ctx)) if (d.kind === "gear") seen.add(d.gear);
    expect([...seen].sort()).toEqual(GEAR_IDS.filter((g) => !GEAR[g].siegeOnly).sort());
  });
});

describe("tủ đồ 6 ô, cường hoá", () => {
  it("cộng chỉ số từ mũ / găng / giày / chip, cấp cường hoá tăng chỉ số", async () => {
    const { loadoutStats, ENHANCE_STEP } = await import("./gear");
    const l = { weapon: "celestial" as const, armor: "void" as const, head: "helm_oni" as const, hands: "glove_titan" as const, feet: "boot_grav" as const, chip: "chip_luck" as const };
    const a = loadoutStats(l, {});
    expect(a.atk).toBeCloseTo(0.12 + 0.18, 5);
    expect(a.luck).toBeCloseTo(0.25, 5);
    const b = loadoutStats(l, { helm_oni: 5, celestial: 3 });
    expect(b.atk).toBeCloseTo(0.12 * (1 + 5 * ENHANCE_STEP) + 0.18 + 3 * ENHANCE_STEP, 5);
  });

  it("đập đồ: thành công lên cấp, thất bại từ +5 tụt một cấp, dưới +5 giữ nguyên", async () => {
    const { forgeRoll, FORGE } = await import("./gear");
    expect(forgeRoll(0, 0.99)).toEqual({ ok: true, next: 1 });
    expect(forgeRoll(3, 0.999)).toEqual({ ok: false, next: 3 });
    expect(forgeRoll(6, 0.999)).toEqual({ ok: false, next: 5 });
    expect(FORGE.cost(9)).toBeGreaterThan(FORGE.cost(1));
  });

  it("chỉ số áp vào màn chơi: chạy nhanh hơn, máu nhiều hơn, đánh đau hơn", () => {
    const base = ready({});
    const fast = ready({ stats: { atk: 0.5, hp: 10, def: 0, speed: 0.5, jump: 0, charge: 0, luck: 0 } });
    expect(fast.maxHp).toBe(base.maxHp + 10);
    const x0 = base.player.x;
    play(base, 30, { right: true });
    play(fast, 30, { right: true });
    expect(fast.player.x - x0).toBeGreaterThan((base.player.x - x0) * 1.3);
  });
});

describe("vòng quay may mắn", () => {
  it("trọng số: ô thường ra nhiều, Jackpot hiếm", async () => {
    const { pickPrize } = await import("../game/gearStore");
    const n: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const p = pickPrize((i + 0.5) / 5000);
      n[p.id] = (n[p.id] ?? 0) + 1;
    }
    expect(n.cred30).toBeGreaterThan(n.jackpot * 5);
    expect(n.jackpot).toBeGreaterThan(0);
  });
});

describe("bộ Băng Chiến & phân rã", () => {
  it("đồ Băng Chiến không rơi trong màn thường", async () => {
    const { rollGear, ICE_WAR_SET, GEAR } = await import("./gear");
    const { createRng } = await import("../sim/rng");
    expect(ICE_WAR_SET.length).toBe(5);
    const rng = createRng(42);
    for (let i = 0; i < 3000; i++) expect(GEAR[rollGear(rng, 2)].siegeOnly).toBeFalsy();
  });
  it("giá phân rã theo độ hiếm, +10% mỗi cấp cường hoá", async () => {
    const { salvageValue, SALVAGE } = await import("./gear");
    expect(salvageValue("frost")).toBe(SALVAGE.legendary);
    expect(salvageValue("celestial", 6)).toBe(Math.round(SALVAGE.epic * 1.6));
  });
});
