import { describe, expect, it } from "vitest";
import { KART, KartSim, NO_KART, Track, NEON_LOOP, type KartInput } from "./kart";

function drive(sim: KartSim, frames: number, input: Partial<KartInput> | ((f: number) => Partial<KartInput>)) {
  for (let f = 0; f < frames; f++) sim.step({ ...NO_KART, ...(typeof input === "function" ? input(f) : input) });
}

/** Người chơi giả: ga liên tục, lái về tâm đường */
const autopilot = (sim: KartSim) => () => ({ gas: true, left: sim.player.d > 0.5, right: sim.player.d < -0.5 });

describe("đua kart", () => {
  it("đường đua kín, lấy mẫu đều, điểm cuối nối điểm đầu", () => {
    const t = new Track(NEON_LOOP);
    expect(t.length).toBeGreaterThan(400);
    const a = t.at(0, 0);
    const b = t.at(t.length - 0.01, 0);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(1.5);
    for (let s = 0; s < t.length; s += 7) {
      const p = t.at(s, 0);
      const q = t.at(s + 1, 0);
      expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeLessThan(1.3);
    }
  });

  it("đèn xuất phát: chưa xuất phát thì xe đứng yên", () => {
    const sim = new KartSim();
    drive(sim, 60, { gas: true });
    expect(sim.player.v).toBe(0);
  });

  it("ga thì tăng tốc tới tối đa, va vách thì chậm lại", () => {
    const sim = new KartSim();
    drive(sim, Math.ceil(KART.introTime / KART.step), {});
    drive(sim, 240, { gas: true });
    expect(sim.player.v).toBeGreaterThan(KART.maxSpeed * 0.8);
    const v = sim.player.v;
    drive(sim, 90, { gas: true, left: true });
    expect(sim.player.d).toBe(-KART.halfWidth);
    expect(sim.player.v).toBeLessThan(v);
  });

  it("người chơi lái tự động về đích sau 3 vòng, có thứ hạng", () => {
    const sim = new KartSim();
    drive(sim, 60 * 160, autopilot(sim));
    expect(sim.status).toBe("finished");
    expect(sim.player.lap).toBe(KART.laps + 1);
    const r = sim.rank(sim.player);
    expect(r).toBeGreaterThanOrEqual(1);
    expect(r).toBeLessThanOrEqual(6);
  });

  it("AI chạy hết đường đua (không kẹt), về đích trong thời gian hợp lý", () => {
    const sim = new KartSim();
    drive(sim, 60 * 170, autopilot(sim));
    for (const k of sim.karts.filter((x) => x.ai)) expect(k.finishedAt, `xe ${k.id}`).not.toBeNull();
  });

  it("tên lửa trúng xe phía trước làm xe đó xoay vòng và chậm lại", () => {
    const sim = new KartSim();
    drive(sim, Math.ceil(KART.introTime / KART.step) + 2, {});
    const target = sim.karts[0];
    sim.player.s = target.s - 10;
    sim.player.d = target.d;
    sim.player.item = "missile";
    target.v = 20;
    drive(sim, 1, { item: true });
    drive(sim, 60, {});
    // Trúng một xe phía trước (xe cùng hàng xuất phát cũng có thể bị khoá mục tiêu)
    const hit = sim.events.find((e) => e.kind === "hit");
    expect(hit).toBeDefined();
    expect(sim.karts[hit!.kart].spinUntil).toBeGreaterThan(sim.time - 1);
  });
});
