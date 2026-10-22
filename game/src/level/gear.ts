// Trang bị nhặt trong màn 2D (model Meshy người chơi tải lên): vũ khí đổi hẳn kiểu bắn, giáp thêm máu.
// Rơi theo độ hiếm như linh kiện; cất trong Túi đồ, chọn trang bị ở Hub trước khi qua cổng.

import type { ExtraModel } from "../game/assets";
import { RARITIES, rarityIndex, type Rarity } from "../sim/config";
import type { Rng } from "../sim/rng";

export type WeaponId = "buster" | "ar" | "shotgun" | "sniper" | "bow" | "celestial" | "frost" | "scythe" | "cosmic" | "iceblade";
export type ArmorId = "none" | "darkset" | "void" | "icewar";
/** Mũ, găng, giày, chip cấy: chỉ cộng chỉ số (model Meshy tạo riêng) */
export type AccessoryId = "helm_visor" | "helm_oni" | "glove_shock" | "glove_titan" | "boot_runner" | "boot_grav" | "chip_luck" | "chip_overclock" | "helm_ice" | "glove_ice" | "boot_ice";
export type GearId = Exclude<WeaponId, "buster"> | Exclude<ArmorId, "none"> | AccessoryId;
export type Slot = "weapon" | "armor" | "head" | "hands" | "feet" | "chip";
export const SLOTS: { id: Slot; label: string }[] = [
  { id: "weapon", label: "Vũ khí" },
  { id: "armor", label: "Giáp" },
  { id: "head", label: "Mũ" },
  { id: "hands", label: "Găng" },
  { id: "feet", label: "Giày" },
  { id: "chip", label: "Chip" },
];

/** Chỉ số cộng thêm: tấn công %, máu, giảm sát thương %, tốc chạy %, nhảy cao %, nạp đạn nhanh %, may mắn rơi đồ % */
export type Stats = { atk: number; hp: number; def: number; speed: number; jump: number; charge: number; luck: number };
export const NO_STATS: Stats = { atk: 0, hp: 0, def: 0, speed: 0, jump: 0, charge: 0, luck: 0 };

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
  slot: Slot;
  /** Chỉ số gốc (cấp cường hoá +0) */
  stats?: Partial<Stats>;
  rarity: Rarity;
  model: ExtraModel;
  /** Mô tả ngắn hiện trong Túi đồ */
  blurb: string;
  /** Bộ "Băng Chiến": chỉ rơi từ Cổng Công Thành, không rơi trong màn 2D / rương thường */
  siegeOnly?: boolean;
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
  iceblade: { style: "blade", dmg: 4, cooldown: 0.25, freeze: true, wave: { dmg: 12, r: 0.95, speed: 17 } },
};

export const ARMORS: Record<ArmorId, { hp: number; reduce: number }> = {
  none: { hp: 0, reduce: 0 },
  darkset: { hp: 8, reduce: 0.1 },
  void: { hp: 14, reduce: 0.2 },
  icewar: { hp: 18, reduce: 0.22 },
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
  helm_visor: { name: "Mũ Kính Neon", slot: "head", rarity: "rare", model: "mx_gr_helm_visor", stats: { def: 0.06, charge: 0.1 }, blurb: "Kính ngắm: nạp đạn nhanh hơn, đỡ đòn nhẹ." },
  helm_oni: { name: "Mặt Nạ Oni Hắc Diện", slot: "head", rarity: "legendary", model: "mx_gr_helm_oni", stats: { def: 0.12, atk: 0.12 }, blurb: "Mặt nạ samurai: tăng tấn công và phòng thủ." },
  glove_shock: { name: "Găng Sốc Điện", slot: "hands", rarity: "rare", model: "mx_gr_glove_shock", stats: { atk: 0.1 }, blurb: "Cuộn điện ở đốt tay: tăng sát thương." },
  glove_titan: { name: "Nắm Đấm Titan", slot: "hands", rarity: "epic", model: "mx_gr_glove_titan", stats: { atk: 0.18, hp: 4 }, blurb: "Găng mech vàng: sát thương lớn, thêm máu." },
  boot_runner: { name: "Giày Chạy Neon", slot: "feet", rarity: "rare", model: "mx_gr_boot_runner", stats: { speed: 0.12, jump: 0.05 }, blurb: "Đế phản lực: chạy nhanh hơn." },
  boot_grav: { name: "Giày Phản Trọng Lực", slot: "feet", rarity: "legendary", model: "mx_gr_boot_grav", stats: { speed: 0.15, jump: 0.14 }, blurb: "Nhảy cao, chạy nhanh, lướt xa." },
  chip_luck: { name: "Chip Cỏ Bốn Lá", slot: "chip", rarity: "epic", model: "mx_gr_chip_luck", stats: { luck: 0.25 }, blurb: "Đồ hiếm rơi nhiều hơn 25%." },
  iceblade: { name: "Đại Kiếm Băng Chiến", slot: "weapon", rarity: "legendary", model: "mx_w_ice_blade", siegeOnly: true, blurb: "Bộ Băng Chiến (chỉ rơi từ Công thành): chém đóng băng, sóng kiếm băng xuyên." },
  icewar: { name: "Giáp Băng Chiến", slot: "armor", rarity: "legendary", model: "mx_gr_ice_armor", siegeOnly: true, blurb: "Bộ Băng Chiến: +18 máu, giảm 22% sát thương." },
  helm_ice: { name: "Mũ Băng Chiến", slot: "head", rarity: "epic", model: "mx_gr_ice_helm", siegeOnly: true, stats: { def: 0.1, hp: 4 }, blurb: "Bộ Băng Chiến: mũ giáp pha lê băng, chịu đòn tốt." },
  glove_ice: { name: "Găng Băng Chiến", slot: "hands", rarity: "epic", model: "mx_gr_ice_glove", siegeOnly: true, stats: { atk: 0.14, charge: 0.1 }, blurb: "Bộ Băng Chiến: móng băng tăng sát thương và tốc độ nạp." },
  boot_ice: { name: "Giày Băng Chiến", slot: "feet", rarity: "epic", model: "mx_gr_ice_boot", siegeOnly: true, stats: { speed: 0.12, def: 0.05 }, blurb: "Bộ Băng Chiến: chạy nhanh trên tuyết, thêm giáp." },
  chip_overclock: { name: "Chip Ép Xung", slot: "chip", rarity: "legendary", model: "mx_gr_chip_overclock", stats: { atk: 0.15, charge: 0.3, def: -0.05 }, blurb: "Bắn nạp siêu nhanh, mạnh hơn nhưng dễ vỡ." },
};

