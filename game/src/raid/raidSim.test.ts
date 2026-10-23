import { describe, expect, it } from "vitest";
import { RaidSim, RAID, creatureHp, teamCheck, type TeamSlot } from "./raidSim";

const team = (humans: number, elites: number): TeamSlot[] => [
  { name: "Bạn", kind: "player", role: "dps", power: 1 },
  ...Array.from({ length: humans - 1 }, (_, i) => ({ name: `H${i}`, kind: "human" as const, role: (["tank", "healer", "dps", "support"] as const)[i % 4], power: 1 })),
  ...Array.from({ length: elites }, (_, i) => ({ name: `E${i}`, kind: "elite" as const, role: (["tank", "healer", "dps", "support", "dps"] as const)[i % 5], power: 0.8 })),
];

describe("Raid Leviathan", () => {
  it("máu tăng theo số người, luật người thật / NPC theo độ khó", () => {
    const N = RAID.difficulty.normal.hpMul;
    expect(creatureHp(4, "normal")).toBe(Math.round(RAID.baseHp * N));
    expect(creatureHp(10, "normal")).toBeCloseTo(RAID.baseHp * 3.1 * N, -2);
    expect(teamCheck(team(1, 3), "normal")).toBeNull();
    expect(teamCheck(team(1, 2), "normal")).toMatch(/tối thiểu 4/);
    expect(teamCheck(team(1, 5), "nightmare")).toMatch(/người thật/);
    expect(teamCheck(team(2, 7), "nightmare")).toMatch(/NPC/);
    expect(teamCheck(team(4, 4), "legend")).toBeNull();
  });

  it("thân rắn bám theo đầu, đủ đốt, cách đều", () => {
    const s = new RaidSim(team(1, 5), "normal", 3);
    for (let i = 0; i < 400; i++) s.update(0.05);
    expect(s.body.length).toBe(RAID.segments);
    const d = Math.hypot(s.body[5].x - s.body[6].x, s.body[5].y - s.body[6].y, s.body[5].z - s.body[6].z);
    expect(d).toBeCloseTo(RAID.spacing, 0);
  });

  it("phá đủ 4 cột thu lôi → tê liệt, lộ lõi tim nhận ×2,5", () => {
    const s = new RaidSim(team(1, 5), "normal", 5);
    for (const r of s.rods) s.hitRod(r, 1e6, true);
    expect(s.exposed() || s.time < s.paralyzeUntil).toBe(true);
    s.update(0.05);
    expect(s.head.mode).toBe("paralyzed");
    const hp = s.hp;
    s.damage(100, "player", -3);
    expect(hp - s.hp).toBeCloseTo(100 * 2.5 * RAID.playerRole.dps.dmgMul, 3);
  });

  it("phá bộ phận rơi nguyên liệu cho cả đội", () => {
    const s = new RaidSim(team(1, 5), "normal", 9);
    s.damage(1e5, "player", 0);
    expect(s.parts[0].broken).toBe(true);
    expect(s.materials.lev_horn).toBe(1);
  });

  it("đồng bộ 3 Mech → ngã quỵ 10 giây", () => {
    const s = new RaidSim(team(1, 5), "normal", 11);
    s.members.slice(0, 3).forEach((m) => (m.inMech = true));
    s.update(0.05);
    expect(s.downUntil).toBeGreaterThan(s.time + 9);
    s.update(0.05);
    expect(s.head.mode).toBe("down");
  });

  it("đội NPC tinh anh + người chơi đứng yên vẫn hạ được ở Thường trước khi cuồng nộ, đi đủ 3 giai đoạn", () => {
    const s = new RaidSim(team(1, 7), "normal", 21);
    s.player.alive = false;
    s.player.downAt = 1e9;
    const phases = new Set<string>();
    while (s.phase !== "end" && s.time < 900) {
      s.update(0.05);
      phases.add(s.phase);
    }
    expect(phases.has("frenzy")).toBe(true);
    expect(phases.has("despair")).toBe(true);
    expect(s.winner).toBe("team");
    expect(s.time).toBeLessThan(RAID.difficulty.normal.enrage + 120);
    expect(s.parts.some((p) => p.broken)).toBe(true);
  });
});
