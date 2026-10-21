import { it } from "vitest";
import { LEVEL_1 } from "./level1";
import { NO_INPUT, PlatformerSim } from "./platformer";
it("coins", () => {
  const sim = new PlatformerSim(LEVEL_1, { seed: 1 });
  while (sim.status === "intro") sim.step(NO_INPUT);
  sim.player.x = 15; sim.player.y = 2; sim.player.hp = 999;
  const e = sim.enemies.find((x) => x.kind === "trooper")!;
  e.x = 16.6; e.y = 2; e.trait = "basic"; e.hp = 0.5; e.awake = true;
  for (let i = 0; i < 10; i++) sim.step(NO_INPUT);
  sim.step({ ...NO_INPUT, melee: true });
  for (let f = 0; f < 120; f++) {
    sim.step(NO_INPUT);
    if (f % 15 === 0) console.log(f, e.alive, sim.pickups.map((k) => `${k.drop.kind}${k.taken ? "✓" : ""}(${k.x.toFixed(1)},${k.y.toFixed(1)} v${k.vx.toFixed(1)},${k.vy.toFixed(1)})`).join(" "), "coll", sim.collected.length, "p", sim.player.x.toFixed(1), sim.player.y.toFixed(1));
  }
});
