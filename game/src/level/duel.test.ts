import { describe, expect, it } from "vitest";
import { DUEL, DuelSim, NO_DUEL, type DuelInput } from "./duel";

function fight(sim: DuelSim, frames: number, input: Partial<DuelInput> | ((f: number) => Partial<DuelInput>)) {
  for (let f = 0; f < frames; f++) sim.step({ ...NO_DUEL, ...(typeof input === "function" ? input(f) : input) });
}

function ready() {
  const sim = new DuelSim(3);
  fight(sim, Math.ceil(DUEL.introTime / DUEL.step) + 1, {});
  expect(sim.status).toBe("fight");
  // Tắt AI để kiểm tra luật: đặt đối thủ đứng yên
  (sim as unknown as { think: () => { now: DuelInput; prev: DuelInput } }).think = () => ({ now: NO_DUEL, prev: NO_DUEL });
  return sim;
}

describe("đối kháng 1v1", () => {
  it("đấm trúng khi trong tầm, trượt khi ngoài tầm", () => {
    const sim = ready();
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    fight(sim, 30, (f) => ({ punch: f === 0 }));
    expect(sim.foe.hp).toBe(DUEL.maxHp - DUEL.moves.punch.damage);
    sim.player.x = -5;
    sim.foe.x = 5;
    const hp = sim.foe.hp;
    fight(sim, 30, (f) => ({ punch: f === 0 }));
    expect(sim.foe.hp).toBe(hp);
  });

  it("đỡ đòn chỉ mất một phần nhỏ sát thương", () => {
    const sim = ready();
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    (sim as unknown as { think: () => { now: DuelInput; prev: DuelInput } }).think = () => ({ now: { ...NO_DUEL, block: true }, prev: { ...NO_DUEL, block: true } });
    fight(sim, 40, (f) => ({ kick: f === 0 }));
    expect(sim.foe.hp).toBeCloseTo(DUEL.maxHp - DUEL.moves.kick.damage * DUEL.blockChip, 5);
  });

  it("combo 3 đòn liên tiếp: đòn thứ 3 mạnh gấp rưỡi", () => {
    const sim = ready();
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    const presses = new Set([0, 21, 42]);
    fight(sim, 80, (f) => {
      sim.foe.x = sim.player.x + 1.1; // giữ đối thủ trong tầm dù bị đẩy lùi
      return { punch: presses.has(f) };
    });
    const d = DUEL.moves.punch.damage;
    expect(sim.foe.hp).toBeCloseTo(DUEL.maxHp - d * 2 - d * DUEL.comboBonus, 5);
  });

  it("hết máu thì thắng; hết giờ thì ai nhiều máu hơn thắng", () => {
    const sim = ready();
    sim.foe.hp = 3;
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    fight(sim, 30, (f) => ({ punch: f === 0 }));
    expect(sim.status).toBe("won");
    const s2 = ready();
    s2.player.hp = 50;
    fight(s2, Math.ceil(DUEL.roundTime / DUEL.step) + 10, {});
    expect(s2.status).toBe("lost");
  });

  it("AI tiến lại gần và đánh người chơi đứng yên", () => {
    const sim = new DuelSim(9);
    fight(sim, 60 * 12, {});
    expect(sim.player.hp).toBeLessThan(DUEL.maxHp);
  });
});
