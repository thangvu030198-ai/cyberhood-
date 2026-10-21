import { GAME, mapConfig, rarityIndex, type MapId } from "./config";
import { freshPity, rollDrop, type MechPart, type PityState } from "./loot";
import { createRng, pick, range, type Rng } from "./rng";

// Hợp đồng 7 phút (GDD mục 3): 6 marker nhiệm vụ, sự kiện phút 4, điểm thoát hiện từ phút 5,
// điểm & sao, mất đồ khi chết hoặc hết giờ. Client báo sự việc (tới marker, hạ địch...), sim quyết định thưởng.

export type MissionType = string;
export type ContractEventType = (typeof GAME.match.events)[number];
export type Vec2 = { x: number; z: number };

export type Marker = { id: number; type: MissionType; pos: Vec2; done: boolean };

export type ContractStatus = "running" | "extracted" | "dead" | "timeout";

export type Contract = {
  seed: number;
  mapId: MapId;
  elapsed: number;
  markers: Marker[];
  event: { type: ContractEventType; startedAt: number; done: boolean; score: number } | null;
  extract: Vec2;
  extractVisible: boolean;
  kills: number;
  eventScore: number;
  shards: number;
  loot: MechPart[];
  status: ContractStatus;
  rng: Rng;
  pity: PityState;
};

export type ContractSetup = {
  seed: number;
  mapId: MapId;
  /** Các điểm có thể đặt marker trên map; sim chọn ngẫu nhiên 6 điểm */
  markerSpots: Vec2[];
  extractSpots: Vec2[];
  pity?: PityState;
};

export function startContract(setup: ContractSetup): Contract {
  const rng = createRng(setup.seed);
  const map = mapConfig(setup.mapId);
  const types = "missions" in map ? (map.missions as string[]) : ["assault"];
  const spots = [...setup.markerSpots].sort(() => rng() - 0.5).slice(0, GAME.match.missionMarkers);
  return {
    seed: setup.seed,
    mapId: setup.mapId,
    elapsed: 0,
    markers: spots.map((pos, id) => ({ id, type: types[id % types.length], pos, done: false })),
    event: null,
    extract: pick(rng, setup.extractSpots),
    extractVisible: false,
    kills: 0,
    eventScore: 0,
    shards: 0,
    loot: [],
    status: "running",
    rng,
    pity: setup.pity ?? freshPity(),
  };
}

export const timeLeft = (c: Contract) => Math.max(0, GAME.match.durationSec - c.elapsed);

export type ContractTick = "event_started" | "extract_visible" | "timeout" | null;

export function tickContract(c: Contract, dt: number): ContractTick {
  if (c.status !== "running") return null;
  const before = c.elapsed;
  c.elapsed += dt;
  if (before < GAME.match.eventAtSec && c.elapsed >= GAME.match.eventAtSec) {
    c.event = { type: pick(c.rng, GAME.match.events) as ContractEventType, startedAt: c.elapsed, done: false, score: 0 };
    return "event_started";
  }
  if (!c.extractVisible && c.elapsed >= GAME.match.extractVisibleAtSec) {
    c.extractVisible = true;
    return "extract_visible";
  }
  if (c.elapsed >= GAME.match.durationSec) {
    finishContract(c, "timeout");
    return "timeout";
  }
  return null;
}

export type MissionReward = { score: number; drop: MechPart; shard: boolean };

/** Hoàn thành nhiệm vụ ở marker: +100 điểm, 1 lượt rơi đồ, 20% ra mảnh chìa */
export function completeMission(c: Contract, markerId: number, opts: { transforming?: boolean; bonus?: number } = {}): MissionReward | null {
  const m = c.markers.find((x) => x.id === markerId);
  if (!m || m.done || c.status !== "running") return null;
  m.done = true;
  const drop = rollDrop(c.rng, c.pity, {
    mapMultiplier: mapConfig(c.mapId).dropMultiplier,
    transforming: opts.transforming,
    bonus: opts.bonus,
  });
  c.loot.push(drop);
  const shard = c.rng() < GAME.match.shardChancePerMission;
  if (shard) c.shards++;
  return { score: GAME.match.score.mission, drop, shard };
}

