import { GAME, MECH_SLOTS, RARITIES, rarityIndex, type MechSlot, type Rarity } from "./config";
import { makePart, SLOT_BASE_POWER, type MechPart } from "./loot";
import type { Rng } from "./rng";

// Ráp Mech từ 4 linh kiện, độ bền, sửa, ghép và nung chảy (GDD mục 6.3–6.5).

export type Mech = {
  id: string;
  parts: Record<MechSlot, MechPart>;
  durability: number;
};

/** Độ hiếm của Mech lấy theo linh kiện yếu nhất: không thể "đội lốt" Thần thoại bằng 1 món */
export function mechRarity(parts: Record<MechSlot, MechPart>): Rarity {
  let lowest = RARITIES.length - 1;
  for (const s of MECH_SLOTS) lowest = Math.min(lowest, rarityIndex(parts[s].rarity));
  return RARITIES[lowest];
}

export function maxDurability(r: Rarity) {
  return GAME.mech.durability[r];
}

export function assembleMech(parts: Partial<Record<MechSlot, MechPart>>): Mech | null {
  if (!MECH_SLOTS.every((s) => parts[s]?.slot === s)) return null;
  const full = parts as Record<MechSlot, MechPart>;
  return { id: `m-${MECH_SLOTS.map((s) => full[s].id).join("-")}`, parts: full, durability: maxDurability(mechRarity(full)) };
}

/** Sức mạnh Mech = Σ (chỉ số gốc khe × hệ số độ hiếm) */
export function mechPower(parts: Partial<Record<MechSlot, MechPart>>) {
  let sum = 0;
  for (const s of MECH_SLOTS) {
    const p = parts[s];
    if (p) sum += SLOT_BASE_POWER[s] * p.statMul;
  }
  return Math.round(sum);
}

/** Sức mạnh sàn của Mech toàn đồ Thường, dùng để nén chênh lệch trong PvP */
export const BASE_MECH_POWER = MECH_SLOTS.reduce((a, s) => a + SLOT_BASE_POWER[s], 0);

/** Trong PvP chênh lệch sức mạnh bị nén còn tối đa +20% */
export function pvpPower(power: number) {
  return Math.min(power, BASE_MECH_POWER * (1 + GAME.pvp.mechPowerGapCap));
}

export function repairCost(mech: Mech) {
  const r = mechRarity(mech.parts);
  const missing = maxDurability(r) - mech.durability;
  return Math.round(missing * GAME.mech.repairTokenPerPoint[r] * 100) / 100;
}

export type CraftResult =
  | { ok: true; success: true; result: MechPart; cost: number }
  | { ok: true; success: false; kept: MechPart[]; cost: number }
  | { ok: false; reason: string };

const RECIPE_BY_INPUT: Partial<Record<Rarity, keyof typeof GAME.craft.recipes>> = {
  common: "common_to_rare",
  rare: "rare_to_epic",
  epic: "epic_to_legendary",
};

/** Ghép 5 linh kiện cùng độ hiếm thành 1 linh kiện bậc cao hơn; thất bại mất token, giữ lại 2/5 */
export function craft(rng: Rng, inputs: MechPart[]): CraftResult {
  if (inputs.length !== GAME.craft.inputCount) return { ok: false, reason: `Cần đúng ${GAME.craft.inputCount} linh kiện` };
  const r = inputs[0].rarity;
  if (!inputs.every((p) => p.rarity === r)) return { ok: false, reason: "Các linh kiện phải cùng độ hiếm" };
  const key = RECIPE_BY_INPUT[r];
  if (!key) return { ok: false, reason: "Không ghép được từ độ hiếm này" };
  const recipe = GAME.craft.recipes[key];
  if (rng() < recipe.successRate) {
    return { ok: true, success: true, result: makePart(rng, RARITIES[rarityIndex(r) + 1]), cost: recipe.costToken };
  }
  const shuffled = [...inputs].sort(() => rng() - 0.5);
  return { ok: true, success: false, kept: shuffled.slice(0, GAME.craft.failKeepInputs), cost: recipe.costToken };
}

/** Nung chảy đồ hết bền: trả 40% số linh kiện cùng độ hiếm (làm tròn xuống), tối thiểu 1 món bậc thấp hơn */
export function smelt(rng: Rng, parts: MechPart[]): MechPart[] {
  if (parts.length === 0) return [];
  const r = parts[0].rarity;
  const n = Math.floor(parts.length * GAME.mech.smeltReturn);
  if (n > 0) return Array.from({ length: n }, () => makePart(rng, r));
  return [makePart(rng, RARITIES[Math.max(0, rarityIndex(r) - 1)])];
}
