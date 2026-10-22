import { describe, expect, it } from "vitest";
import { SIEGE, SiegeSim } from "./siegeSim";

const run = (sim: SiegeSim, secs: number, each?: (s: SiegeSim) => void) => {
  for (let i = 0; i < secs / SIEGE.step && sim.phase !== "end"; i++) {
    each?.(sim);
    sim.step();
  }
};

describe("công thành", () => {
  it("chia quân 30% người thật / 70% NPC, tiểu đội 2 NPC theo người chơi", () => {
    const sim = new SiegeSim({ perSide: 100 });
    const att = sim.units.filter((u) => u.side === 0);
    expect(att.length).toBe(99);
    expect(sim.units.filter((u) => u.side === 1).length).toBe(100);
    expect(att.filter((u) => u.hero).length).toBe(29);
    expect(sim.units.filter((u) => u.squad).length).toBe(2);
    expect(Math.max(...att.filter((u) => !u.hero).map((u) => u.power))).toBeLessThanOrEqual(0.65);
  });

  it("khiên chặn quân tấn công; tường thành chỉ qua được cổng đã vỡ", () => {
    const sim = new SiegeSim();
    const out = sim.constrain(0, 75, 0, 60, 0);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThanOrEqual(SIEGE.dome.r - 0.01);
    for (const o of sim.objectives) if (o.kind === "gen") o.alive = false;
    const wall = sim.constrain(10, 44, 10, 40, 0);
    expect(Math.hypot(wall.x, wall.z)).toBeGreaterThan(SIEGE.wall.r);
    sim.obj("gate", 0)!.alive = false;
    const gate = sim.constrain(0, 44, 0, 40, 0);
    expect(gate.z).toBeCloseTo(40, 5);
  });

  it("phá đủ 3 máy phát thì khiên sập, sang giai đoạn phá cổng", () => {
    const sim = new SiegeSim();
    run(sim, 1);
    for (const o of sim.objectives) if (o.kind === "gen") sim.damageObjective(o, 99999);
    run(sim, 0.2);
    expect(sim.shieldUp).toBe(false);
    expect(sim.phase).toBe("gate");
  });

  it("Bom Nova xoá sổ quân Hunter trong vùng; Extra Coin cứu người chơi", () => {
    const sim = new SiegeSim({ extraCoin: true });
    sim.phase = "core";
    for (const o of sim.objectives) if (o.kind === "gen" || o.kind === "gate") o.alive = false;
    sim.towerTaken = [true, true];
    for (const u of sim.units) if (u.side === 0) (u.x = 0), (u.z = -6);
    sim.player.x = 0;
    sim.player.z = -8;
    sim.coreHold = SIEGE.nova.at - 0.01;
    run(sim, SIEGE.nova.warn + 0.5, (s) => {
      s.player.x = 0;
      s.player.z = -8;
      // Chỉ thử Bom Nova: đạn thường không hạ được người chơi trong lúc chờ
      if (!s.novaUsed || s.time < s.novaAt + SIEGE.nova.warn - 0.1) s.player.hp = 100;
    });
    console.log("nova", sim.novaUsed, sim.coreHold, sim.alive(0), sim.player.alive, sim.player.extraCoin, sim.phase);
    expect(sim.novaUsed).toBe(true);
    expect(sim.alive(0)).toBe(0);
    expect(sim.player.alive).toBe(true);
    expect(sim.player.extraCoin).toBe(false);
  });

  it("tự chạy cả trận (không người chơi can thiệp): trận tiến triển và kết thúc trong thời lượng, chạy đủ nhanh", () => {
    const sim = new SiegeSim({ perSide: 100, seed: 3 });
    sim.player.alive = false;
    const t0 = performance.now();
    const seen = new Set<string>();
    run(sim, SIEGE.duration + 30, (s) => seen.add(s.phase));
    const ms = performance.now() - t0;
    console.log("phases", [...seen].join(">"), "winner", sim.winner, "t", Math.round(sim.time), "tickets", sim.tickets, "ms", Math.round(ms));
    expect(sim.phase).toBe("end");
    expect(seen.has("shield")).toBe(true);
    expect(ms).toBeLessThan(20000);
  });
});
