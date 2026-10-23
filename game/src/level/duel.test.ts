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
    expect(sim.foe.hp).toBe(DUEL.maxHp - DUEL.moves.jabL.damage);
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
    expect(sim.foe.hp).toBeCloseTo(DUEL.maxHp - DUEL.moves.knee.damage * DUEL.blockChip, 5);
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
    // Chuỗi J: jab trái → jab phải → móc trái (đòn thứ 3 nhân thưởng combo)
    const M = DUEL.moves;
    expect(sim.foe.hp).toBeCloseTo(DUEL.maxHp - M.jabL.damage - M.jabR.damage - M.hookL.damage * DUEL.comboBonus, 5);
  });

  it("bấm sớm lúc đòn trước chưa xong thì đòn sau vẫn ra liền mạch (đệm phím)", () => {
    const sim = ready();
    sim.player.x = -0.7;
    sim.foe.x = 0.7;
    // Bấm J lần hai khi jab trái còn đang thu đòn: phải ra jab phải ngay khi rảnh
    const second = Math.round((DUEL.moves.jabL.startup + DUEL.moves.jabL.active + 0.05) / DUEL.step);
    let jabR = false;
    fight(sim, 60, (f) => {
      sim.foe.x = sim.player.x + 1.4;
      if (sim.player.move === "jabR") jabR = true;
      return { punch: f === 0 || f === second };
    });
    expect(jabR).toBe(true);
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

  it("đòn thứ 4 chuỗi đấm (móc ngửa) đánh ngã; nằm sàn và lúc đứng dậy thì không trúng đòn", () => {
    const sim = ready();
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    const presses = new Set([0, 21, 42, 66]);
    fight(sim, 100, (f) => {
      if (f < 90) sim.foe.x = sim.player.x + 1.1;
      return { punch: presses.has(f) };
    });
    expect(sim.events.some((e) => e.kind === "knock" && e.move === "upperR")).toBe(true);
    expect(sim.lying(sim.foe)).toBe(true);
    const hp = sim.foe.hp;
    sim.foe.x = sim.player.x + 1;
    fight(sim, 20, (f) => ({ punch: f === 0 }));
    expect(sim.foe.hp).toBe(hp);
  });

  it("quét trụ (giữ S + K) xuyên thế đỡ nhiều hơn và đánh ngã", () => {
    const sim = ready();
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    (sim as unknown as { think: () => { now: DuelInput; prev: DuelInput } }).think = () => ({ now: { ...NO_DUEL, block: true }, prev: { ...NO_DUEL, block: true } });
    fight(sim, 40, (f) => ({ block: true, kick: f === 0 }));
    expect(sim.foe.hp).toBeCloseTo(DUEL.maxHp - DUEL.moves.sweep.damage * DUEL.lowChip, 5);
    expect(sim.foe.downUntil).toBeGreaterThan(0);
  });

  it("né (L) lùi ra sau và tránh được đòn", () => {
    const sim = ready();
    sim.player.x = -0.6;
    sim.foe.x = 0.6;
    sim.foe.move = "jabL";
    sim.foe.moveAt = sim.time;
    fight(sim, 20, (f) => ({ dodge: f === 0 }));
    expect(sim.player.hp).toBe(DUEL.maxHp);
    expect(sim.player.x).toBeLessThan(-0.6);
  });

  it("AI tiến lại gần và đánh người chơi đứng yên", () => {
    const sim = new DuelSim(9);
    fight(sim, 60 * 12, {});
    expect(sim.player.hp).toBeLessThan(DUEL.maxHp);
  });
});

describe("thang đấu trường", () => {
  it("đối thủ bậc cao nhiều máu hơn và đánh đau hơn", async () => {
    const { DuelSim, RIVALS, DUEL } = await import("./duel");
    const weak = new DuelSim(1, RIVALS[0]);
    const champ = new DuelSim(1, RIVALS[RIVALS.length - 1]);
    expect(champ.foe.hp).toBeGreaterThan(weak.foe.hp);
    for (const sim of [weak, champ]) {
      sim.status = "fight";
      sim.foe.x = sim.player.x + 1;
      sim.foe.facing = -1;
      sim.foe.move = "jabL";
      sim.foe.moveAt = sim.time - DUEL.moves.jabL.startup;
    }
    weak.step({ left: false, right: false, jump: false, block: false, punch: false, kick: false });
    champ.step({ left: false, right: false, jump: false, block: false, punch: false, kick: false });
    expect(DUEL.maxHp - champ.player.hp).toBeGreaterThan(DUEL.maxHp - weak.player.hp);
  });
});
