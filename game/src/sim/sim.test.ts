import { describe, expect, it } from "vitest";
import { GAME, MECH_SLOTS, RARITIES } from "./config";
import { createRng } from "./rng";
import { freshPity, makePart, rarityTable, rollRarity, type MechPart } from "./loot";
import type { MechSlot } from "./config";
import { assembleMech, BASE_MECH_POWER, craft, mechPower, mechRarity, pvpPower, repairCost, smelt } from "./mech";
import { canTransform, damageMech, freshTransform, gainMeter, hitByEmp, startTransform, tickTransform } from "./transform";
import { addKill, canExtract, completeEvent, completeMission, contractScore, finishContract, startContract, starsFor, tickContract } from "./contract";
import { currentEnergy, spendEnergy } from "./energy";
import { addShards, freshSeason, launchpadTier } from "./season";

const spots = Array.from({ length: 12 }, (_, i) => ({ x: i * 10, z: -i * 7 }));
const setup = (seed = 1) => ({ seed, mapId: "neon_city" as const, markerSpots: spots, extractSpots: [{ x: 0, z: 0 }] });

describe("bảng rơi đồ", () => {
  it("tổng xác suất luôn bằng 1 và đúng tỉ lệ gốc ở map ×1", () => {
    const t = rarityTable();
    expect(Object.values(t).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    for (const r of RARITIES) expect(t[r]).toBeCloseTo(GAME.dropTable.rarity[r], 10);
  });

  it("map khó và biến hình tăng phần đồ hiếm, bớt phần Thường", () => {
    const easy = rarityTable({ mapMultiplier: 1 });
    const hard = rarityTable({ mapMultiplier: 2, transforming: true });
    expect(hard.legendary).toBeCloseTo(easy.legendary * 2.2, 10);
    expect(hard.common).toBeLessThan(easy.common);
  });

  it("thả hàng tiếp tế không bao giờ ra dưới Sử thi", () => {
    const rng = createRng(7);
    const pity = freshPity();
    for (let i = 0; i < 2000; i++) {
      const r = rollRarity(rng, pity, { minRarity: "epic" });
      expect(["epic", "legendary", "mythic"]).toContain(r);
    }
  });

  it("tần suất thực tế khớp bảng (100k lượt, tắt pity)", () => {
    const rng = createRng(42);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<string, number>;
    const N = 100_000;
    for (let i = 0; i < N; i++) counts[rollRarity(rng, freshPity())]++;
    expect(counts.common / N).toBeCloseTo(0.6, 1);
    expect(counts.rare / N).toBeCloseTo(0.3, 1);
    expect(counts.epic / N).toBeGreaterThan(0.07);
    expect(counts.epic / N).toBeLessThan(0.09);
  });

  it("pity: lượt thứ 60 không ra Huyền thoại thì chắc chắn ra", () => {
    const always0 = () => 0; // luôn ra Thường
    const pity = freshPity();
    for (let i = 0; i < GAME.dropTable.pity.legendary - 1; i++) expect(rollRarity(always0, pity)).toBe("common");
    expect(rollRarity(always0, pity)).toBe("legendary");
    expect(pity.sinceLegendary).toBe(0);
  });

  it("pity Thần thoại ở lượt 500", () => {
    const always0 = () => 0;
    const pity = { sinceLegendary: 0, sinceMythic: GAME.dropTable.pity.mythic - 1 };
    expect(rollRarity(always0, pity)).toBe("mythic");
  });

  it("hệ số chỉ số nằm trong khoảng của độ hiếm", () => {
    const rng = createRng(3);
    for (const r of RARITIES) {
      const [lo, hi] = GAME.dropTable.statRange[r];
      for (let i = 0; i < 200; i++) {
        const p = makePart(rng, r);
        expect(p.statMul).toBeGreaterThanOrEqual(lo);
        expect(p.statMul).toBeLessThanOrEqual(hi);
      }
    }
  });
});

describe("Mech", () => {
  const rng = createRng(9);
  const full = (r: (typeof RARITIES)[number]) =>
    Object.fromEntries(MECH_SLOTS.map((s) => [s, makePart(rng, r, s)])) as Record<MechSlot, MechPart>;

  it("ráp đủ 4 khe mới thành Mech, độ hiếm theo món yếu nhất", () => {
    expect(assembleMech({ core: makePart(rng, "epic", "core") })).toBeNull();
    const parts = full("legendary");
    parts.armor = makePart(rng, "rare", "armor");
    const mech = assembleMech(parts)!;
    expect(mechRarity(mech.parts)).toBe("rare");
    expect(mech.durability).toBe(GAME.mech.durability.rare);
  });

  it("chênh lệch sức mạnh tối đa +35%, PvP nén còn +20%", () => {
    const commonPower = mechPower(full("common"));
    expect(commonPower).toBe(BASE_MECH_POWER);
    const best = Object.fromEntries(MECH_SLOTS.map((s) => [s, { ...makePart(rng, "mythic", s), statMul: 1.35 }])) as Record<MechSlot, MechPart>;
    expect(mechPower(best) / commonPower).toBeCloseTo(1.35, 2);
    expect(pvpPower(mechPower(best)) / commonPower).toBeCloseTo(1.2, 2);
  });

  it("phí sửa tính theo điểm độ bền thiếu", () => {
    const mech = assembleMech(full("epic"))!;
    mech.durability -= 10;
    expect(repairCost(mech)).toBeCloseTo(10 * GAME.mech.repairTokenPerPoint.epic);
  });

  it("ghép 5 Thường: thành công ra Hiếm, thất bại giữ 2 món", () => {
    const inputs = Array.from({ length: 5 }, () => makePart(rng, "common"));
    const ok = craft(() => 0, inputs);
    expect(ok.ok && ok.success && ok.result.rarity).toBe("rare");
    const fail = craft(() => 0.99, inputs);
    expect(fail.ok && !fail.success && fail.kept.length).toBe(2);
    expect(craft(rng, inputs.slice(0, 4)).ok).toBe(false);
  });

  it("nung chảy: 4 món ra 1 món cùng bậc, 1 món ra 1 món bậc thấp hơn", () => {
    expect(smelt(rng, Array.from({ length: 4 }, () => makePart(rng, "epic"))).map((p) => p.rarity)).toEqual(["epic"]);
    expect(smelt(rng, [makePart(rng, "epic")]).map((p) => p.rarity)).toEqual(["rare"]);
  });
});

describe("biến hình", () => {
  it("chạy đủ vòng NORMAL → TRANSFORMING → ACTIVE → REVERTING → NORMAL", () => {
    const s = freshTransform("titan_frame");
    expect(canTransform(s, 5)).toBe(false);
    for (let i = 0; i < 5; i++) gainMeter(s, "mission");
    expect(s.meter).toBe(100);
    expect(canTransform(s, 0)).toBe(false); // hết độ bền
    expect(startTransform(s, 5, 100)).toBe(true);
    expect(s.mechMaxHp).toBe(500);
    damageMech(s, 999); // bất tử khi đang biến hình
    expect(s.mechHp).toBe(500);
    expect(tickTransform(s, 1.5)).toBe("activated");
    expect(s.timer).toBe(20);
    hitByEmp(s);
    expect(s.timer).toBe(15);
    expect(tickTransform(s, 15)).toBe("reverting");
    expect(tickTransform(s, 1)).toBe("reverted");
    expect(s.meter).toBe(0);
    expect(s.cooldown).toBe(60);
    for (let i = 0; i < 5; i++) gainMeter(s, "mission");
    expect(canTransform(s, 5)).toBe(false); // còn hồi chiêu
    tickTransform(s, 60);
    expect(canTransform(s, 5)).toBe(true);
  });

  it("Mech hết máu thì kết thúc sớm", () => {
    const s = freshTransform("titan_frame");
    s.meter = 100;
    startTransform(s, 1, 100);
    tickTransform(s, 1.5);
    damageMech(s, 500);
    expect(tickTransform(s, 0.01)).toBe("reverting");
  });
});

describe("hợp đồng 7 phút", () => {
  it("đặt 6 marker, sự kiện ở phút 4, điểm thoát từ phút 5, hết giờ ở phút 7", () => {
    const c = startContract(setup());
    expect(c.markers).toHaveLength(6);
    const ticks: string[] = [];
    for (let t = 0; t < 421; t++) {
      const e = tickContract(c, 1);
      if (e) ticks.push(`${e}@${Math.round(c.elapsed)}`);
    }
    expect(ticks).toEqual(["event_started@240", "extract_visible@300", "timeout@420"]);
    expect(c.status).toBe("timeout");
  });

  it("cùng seed cho cùng marker, nhiệm vụ và đồ rơi (Solo Thử thách công bằng)", () => {
    const a = startContract(setup(77));
    const b = startContract(setup(77));
    expect(a.markers).toEqual(b.markers);
    expect(completeMission(a, 0)!.drop.rarity).toBe(completeMission(b, 0)!.drop.rarity);
  });

  it("tính điểm, sao và điểm mùa khi thoát thành công", () => {
    const c = startContract(setup(5));
    for (const m of c.markers) completeMission(c, m.id);
    for (let i = 0; i < 20; i++) addKill(c);
    tickContract(c, 240);
    const ev = completeEvent(c);
    tickContract(c, 60);
    expect(canExtract(c, c.extract)).toBe(true);
    const res = finishContract(c, "extracted", 4);
    const expected = 6 * 100 + 20 * 10 + 120 * 2 + ev;
    expect(res.score).toBe(expected);
    expect(contractScore(c)).toBe(expected);
    expect(res.stars).toBe(starsFor(expected));
    expect(res.keptLoot).toHaveLength(6);
    expect(res.lostLoot).toHaveLength(0);
  });

  it("chết: mất 50% mảnh và 50% đồ từ Hiếm trở xuống, giữ Huyền thoại+", () => {
    const c = startContract(setup(11));
    const rng = createRng(1);
    c.loot = [makePart(rng, "common"), makePart(rng, "common"), makePart(rng, "rare"), makePart(rng, "rare"), makePart(rng, "legendary"), makePart(rng, "epic")];
    c.shards = 3;
    const res = finishContract(c, "dead");
    expect(res.lostLoot).toHaveLength(2);
    expect(res.lostLoot.every((p) => p.rarity === "common" || p.rarity === "rare")).toBe(true);
    expect(res.keptLoot.some((p) => p.rarity === "legendary")).toBe(true);
    expect(res.keptLoot.some((p) => p.rarity === "epic")).toBe(true);
    expect(res.lostShards).toBe(1);
    expect(res.shards).toBe(2);
  });

  it("sao theo ngưỡng 500/1200/2000", () => {
    expect([499, 500, 1200, 2000].map(starsFor)).toEqual([0, 1, 2, 3]);
  });
});

describe("năng lượng và mùa", () => {
  it("hồi 1/giờ, không vượt tối đa, tiêu đúng", () => {
    const t0 = 1_000_000;
    let e = { value: 0, updatedAt: t0 };
    expect(currentEnergy(e, t0 + 2.5 * 3600_000).value).toBe(2);
    expect(currentEnergy(e, t0 + 99 * 3600_000).value).toBe(GAME.energy.max);
    e = { value: 1, updatedAt: t0 };
    const spent = spendEnergy(e, t0, 1)!;
    expect(spent.value).toBe(0);
    expect(spendEnergy(spent, t0, 1)).toBeNull();
  });

  it("15 mảnh thành Chìa, tier Launchpad theo chìa và điểm", () => {
    const s = freshSeason();
    expect(addShards(s, "neon_city", 14)).toBeNull();
    expect(addShards(s, "neon_city", 3)).toBe("copper");
    expect(addShards(s, "neon_city", 5)).toBeNull(); // đã có chìa
    s.points = 6000;
    expect(launchpadTier(s)).toBe("bronze");
    addShards(s, "hollow_hotel", 15);
    s.points = 16000;
    expect(launchpadTier(s)).toBe("silver");
    addShards(s, "warzone", 15);
    s.finalGate = true;
    s.points = 30000;
    expect(launchpadTier(s)).toBe("gold");
    expect(launchpadTier(s, { legendaryMech: true })).toBe("diamond");
  });
});
