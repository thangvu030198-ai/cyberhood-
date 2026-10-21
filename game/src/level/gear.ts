// Trang bị nhặt trong màn 2D (model Meshy người chơi tải lên): vũ khí đổi hẳn kiểu bắn, giáp thêm máu.
// Rơi theo độ hiếm như linh kiện; cất trong Túi đồ, chọn trang bị ở Hub trước khi qua cổng.

import type { ExtraModel } from "../game/assets";
import { RARITIES, rarityIndex, type Rarity } from "../sim/config";
import type { Rng } from "../sim/rng";

export type WeaponId = "buster" | "ar" | "shotgun" | "sniper" | "bow" | "celestial" | "frost" | "scythe" | "cosmic";
export type ArmorId = "none" | "darkset" | "void";
export type GearId = Exclude<WeaponId, "buster"> | Exclude<ArmorId, "none">;

/**
 * Kiểu bắn:
 * - buster: súng tay mặc định (nhấn bắn, giữ nạp 2 mức) kiểu Mega Man
 * - auto: giữ nút là xả liên thanh, không nạp
 * - spread: chùm đạn hoa cải tầm ngắn
 * - rail: đạn xuyên rất nhanh, nạp đầy thì cực mạnh
 * - bow: kéo dây (giữ nút), thả ra bắn tên; kéo càng lâu càng mạnh, đầy thì xuyên
 * - blade: chém cận chiến hình vòng cung; nạp thì phóng sóng kiếm bay đi (kiểu Zero)
 */
export type FireStyle = "buster" | "auto" | "spread" | "rail" | "bow" | "blade";

export type WeaponSpec = {
  style: FireStyle;
  /** Sát thương cơ bản một viên / một nhát */
  dmg: number;
  /** Nghỉ giữa hai lần bắn (giây) */
  cooldown: number;
  /** Lưỡi băng: trúng là địch chậm lại */
  freeze?: boolean;
  /** Lưỡi hái: chém cả trước lẫn sau lưng */
  sweep?: boolean;
  /** Sóng kiếm khi nạp đầy: hệ số sát thương và cỡ */
  wave?: { dmg: number; r: number; speed: number };
};

export type GearInfo = {
  name: string;
  slot: "weapon" | "armor";
  rarity: Rarity;
  model: ExtraModel;
  /** Mô tả ngắn hiện trong Túi đồ */
  blurb: string;
};

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  buster: { style: "buster", dmg: 1, cooldown: 0 },
  ar: { style: "auto", dmg: 1, cooldown: 0.11 },
  shotgun: { style: "spread", dmg: 1.5, cooldown: 0.45 },
  sniper: { style: "rail", dmg: 4, cooldown: 0.6 },
  bow: { style: "bow", dmg: 2, cooldown: 0.25 },
  celestial: { style: "blade", dmg: 3, cooldown: 0.26, wave: { dmg: 8, r: 0.7, speed: 16 } },
  scythe: { style: "blade", dmg: 3.5, cooldown: 0.34, sweep: true, wave: { dmg: 9, r: 0.8, speed: 13 } },
  frost: { style: "blade", dmg: 3.5, cooldown: 0.26, freeze: true, wave: { dmg: 10, r: 0.75, speed: 16 } },
  cosmic: { style: "blade", dmg: 4.5, cooldown: 0.24, wave: { dmg: 14, r: 1.1, speed: 18 } },
};

export const ARMORS: Record<ArmorId, { hp: number; reduce: number }> = {
  none: { hp: 0, reduce: 0 },
  darkset: { hp: 8, reduce: 0.1 },
  void: { hp: 14, reduce: 0.2 },
};

export const GEAR: Record<GearId, GearInfo> = {
  ar: { name: "Súng trường AR", slot: "weapon", rarity: "common", model: "mx_dr_w_ar", blurb: "Giữ nút bắn để xả liên thanh." },
  shotgun: { name: "Shotgun Tiêu Điểm", slot: "weapon", rarity: "rare", model: "mx_dr_w_shotgun", blurb: "Chùm 3 viên tầm gần, nạp đầy bắn 5 viên xuyên." },
  sniper: { name: "Súng Ngắm Vỏ Đạn", slot: "weapon", rarity: "rare", model: "mx_dr_w_sniper", blurb: "Đạn xuyên cực nhanh; nạp đầy sát thương gấp 3." },
  bow: { name: "Cung Cánh Bạc", slot: "weapon", rarity: "epic", model: "mx_dr_w_bow", blurb: "Giữ để kéo dây, thả ra bắn tên. Kéo đầy: tên xuyên mọi địch." },
  celestial: { name: "Kiếm Thiên Giới", slot: "weapon", rarity: "epic", model: "mx_dr_w_celestial", blurb: "Chém vòng cung trước mặt; nạp để phóng sóng kiếm." },
  scythe: { name: "Lưỡi Hái Lam Mạch", slot: "weapon", rarity: "epic", model: "mx_dr_w_scythe", blurb: "Quét cả trước lẫn sau lưng. Sóng hái nặng, chậm." },
  frost: { name: "Băng Kiếm Vĩnh Cửu", slot: "weapon", rarity: "legendary", model: "mx_dr_w_frost", blurb: "Mỗi nhát chém làm địch đóng băng chậm lại 2 giây." },
  cosmic: { name: "Kiếm Vũ Trụ", slot: "weapon", rarity: "mythic", model: "mx_dr_w_cosmic", blurb: "Nhát chém mạnh nhất; sóng kiếm khổng lồ xuyên tường." },
  darkset: { name: "Giáp Hiệp Sĩ Bóng Đêm", slot: "armor", rarity: "epic", model: "mx_dr_a_darkset", blurb: "+8 máu, giảm 10% sát thương nhận vào." },
  void: { name: "Giáp Hư Không", slot: "armor", rarity: "legendary", model: "mx_dr_a_void", blurb: "+14 máu, giảm 20% sát thương nhận vào." },
};

export const GEAR_IDS = Object.keys(GEAR) as GearId[];

export const isWeapon = (id: GearId): id is Exclude<WeaponId, "buster"> => GEAR[id].slot === "weapon";

/** Tỉ lệ rơi trang bị: mỗi địch thường / trùm / từng loại rương */
export const GEAR_DROP = {
  enemy: 0.025,
  boss: 0.45,
  chest: { bronze: 0.1, silver: 0.25, gold: 0.5 },
  /** Trọng số theo độ hiếm (Thường → Thần thoại); map khó nhân thêm cho đồ hiếm */
  weight: { common: 50, rare: 30, epic: 14, legendary: 5, mythic: 1 } as Record<Rarity, number>,
};

/** Chọn một món trang bị theo trọng số độ hiếm; map có hệ số cao thì đồ hiếm dễ ra hơn */
export function rollGear(rng: Rng, mapMultiplier = 1, minRarity: Rarity = "common"): GearId {
  const min = rarityIndex(minRarity);
  const pool = GEAR_IDS.filter((g) => rarityIndex(GEAR[g].rarity) >= min);
  // Trọng số tính cho cả bậc độ hiếm rồi chia đều cho các món cùng bậc
  const same = (r: Rarity) => GEAR_IDS.filter((g) => GEAR[g].rarity === r).length;
  const w = pool.map((g) => (GEAR_DROP.weight[GEAR[g].rarity] * mapMultiplier ** rarityIndex(GEAR[g].rarity)) / same(GEAR[g].rarity));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export const RARITY_ORDER = RARITIES;
