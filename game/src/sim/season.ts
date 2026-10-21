import { GAME, type MapId } from "./config";

// Tiến độ mùa: gom 15 mảnh mỗi map thành 1 Chìa, điểm mùa, tier Launchpad (GDD mục 2, 8).

export type KeyId = "copper" | "jade" | "crystal";

export type SeasonProgress = {
  season: string;
  shards: Partial<Record<MapId, number>>;
  keys: KeyId[];
  points: number;
  finalGate: boolean;
};

export const freshSeason = (): SeasonProgress => ({ season: GAME.season.id, shards: {}, keys: [], points: 0, finalGate: false });

/** Cộng mảnh chìa của một map; trả về Chìa vừa ghép được (nếu có) */
export function addShards(s: SeasonProgress, mapId: MapId, n: number): KeyId | null {
  const map = GAME.season.maps.find((m) => m.id === mapId);
  const key = map?.key as KeyId | null | undefined;
  if (!key || s.keys.includes(key)) return null;
  const total = (s.shards[mapId] ?? 0) + n;
  if (total >= GAME.season.shardsPerKey) {
    s.shards[mapId] = GAME.season.shardsPerKey;
    s.keys.push(key);
    return key;
  }
  s.shards[mapId] = total;
  return null;
}

/** Map đã mở chưa, theo số ngày kể từ đầu mùa */
export function mapUnlocked(mapId: MapId, seasonDay: number) {
  const map = GAME.season.maps.find((m) => m.id === mapId);
  return !!map && seasonDay >= map.unlockDay;
}

export type TierId = "bronze" | "silver" | "gold" | "diamond";

/** Tier Launchpad cao nhất đạt được (Diamond theo luật Gold + Mech Huyền thoại trở lên) */
export function launchpadTier(s: SeasonProgress, opts: { top100Challenge?: boolean; legendaryMech?: boolean } = {}): TierId | null {
  const [bronze, silver, gold] = GAME.launchpad.tiers;
  const isGold = s.keys.length >= (gold.keys ?? 3) && s.finalGate && s.points >= (gold.minSeasonPoints ?? Infinity);
  if (opts.top100Challenge || (isGold && opts.legendaryMech)) return "diamond";
  if (isGold) return "gold";
  if (s.keys.length >= (silver.keys ?? 2) && s.points >= (silver.minSeasonPoints ?? Infinity)) return "silver";
  if (s.keys.includes("copper") && s.points >= (bronze.minSeasonPoints ?? Infinity)) return "bronze";
  return null;
}
