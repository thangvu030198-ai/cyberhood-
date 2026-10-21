import { GAME, MECH_SLOTS, RARITIES, rarityIndex, type MechSlot, type Rarity } from "./config";
import { pick, range, type Rng } from "./rng";

// Bảng rơi đồ (GDD mục 6.2): 5 độ hiếm, hệ số map, thưởng khi đang biến hình, pity, thả hàng tiếp tế.

export type PityState = { sinceLegendary: number; sinceMythic: number };
export const freshPity = (): PityState => ({ sinceLegendary: 0, sinceMythic: 0 });

export type RollOptions = {
  /** Hệ số rơi của map (×1.0 → ×2.0) */
  mapMultiplier?: number;
  /** Hoàn thành nhiệm vụ khi đang biến hình: +10% đồ hiếm */
  transforming?: boolean;
  /** Hệ số thêm (tổ đội, bang, vùng PvP) cộng dồn vào phần đồ hiếm */
  bonus?: number;
  /** Độ hiếm tối thiểu, ví dụ thả hàng tiếp tế chỉ rơi Sử thi trở lên */
  minRarity?: Rarity;
};

/**
 * Bảng tỉ lệ sau điều chỉnh. Hệ số chỉ nhân vào các bậc trên Thường, phần dư dồn về Thường,
 * nên map khó cho nhiều đồ hiếm hơn mà tổng xác suất vẫn bằng 1.
 */
export function rarityTable(opts: RollOptions = {}): Record<Rarity, number> {
  const base = GAME.dropTable.rarity;
  let mul = opts.mapMultiplier ?? 1;
  if (opts.transforming) mul *= 1 + GAME.dropTable.transformBonus;
  mul *= 1 + (opts.bonus ?? 0);
  const minIdx = opts.minRarity ? rarityIndex(opts.minRarity) : 0;
  const table = {} as Record<Rarity, number>;
  let upper = 0;
  for (const r of RARITIES) {
    if (r === "common") continue;
    table[r] = base[r] * mul;
    upper += table[r];
  }
  table.common = Math.max(0, 1 - upper);
  // Cắt bỏ các bậc thấp hơn mức tối thiểu rồi chuẩn hoá lại
  let sum = 0;
  for (const r of RARITIES) {
    if (rarityIndex(r) < minIdx) table[r] = 0;
    sum += table[r];
  }
  for (const r of RARITIES) table[r] /= sum;
  return table;
}

/** Tung một lượt rơi, cập nhật bộ đếm pity (60 lượt chắc chắn Huyền thoại, 500 lượt chắc chắn Thần thoại) */
export function rollRarity(rng: Rng, pity: PityState, opts: RollOptions = {}): Rarity {
  const p = GAME.dropTable.pity;
  let result: Rarity;
  if (pity.sinceMythic + 1 >= p.mythic) result = "mythic";
  else if (pity.sinceLegendary + 1 >= p.legendary) result = "legendary";
  else {
    const table = rarityTable(opts);
    let x = rng();
    result = "common";
    for (const r of RARITIES) {
      if (x < table[r]) {
        result = r;
        break;
      }
      x -= table[r];
    }
    // Sai số dấu phẩy động: rơi vào bậc thấp nhất được phép
    if (table[result] === 0) result = RARITIES.find((r) => table[r] > 0)!;
  }
  pity.sinceMythic = result === "mythic" ? 0 : pity.sinceMythic + 1;
  pity.sinceLegendary = rarityIndex(result) >= rarityIndex("legendary") ? 0 : pity.sinceLegendary + 1;
  return result;
}

/** Chỉ số gốc mỗi khe linh kiện; Sức mạnh Mech = Σ gốc × hệ số độ hiếm */
export const SLOT_BASE_POWER: Record<MechSlot, number> = { core: 80, armor: 70, weapon: 90, engine: 60 };

const PART_NAMES: Record<MechSlot, readonly string[]> = {
  core: ["Lõi Plasma", "Lõi Lượng Tử", "Lõi Neon", "Lõi Hạt Nhân Lạnh"],
  armor: ["Giáp Titan", "Giáp Gốm Nano", "Giáp Phản Xạ", "Giáp Tổ Ong"],
  weapon: ["Pháo Ray", "Súng Xung EMP", "Lưỡi Plasma", "Tên Lửa Mini"],
  engine: ["Động Cơ Ion", "Động Cơ Phản Lực", "Động Cơ Từ Trường", "Động Cơ Xung"],
};

export type MechPart = {
  id: string;
  kind: "part";
  slot: MechSlot;
  name: string;
  rarity: Rarity;
  /** Hệ số chỉ số, ngẫu nhiên trong khoảng của độ hiếm */
  statMul: number;
  /** Mùa rơi ra, dùng cho đồ độc quyền mùa */
  season: string;
};

let partCounter = 0;
export function makePart(rng: Rng, rarity: Rarity, slot: MechSlot = pick(rng, MECH_SLOTS)): MechPart {
  const [lo, hi] = GAME.dropTable.statRange[rarity] as [number, number];
  return {
    id: `p${Date.now().toString(36)}${(partCounter++).toString(36)}${Math.floor(rng() * 1e6).toString(36)}`,
    kind: "part",
    slot,
    name: pick(rng, PART_NAMES[slot]),
    rarity,
    statMul: Math.round(range(rng, lo, hi) * 1000) / 1000,
    season: GAME.season.id,
  };
}

/** Một lượt rơi đầy đủ: linh kiện Mech theo độ hiếm đã tung */
export function rollDrop(rng: Rng, pity: PityState, opts: RollOptions = {}): MechPart {
  return makePart(rng, rollRarity(rng, pity, opts));
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aa3ad",
  rare: "#3ea6ff",
  epic: "#b05cff",
  legendary: "#ffc23d",
  mythic: "#ff2a4a",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Thường",
  rare: "Hiếm",
  epic: "Sử thi",
  legendary: "Huyền thoại",
  mythic: "Thần thoại",
};