export function addKill(c: Contract) {
  if (c.status === "running") c.kills++;
}

/** Kết thúc sự kiện phút 4. Truy nã 5 sao sống sót đủ thì nhân đôi điểm sự kiện */
export function completeEvent(c: Contract, opts: { survivedWanted?: boolean } = {}) {
  if (!c.event || c.event.done || c.status !== "running") return 0;
  let score = Math.round(range(c.rng, GAME.match.score.eventMin, GAME.match.score.eventMax));
  if (c.event.type === "wanted_5_star" && opts.survivedWanted) score *= 2;
  c.event.done = true;
  c.event.score = score;
  c.eventScore += score;
  return score;
}

/** Thả hàng tiếp tế: chỉ rơi Sử thi trở lên */
export function lootSupplyDrop(c: Contract) {
  const drop = rollDrop(c.rng, c.pity, {
    mapMultiplier: mapConfig(c.mapId).dropMultiplier,
    minRarity: GAME.dropTable.supplyDropMinRarity as "epic",
  });
  c.loot.push(drop);
  return drop;
}

export const missionsDone = (c: Contract) => c.markers.filter((m) => m.done).length;

export function contractScore(c: Contract) {
  const s = GAME.match.score;
  const secondsLeft = c.status === "extracted" ? Math.floor(timeLeft(c)) : 0;
  return missionsDone(c) * s.mission + c.kills * s.kill + secondsLeft * s.secondLeft + c.eventScore;
}

export function starsFor(score: number) {
  const st = GAME.match.stars;
  return score >= st["3"] ? 3 : score >= st["2"] ? 2 : score >= st["1"] ? 1 : 0;
}

export type ContractResult = {
  status: ContractStatus;
  score: number;
  stars: number;
  /** Điểm mùa nhận được = điểm × hệ số sao × (1 + chuỗi đăng nhập) */
  seasonPoints: number;
  keptLoot: MechPart[];
  lostLoot: MechPart[];
  shards: number;
  lostShards: number;
};

/**
 * Chốt hợp đồng. Thoát thành công giữ 100% đồ và mảnh. Chết/hết giờ mất 50% mảnh và 50% đồ từ Hiếm trở xuống;
 * đồ Huyền thoại/Thần thoại không bao giờ mất.
 */
export function finishContract(c: Contract, outcome: Exclude<ContractStatus, "running">, loginStreakDays = 0): ContractResult {
  if (c.status === "running") c.status = outcome;
  const score = contractScore(c);
  const stars = starsFor(score);
  const starMul = stars > 0 ? GAME.match.starMultiplier[String(stars) as "1" | "2" | "3"] : 1;
  const streak = Math.min(GAME.match.loginStreak.max, loginStreakDays * GAME.match.loginStreak.perDay);

  let keptLoot = c.loot;
  let lostLoot: MechPart[] = [];
  let lostShards = 0;
  if (c.status !== "extracted") {
    const loss = GAME.match.deathLoss;
    const cap = rarityIndex(loss.itemsUpToRarity as "rare");
    const atRisk = c.loot.filter((p) => rarityIndex(p.rarity) <= cap);
    const toLose = Math.floor(atRisk.length * loss.itemsLossRate);
    lostLoot = [...atRisk].sort(() => c.rng() - 0.5).slice(0, toLose);
    keptLoot = c.loot.filter((p) => !lostLoot.includes(p));
    lostShards = Math.floor(c.shards * loss.shards);
  }
  return {
    status: c.status,
    score,
    stars,
    seasonPoints: Math.round(score * starMul * (1 + streak)),
    keptLoot,
    lostLoot,
    shards: c.shards - lostShards,
    lostShards,
  };
}

/** Điểm thoát: người chơi trong bán kính này khi điểm thoát đã hiện thì thoát thành công */
export const EXTRACT_RADIUS = 6;

export function canExtract(c: Contract, p: Vec2) {
  return c.status === "running" && c.extractVisible && Math.hypot(p.x - c.extract.x, p.z - c.extract.z) < EXTRACT_RADIUS;
}
