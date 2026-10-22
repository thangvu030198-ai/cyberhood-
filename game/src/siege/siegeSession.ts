// Vào / ra Cổng Công Thành từ sảnh: chọn phe và quy mô ở sảnh chờ, dịch chuyển nhân vật sang bản đồ Thành Băng
// (cùng engine Hub: nhân vật, camera, súng, Mech), trao thưởng khi kết thúc (GDD 4I.6).

import { create } from "zustand";
import { SiegeSim, type Drop, type Side } from "./siegeSim";
import { useGame } from "../game/store";
import { handles } from "../game/refs";
import { SIEGE_GATE, SIEGE_ORIGIN } from "../game/config";
import { useMissions, trackMission } from "../game/missionStore";
import { useGear } from "../game/gearStore";
import { ICE_WAR_SET, rollGear } from "../level/gear";
import { createRng } from "../sim/rng";

export type SiegeSize = "small" | "standard";
export const SIEGE_SIZES: Record<SiegeSize, { perSide: number; label: string }> = {
  small: { perSide: 50, label: "Nhỏ 50 vs 50" },
  standard: { perSide: 100, label: "Chuẩn 100 vs 100" },
};

/** Thưởng (GDD 4I.6): CRED gốc theo hạng, phe thắng ×1,5, phe thua 60%, Điểm Hunter 30–80 */
export const SIEGE_REWARD = { cred: { S: 600, A: 420, B: 300, C: 200 } as Record<string, number>, winMul: 1.5, loseMul: 0.6, points: [30, 80] as [number, number], extraCoinPrice: 150 };

/** Đồ nhặt được trong trận (rơi từ quân địch / công trình) */
export type SiegeLoot = { cred: number; stim: number; key: number; gear: string[] };
export type SiegeResult = { won: boolean; rank: string; pts: number; cred: number; points: number; gear: string | null; kills: number; loot: SiegeLoot };
/** Dòng thông báo nhanh trên HUD: hạ địch, nhặt đồ, chuỗi hạ */
export type SiegeFeed = { id: number; text: string; color: string; at: number };

type SiegeState = {
  sim: SiegeSim | null;
  lobby: boolean;
  side: Side;
  size: SiegeSize;
  result: SiegeResult | null;
  loot: SiegeLoot;
  feed: SiegeFeed[];
  /** Bánh xe lệnh tiểu đội đang mở */
  wheel: boolean;
  setLobby: (v: boolean) => void;
  setSide: (s: Side) => void;
  setSize: (s: SiegeSize) => void;
  start: () => void;
  leave: () => void;
  settle: () => void;
  setWheel: (v: boolean) => void;
  grant: (d: Drop) => void;
  pushFeed: (text: string, color: string) => void;
};

const emptyLoot = (): SiegeLoot => ({ cred: 0, stim: 0, key: 0, gear: [] });
let feedId = 0;
const lootRng = createRng(Date.now() & 0xffff);

/** Toạ độ thế giới của một điểm trên bản đồ Công thành */
export const toWorld = (x: number, z: number) => ({ x: SIEGE_ORIGIN.x + x, z: SIEGE_ORIGIN.z + z });

