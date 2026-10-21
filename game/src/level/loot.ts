// Đồ rơi trong màn đi ngang: địch rơi linh kiện theo 5 độ hiếm (bảng rơi chung + pity của người chơi),
// CRED, Chìa rương, mảnh Chìa mùa; rương giấu trong màn cần Chìa rương để mở.
// Không bán rương bằng tiền (GDD mục 11): chìa và rương chỉ kiếm được bằng chơi.

import { rarityIndex, type Rarity } from "../sim/config";
import { rollDrop, type MechPart, type PityState } from "../sim/loot";
import type { Rng } from "../sim/rng";
import type { EnemyKind } from "./platformer";
import { GEAR_DROP, rollGear, type GearId } from "./gear";

export type LootDrop =
  | { kind: "part"; part: MechPart }
  | { kind: "cred"; amount: number }
  | { kind: "chestKey" }
  | { kind: "keyShard" }
  | { kind: "health" }
  /** Vũ khí / giáp (gear.ts) */
  | { kind: "gear"; gear: GearId };

export type ChestTier = "bronze" | "silver" | "gold";

export const LOOT = {
  /** Mỗi loại địch: xác suất rơi linh kiện, CRED, Chìa rương, mảnh Chìa mùa */
  enemy: {
    trooper: { part: 0.14, cred: 0.55, chestKey: 0.07, keyShard: 0.05 },
    drone: { part: 0.1, cred: 0.5, chestKey: 0.05, keyShard: 0.04 },
    zombie: { part: 0.12, cred: 0.5, chestKey: 0.06, keyShard: 0.05 },
    boss: { part: 1, cred: 1, chestKey: 1, keyShard: 1 },
  } satisfies Record<EnemyKind, { part: number; cred: number; chestKey: number; keyShard: number }>,
  /** CRED rơi mỗi lần (trùm nhân 10) */
  cred: [2, 6] as [number, number],
  /** Trùm: số linh kiện và độ hiếm tối thiểu */
  bossParts: 2,
  bossMinRarity: "epic" as Rarity,
  /** Rương: số linh kiện, độ hiếm tối thiểu, CRED kèm theo */
  chest: {
    bronze: { parts: 1, min: "rare" as Rarity, cred: 15 },
    silver: { parts: 2, min: "rare" as Rarity, cred: 30 },
    gold: { parts: 2, min: "epic" as Rarity, cred: 60 },
  } satisfies Record<ChestTier, { parts: number; min: Rarity; cred: number }>,
  /** Bỏ dở màn: mất phần này số đồ từ Hiếm trở xuống đã nhặt (thiết kế 9B: 30%) */
  quitLossRate: 0.3,
  quitLossUpTo: "rare" as Rarity,
};

export type LootContext = { rng: Rng; pity: PityState; mapMultiplier: number };

export function rollEnemyDrops(kind: EnemyKind, ctx: LootContext): LootDrop[] {
  const t = LOOT.enemy[kind];
  const out: LootDrop[] = [];
  const boss = kind === "boss";
  const parts = boss ? LOOT.bossParts : ctx.rng() < t.part ? 1 : 0;
  for (let i = 0; i < parts; i++)
    out.push({ kind: "part", part: rollDrop(ctx.rng, ctx.pity, { mapMultiplier: ctx.mapMultiplier, minRarity: boss ? LOOT.bossMinRarity : undefined }) });
  if (ctx.rng() < t.cred) out.push({ kind: "cred", amount: credAmount(ctx.rng) * (boss ? 10 : 1) });
  if (ctx.rng() < t.chestKey) out.push({ kind: "chestKey" });
  if (ctx.rng() < t.keyShard) out.push({ kind: "keyShard" });
  if (ctx.rng() < (boss ? GEAR_DROP.boss : GEAR_DROP.enemy))
    out.push({ kind: "gear", gear: rollGear(ctx.rng, ctx.mapMultiplier, boss ? "rare" : "common") });
  return out;
}

export function chestContents(tier: ChestTier, ctx: LootContext): LootDrop[] {
  const c = LOOT.chest[tier];
  const out: LootDrop[] = [];
  for (let i = 0; i < c.parts; i++)
    out.push({ kind: "part", part: rollDrop(ctx.rng, ctx.pity, { mapMultiplier: ctx.mapMultiplier, minRarity: c.min }) });
  out.push({ kind: "cred", amount: c.cred });
  if (ctx.rng() < GEAR_DROP.chest[tier]) out.push({ kind: "gear", gear: rollGear(ctx.rng, ctx.mapMultiplier, tier === "gold" ? "epic" : "common") });
  return out;
}

function credAmount(rng: Rng) {
  const [lo, hi] = LOOT.cred;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Đồ giữ lại khi bỏ dở màn: mất ngẫu nhiên 30% số linh kiện từ Hiếm trở xuống, đồ cao hơn giữ nguyên */
export function keptOnQuit(collected: LootDrop[], rng: Rng): LootDrop[] {
  const cap = rarityIndex(LOOT.quitLossUpTo);
  const atRisk = collected.filter((d) => d.kind === "part" && rarityIndex(d.part.rarity) <= cap);
  const lose = new Set([...atRisk].sort(() => rng() - 0.5).slice(0, Math.floor(atRisk.length * LOOT.quitLossRate)));
  return collected.filter((d) => !lose.has(d));
}
