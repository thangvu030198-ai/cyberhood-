// Chơi thử tự động như người chơi thật: máu thật (không hồi), đi hết màn, đánh trùm theo mẹo của từng trùm,
// mỗi map chơi nhiều lượt với hạt giống khác nhau. In bảng kết quả (thời gian, số lần chết, máu mất) và
// kiểm tra màn nào cũng qua được trong thời gian hợp lý ở độ khó Thường với súng tay mặc định.

import { describe, expect, it } from "vitest";
import { LEVEL_1 } from "./level1";
import { LEVEL_CITADEL, LEVEL_HOTEL, LEVEL_HUNT, LEVEL_PARISH, LEVEL_WARZONE } from "./maps";
import { NO_INPUT, PlatformerSim, type Input, type LevelDef, type SimOptions } from "./platformer";
import { bfs, dodge, shmupPlay, sidePlay, topPlay } from "./autoplay";

type Report = { map: string; seed: number; cleared: boolean; time: number; deaths: number; hpLost: number; bossTime: number; stuck: string };

export function playthrough(def: LevelDef, seed: number, opts: SimOptions = {}, maxSec = 420, human = 0.03): Report {
  const sim = new PlatformerSim(def, { seed, ...opts });
  let hpLost = 0;
  let bossAt = 0;
  const state = { dashUntil: 0, lastX: 0, stillFor: 0 };
  const path = { cells: [] as [number, number][], at: 0 };
  let deaths = 0;
  const [ax, bx] = def.bossArena;
  const goal: [number, number] = [Math.floor((ax + bx) / 2), Math.floor(sim.boss!.y)];
  if (def.mode === "topdown") path.cells = bfs(sim, [Math.floor(def.start[0]), Math.floor(def.start[1])], goal);
  let lastHp = sim.player.hp;
  let f = 0;
  // Phản xạ người thật: thỉnh thoảng phản ứng trễ vài khung (giữ nguyên thao tác cũ), mỗi seed một kiểu
  let rs = seed * 9301 + 49297;
  const rnd = () => ((rs = (rs * 233280 + 49297) % 2147483647) / 2147483647);
  let lag = 0;
  let last: Input = NO_INPUT;
  for (; f < 60 * maxSec && sim.status !== "cleared"; f++) {
    const fresh = dodge(sim, def.mode === "topdown" ? topPlay(sim, f, path) : def.mode === "shmup" ? shmupPlay(sim, f) : sidePlay(sim, f, state), f);
    if (lag <= 0 && rnd() < human) lag = 2 + Math.floor(rnd() * 8);
    const input = lag-- > 0 ? last : fresh;
    last = input;
    sim.step(input);
    if (sim.player.hp < lastHp) hpLost += lastHp - sim.player.hp;
    lastHp = sim.player.hp;
    if (sim.bossActive && !bossAt) bossAt = sim.time;
    // Chết thì lộ trình đi 8 hướng tính lại từ checkpoint
    if (def.mode === "topdown" && sim.status === "playing" && sim.deaths !== deaths) {
      deaths = sim.deaths;
      const p = sim.player;
      const cells = bfs(sim, [Math.floor(p.x), Math.floor(p.y)], goal);
      if (cells.length) {
        path.cells = cells;
        path.at = 0;
      }
    }
  }
  return {
    map: def.id,
    seed,
    cleared: sim.status === "cleared",
    time: Math.round(sim.time),
    deaths: sim.deaths,
    hpLost,
    bossTime: sim.status === "cleared" ? Math.round(sim.clearedAt - bossAt) : -1,
    stuck: sim.status === "cleared" ? "" : `x=${sim.player.x.toFixed(1)} y=${sim.player.y.toFixed(1)} boss=${sim.bossActive ? sim.boss!.hp.toFixed(1) : "-"}`,
  };
}

export const MAPS = [LEVEL_1, LEVEL_HOTEL, LEVEL_WARZONE, LEVEL_CITADEL, LEVEL_HUNT, LEVEL_PARISH];

describe("chơi thử tự động (như người chơi)", () => {
  for (const def of MAPS)
    it(`${def.name}: qua màn ở độ khó Thường, súng tay mặc định`, () => {
      const runs = [1, 2, 3].map((seed) => playthrough(def, seed));
      console.log(runs.map((r) => `${r.map.padEnd(14)} seed ${r.seed} · ${r.cleared ? "QUA" : "KẸT"} · ${r.time}s · chết ${r.deaths} · mất ${r.hpLost} máu · trùm ${r.bossTime}s ${r.stuck}`).join("\n"));
      for (const r of runs) {
        expect(r.cleared, `${r.map} seed ${r.seed} ${r.stuck}`).toBe(true);
        expect(r.deaths, `${r.map} seed ${r.seed}`).toBeLessThanOrEqual(6);
      }
    }, 120000);
});

describe("chơi thử ở độ khó cao (báo cáo)", () => {
  it("Khó: bot vẫn qua hết; Ác mộng: thử thách thật (bot không né giỏi như người)", () => {
    const hard = MAPS.map((def) => playthrough(def, 1, { difficulty: "hard" }));
    const nm = MAPS.map((def) => playthrough(def, 1, { difficulty: "nightmare" }));
    const line = (tag: string) => (r: Report) => `${tag} ${r.map.padEnd(14)} · ${r.cleared ? "QUA" : "KẸT"} · ${r.time}s · chết ${r.deaths} · mất ${r.hpLost} máu · trùm ${r.bossTime}s ${r.stuck}`;
    console.log([...hard.map(line("KHÓ    ")), ...nm.map(line("ÁC MỘNG"))].join("\n"));
    expect(hard.filter((r) => r.cleared).length).toBe(MAPS.length);
  }, 300000);
});