function teleport(x: number, y: number, z: number, yaw = 0) {
  const body = handles.player?.body;
  if (!body) return;
  body.setTranslation({ x, y, z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
}

export const useSiege = create<SiegeState>((set, get) => ({
  sim: null,
  lobby: false,
  side: 0,
  size: "standard",
  result: null,
  loot: emptyLoot(),
  feed: [],
  wheel: false,
  setLobby: (lobby) => {
    if (lobby) document.exitPointerLock?.();
    useGame.setState({ panelOpen: lobby });
    set({ lobby });
  },
  setSide: (side) => set({ side }),
  setSize: (size) => set({ size }),
  setWheel: (wheel) => set({ wheel }),
  start: () => {
    const { side, size } = get();
    const g = useGame.getState();
    const coins = g.inventory.extraCoin ?? 0;
    const sim = new SiegeSim({ perSide: SIEGE_SIZES[size].perSide, playerSide: side, seed: (Date.now() & 0xffff) + 1, extraCoin: coins > 0 });
    useGame.setState({ panelOpen: false, hp: g.maxHp });
    set({ sim, lobby: false, result: null, loot: emptyLoot(), feed: [] });
    g.setLocation("siege");
    const w = toWorld(sim.player.x, sim.player.z);
    // Hunter nhìn về phía lâu đài (−z), IXO nhìn ra cánh đồng (+z)
    teleport(w.x, 1.4, w.z, side === 0 ? Math.PI : 0);
    // Camera: Hunter nhìn về lâu đài (−z), IXO nhìn ra cánh đồng (+z)
    handles.aimCamera?.(side === 0 ? 0 : Math.PI);
  },
  leave: () => {
    const s = get();
    if (s.sim && s.sim.phase === "end" && !s.result) s.settle();
    set({ sim: null, wheel: false });
    useGame.getState().setLocation("city");
    teleport(SIEGE_GATE.x, 1.3, SIEGE_GATE.z - 5, Math.PI);
    handles.aimCamera?.(0);
  },
  /** Kết thúc trận: tính hạng, trao thưởng đúng một lần */
  settle: () => {
    const { sim, result } = get();
    if (!sim || result || sim.phase !== "end") return;
    const g = useGame.getState();
    const won = sim.winner === sim.playerSide;
    const { pts, rank } = sim.score();
    // Phe yếu người hơn (phe thủ trong bản chơi đơn) được +10%
    const underdog = sim.playerSide === 1 ? 1.1 : 1;
    const cred = Math.round(SIEGE_REWARD.cred[rank] * (won ? SIEGE_REWARD.winMul : SIEGE_REWARD.loseMul) * underdog);
    const [lo, hi] = SIEGE_REWARD.points;
    const points = Math.round(lo + (hi - lo) * Math.min(1, pts / 400));
    g.addCred(cred);
    useMissions.getState().gainPoints(points);
    trackMission("kill", sim.player.kills);
    if (won) trackMission("clear");
    // Đã dùng Extra Coin trong trận thì trừ khỏi túi
    if ((g.inventory.extraCoin ?? 0) > 0 && !sim.player.extraCoin) g.addItem("extraCoin", -1);
    // Rương Công thành: thắng hạng A trở lên chắc chắn có đồ Sử thi+, còn lại 35%
    let gear: string | null = null;
    const rng = createRng(Date.now() & 0xffffff);
    if ((won && (rank === "S" || rank === "A")) || rng() < 0.35) {
      // Rương Công thành: 60% ra một món bộ "Băng Chiến" độc quyền, còn lại đồ Sử thi+ thường
      const id = rng() < 0.6 ? ICE_WAR_SET[Math.floor(rng() * ICE_WAR_SET.length)] : rollGear(rng, 2, "epic");
      useGear.getState().add([id]);
      gear = id;
    }
    set({ result: { won, rank, pts, cred, points, gear, kills: sim.player.kills, loot: get().loot } });
  },
  /** Nhặt một món rơi: cộng thẳng vào túi, ghi vào bảng đồ nhặt của trận */
  grant: (d) => {
    const g = useGame.getState();
    const loot = { ...get().loot };
    if (d.kind === "cred") {
      g.addCred(d.amount);
      loot.cred += d.amount;
    } else if (d.kind === "stim") {
      g.addItem("stim", d.amount);
      loot.stim += d.amount;
      get().pushFeed(`+${d.amount} STIM`, "#7dff9a");
    } else if (d.kind === "key") {
      g.addItem("chestKey", 1);
      loot.key += 1;
      get().pushFeed("+1 CHÌA RƯƠNG", "#ffd166");
    } else {
      const id = d.ice ? ICE_WAR_SET[Math.floor(lootRng() * ICE_WAR_SET.length)] : rollGear(lootRng, 2, "rare");
      useGear.getState().add([id]);
      loot.gear = [...loot.gear, id];
      get().pushFeed(d.ice ? "TRANG BỊ BĂNG CHIẾN!" : "+1 TRANG BỊ", d.ice ? "#7fe8ff" : "#c38bff");
    }
    set({ loot });
  },
  pushFeed: (text, color) => set((s) => ({ feed: [...s.feed.slice(-5), { id: ++feedId, text, color, at: performance.now() / 1000 }] })),
}));

/**
 * Đạn của người chơi trong Công thành (gọi từ PlayerCombat): tìm quân địch / công trình đầu tiên trên tia đạn,
 * gây sát thương, trả về khoảng cách trúng (hoặc null nếu trượt). Toạ độ thế giới.
 */
export function siegeShot(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number, damage: number): number | null {
  const sim = useSiege.getState().sim;
  if (!sim || sim.phase === "end" || !sim.player.alive) return null;
  const hit = sim.rayHit(ox - SIEGE_ORIGIN.x, oy, oz - SIEGE_ORIGIN.z, dx, dy, dz, range);
  if (!hit) return null;
  if (hit.unit) sim.damageUnit(hit.unit, damage, "player");
  else if (hit.obj) sim.damageObjective(hit.obj, damage * (hit.obj.kind === "gate" ? 1.5 : 1));
  return hit.t;
}

/** Đòn chém của người chơi khi đang ở thế Cận chiến / Tanker (gọi từ PlayerCombat thay cho bắn) */
export function siegeSlash(yaw: number): boolean {
  const sim = useSiege.getState().sim;
  if (!sim || sim.phase === "end" || !sim.player.alive) return false;
  return sim.playerSlash(yaw) !== false;
}
