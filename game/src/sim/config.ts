import raw from "./game_config.json";

// Nguồn số liệu duy nhất cho logic game (GDD v1.1). Không ghi cứng con số trong code: đọc từ đây.
// Module sim/ không phụ thuộc React hay three.js để sau này chạy nguyên si trên server.

export const RARITIES = ["common", "rare", "epic", "legendary", "mythic"] as const;
export type Rarity = (typeof RARITIES)[number];

export const MECH_SLOTS = ["core", "armor", "weapon", "engine"] as const;
export type MechSlot = (typeof MECH_SLOTS)[number];

export type MapId = "neon_city" | "hollow_hotel" | "warzone" | "citadel_raid";
export type FormId = keyof typeof raw.transform.forms;

export const GAME = raw;
export type GameConfig = typeof raw;

export function rarityIndex(r: Rarity) {
  return RARITIES.indexOf(r);
}

export function mapConfig(id: MapId) {
  const m = GAME.season.maps.find((x) => x.id === id);
  if (!m) throw new Error(`Không có map ${id}`);
  return m;
}