export const GEAR_IDS = Object.keys(GEAR) as GearId[];

export const isWeapon = (id: GearId): id is Exclude<WeaponId, "buster"> => GEAR[id].slot === "weapon";

/** Mỗi cấp cường hoá cộng thêm phần này của chỉ số gốc (vũ khí: sát thương) */
export const ENHANCE_STEP = 0.08;
export const MAX_ENHANCE = 10;

/** Đồ đang mặc ở từng ô */
export type Loadout = { weapon: WeaponId; armor: ArmorId; head: AccessoryId | null; hands: AccessoryId | null; feet: AccessoryId | null; chip: AccessoryId | null };

/** Tổng chỉ số từ đồ đang mặc + cấp cường hoá (vũ khí cộng tấn công, giáp cộng máu / giảm sát thương theo cấp) */
export function loadoutStats(l: Loadout, enh: Partial<Record<GearId, number>>): Stats {
  const out: Stats = { ...NO_STATS };
  const add = (id: GearId | null | undefined, base: Partial<Stats>) => {
    if (!id) return;
    const k = 1 + ENHANCE_STEP * (enh[id] ?? 0);
    for (const [key, v] of Object.entries(base)) out[key as keyof Stats] += (v ?? 0) * k;
  };
  // Vũ khí / giáp: chỉ phần cộng thêm từ cấp cường hoá (chỉ số gốc nằm ở WEAPONS / ARMORS)
  if (l.weapon !== "buster") out.atk += ENHANCE_STEP * (enh[l.weapon] ?? 0);
  if (l.armor !== "none") out.hp += ARMORS[l.armor].hp * ENHANCE_STEP * (enh[l.armor] ?? 0);
  for (const slot of ["head", "hands", "feet", "chip"] as const) {
    const id = l[slot];
    if (id) add(id, GEAR[id].stats ?? {});
  }
  out.def = Math.max(-0.2, Math.min(0.5, out.def));
  return out;
}

/** Cường hoá (đập đồ): tỉ lệ thành công theo cấp hiện tại, giá CRED, linh kiện cần (từ +5 cần 1 linh kiện Hiếm trở lên) */
export const FORGE = {
  chance: [1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2],
  cost: (level: number) => Math.round(40 * (level + 1) ** 1.6),
  needsPart: (level: number) => level >= 5,
  /** Thất bại từ +5 trở lên: tụt một cấp */
  dropFrom: 5,
};

/** Phân rã đồ thừa: CRED nhận lại theo độ hiếm, cộng thêm theo cấp cường hoá (+10% / cấp) */
export const SALVAGE: Record<Rarity, number> = { common: 20, rare: 50, epic: 120, legendary: 300, mythic: 800 };
export const salvageValue = (id: GearId, enh = 0) => Math.round(SALVAGE[GEAR[id].rarity] * (1 + enh * 0.1));

export function forgeRoll(level: number, roll: number): { ok: boolean; next: number } {
  const ok = roll < (FORGE.chance[level] ?? 0);
  return { ok, next: ok ? level + 1 : level >= FORGE.dropFrom ? level - 1 : level };
}

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
  const pool = GEAR_IDS.filter((g) => rarityIndex(GEAR[g].rarity) >= min && !GEAR[g].siegeOnly);
  // Trọng số tính cho cả bậc độ hiếm rồi chia đều cho các món cùng bậc
  const same = (r: Rarity) => GEAR_IDS.filter((g) => GEAR[g].rarity === r && !GEAR[g].siegeOnly).length;
  const w = pool.map((g) => (GEAR_DROP.weight[GEAR[g].rarity] * mapMultiplier ** rarityIndex(GEAR[g].rarity)) / same(GEAR[g].rarity));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

export const RARITY_ORDER = RARITIES;

/** Bộ "Băng Chiến" chỉ rơi từ Cổng Công Thành */
export const ICE_WAR_SET = GEAR_IDS.filter((g) => GEAR[g].siegeOnly);
