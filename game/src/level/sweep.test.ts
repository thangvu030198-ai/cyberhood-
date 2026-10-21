// Chơi thử hàng loạt: mọi map × mọi vũ khí × nhiều seed × 3 độ khó. Chạy tay: SWEEP=1 npx vitest run sweep
import { describe, expect, it } from "vitest";
import { playthrough, MAPS } from "./playtest.test";
import { WEAPONS, type WeaponId } from "./gear";
import type { Difficulty } from "./platformer";

const RUN = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SWEEP;
const SEEDS = [1, 2, 3, 4, 5];

describe.runIf(RUN)("chơi thử hàng loạt", () => {
  for (const diff of ["easy", "normal", "hard"] as Difficulty[])
    for (const def of MAPS)
      it(`${def.id} · ${diff}`, () => {
        const fails: string[] = [];
        const lines: string[] = [];
        for (const weapon of Object.keys(WEAPONS) as WeaponId[]) {
          const runs = SEEDS.map((seed) => playthrough(def, seed, { weapon, difficulty: diff }));
          const ok = runs.filter((r) => r.cleared);
          const avg = (k: "time" | "deaths" | "bossTime") => (ok.length ? (ok.reduce((n, r) => n + r[k], 0) / ok.length).toFixed(1) : "-");
          lines.push(`${def.id.padEnd(13)} ${diff.padEnd(6)} ${weapon.padEnd(9)} qua ${ok.length}/${runs.length} · ${avg("time")}s · chết ${avg("deaths")} · trùm ${avg("bossTime")}s`);
          for (const r of runs) if (!r.cleared) fails.push(`${weapon} seed ${r.seed}: ${r.stuck}`);
        }
        console.log(lines.join("\n") + (fails.length ? "\n  KẸT: " + fails.join(" | ") : ""));
        if (diff !== "hard") expect(fails).toEqual([]);
      }, 600000);
});
