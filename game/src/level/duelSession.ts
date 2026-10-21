// Vào / ra đấu trường đối kháng từ bảng chọn map, trao thưởng khi thắng.

import { create } from "zustand";
import { DuelSim } from "./duel";
import { useGame } from "../game/store";
import { trackMission } from "../game/missionStore";
import { handles } from "../game/refs";
import { MISSION_GATE } from "../game/config";

/** Thưởng thắng một trận đối kháng */
export const DUEL_REWARD = { cred: 45, chestKeys: 1 };

type DuelState = {
  sim: DuelSim | null;
  rewarded: boolean;
  start: () => void;
  leave: () => void;
};

export const useDuel = create<DuelState>((set, get) => ({
  sim: null,
  rewarded: false,
  start: () => {
    document.exitPointerLock?.();
    set({ sim: new DuelSim((Date.now() & 0xffff) + 1), rewarded: false });
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
  g.addCred(DUEL_REWARD.cred);
  g.addItem("chestKey", DUEL_REWARD.chestKeys);
  trackMission("kill");
  trackMission("boss");
  useDuel.setState({ rewarded: true });
}
