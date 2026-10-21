// Vào / ra đấu trường đối kháng từ bảng chọn map, trao thưởng khi thắng.

import { create } from "zustand";
import { DuelSim, RIVALS } from "./duel";
import { useGear } from "../game/gearStore";
import { rollGear } from "./gear";
import { createRng } from "../sim/rng";
import { DIFF_MODS, useDifficulty } from "../game/difficulty";
import { useGame } from "../game/store";
import { trackMission } from "../game/missionStore";
import { handles } from "../game/refs";
import { MISSION_GATE } from "../game/config";

/** Thưởng thắng một trận: CRED theo bậc đối thủ, 1 Chìa rương; hạ nhà vô địch thêm 1 trang bị Sử thi trở lên */
export const DUEL_REWARD = { chestKeys: 1 };

const LADDER_KEY = "cyberhood.duel.ladder.v1";

function loadBeaten() {
  try {
    return Math.max(0, Math.min(RIVALS.length, Number(localStorage.getItem(LADDER_KEY) ?? 0) || 0));
  } catch {
    return 0;
  }
}

type DuelState = {
  sim: DuelSim | null;
  rewarded: boolean;
  /** Số bậc đã hạ trên thang (đấu tiếp bậc kế; hạ hết thì đấu lại nhà vô địch) */
  beaten: number;
  /** Trang bị vừa nhận khi hạ nhà vô địch */
  prize: string | null;
  start: (rival?: number) => void;
  leave: () => void;
};

export const useDuel = create<DuelState>((set, get) => ({
  sim: null,
  rewarded: false,
  beaten: loadBeaten(),
  prize: null,
  start: (rival) => {
    document.exitPointerLock?.();
    const i = Math.min(rival ?? get().beaten, RIVALS.length - 1);
    // Độ khó nhân máu, lực đòn, tốc độ phản ứng của đối thủ
    const d = DIFF_MODS[useDifficulty.getState().level];
    const r = RIVALS[i];
    const scaled = { ...r, hp: r.hp * d.duelHp, power: r.power * d.duelPower, think: r.think * d.duelThink, reward: Math.round(r.reward * d.reward) };
    set({ sim: new DuelSim((Date.now() & 0xffff) + 1, scaled), rewarded: false, prize: null });
    useGame.getState().setLocation("level");
  },
  leave: () => {
    set({ sim: null });
    const body = handles.player?.body;
    if (body) {
      body.setTranslation({ x: MISSION_GATE.x, y: 1.3, z: MISSION_GATE.z + 4 }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    useGame.getState().setLocation("city");
    void get;
  },
}));

/** Gọi mỗi khung hình từ HUD: thắng thì trao thưởng đúng một lần */
export function settleDuel() {
  const { sim, rewarded } = useDuel.getState();
  if (!sim || rewarded || sim.status !== "won") return;
  const g = useGame.getState();
  g.addCred(sim.rival.reward);
  g.addItem("chestKey", DUEL_REWARD.chestKeys);
  trackMission("kill");
  trackMission("boss");
  const idx = RIVALS.findIndex((r) => r.id === sim.rival.id);
  const beaten = Math.max(useDuel.getState().beaten, idx + 1);
  try {
    localStorage.setItem(LADDER_KEY, String(beaten));
  } catch {
    // không lưu được: chỉ giữ trong phiên
  }
  let prize: string | null = null;
  if (idx === RIVALS.length - 1) {
    const gear = rollGear(createRng(Date.now() & 0xffffff), 2, "epic");
    useGear.getState().add([gear]);
    prize = gear;
  }
  useDuel.setState({ rewarded: true, beaten, prize });
}
