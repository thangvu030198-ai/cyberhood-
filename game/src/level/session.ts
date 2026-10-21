// Vào / ra màn đi ngang từ cổng nhiệm vụ ở Hub và trao thưởng.
// Có hợp đồng: mỗi checkpoint hoàn thành một nhiệm vụ (rơi đồ), hạ trùm là sự kiện + rút lui thành công.
// Hết năng lượng thì vẫn chơi được ở chế độ luyện tập, chỉ nhận CRED.

import { create } from "zustand";
import { addKill, completeEvent, completeMission } from "../sim/contract";
import { playSfx } from "../game/assets";
import { startNewContract } from "../game/contracts";
import { useHunter } from "../game/hunter";
import { questProgress } from "../game/quests";
import { handles } from "../game/refs";
import { useGame } from "../game/store";
import { MISSION_GATE } from "../game/config";
import { LEVEL_1 } from "./level1";
import { PlatformerSim } from "./platformer";

/** Thưởng CRED: cơ bản khi qua màn + mỗi địch hạ */
export const LEVEL_REWARD = { clear: 60, perKill: 3 };

type LevelState = {
  sim: PlatformerSim | null;
  /** Có hợp đồng đang chạy khi vào màn (false = luyện tập) */
  contract: boolean;
  /** Đã trao thưởng qua màn chưa */
  rewarded: boolean;
  start: () => void;
  leave: () => void;
};

export const useLevel = create<LevelState>((set, get) => ({
  sim: null,
  contract: false,
  rewarded: false,
  start: () => {
    const sim = new PlatformerSim(LEVEL_1);
    let lastCheckpoint = -1;
    sim.onEvent = (kind) => {
      const c = useHunter.getState().contract;
      if (kind === "kill") {
        questProgress("kill");
        if (c) addKill(c);
      }
      if (kind === "checkpoint" && sim.checkpointIndex > lastCheckpoint) {
        lastCheckpoint = sim.checkpointIndex;
        if (c) rewardNextMission();
      }
      if (kind === "cleared") finish();
    };
    set({ sim, contract: !!useHunter.getState().contract, rewarded: false });
  },
  leave: () => {
    const { sim, rewarded } = get();
    const c = useHunter.getState().contract;
    // Bỏ dở giữa chừng: hợp đồng tính như thất bại
    if (sim && !rewarded && c) {
      useHunter.getState().endContract("dead");
      useGame.getState().showToast("Bỏ dở nhiệm vụ: hợp đồng thất bại");
    }
    set({ sim: null });
    exitToHub();
  },
}));

function rewardNextMission() {
  const h = useHunter.getState();
  const c = h.contract;
  if (!c) return;
  const marker = c.markers.find((m) => !m.done);
  if (!marker) return;
  const reward = completeMission(c, marker.id);
  if (reward) {
    h.notifyDrop(reward.drop);
    playSfx("pickup", 0.9);
  }
  useHunter.setState({ contract: c });
}

function finish() {
  const st = useLevel.getState();
  if (st.rewarded || !st.sim) return;
  const sim = st.sim;
  const g = useGame.getState();
  g.addCred(LEVEL_REWARD.clear + sim.kills * LEVEL_REWARD.perKill);
  const h = useHunter.getState();
  const c = h.contract;
  if (c) {
    // Hạ trùm = sự kiện của hợp đồng; các nhiệm vụ còn lại tính hoàn thành, rồi rút lui an toàn
    completeEvent(c);
    while (c.markers.some((m) => !m.done)) rewardNextMission();
    h.endContract("extracted");
  }
  useLevel.setState({ rewarded: true });
}

/** Qua cổng: mở hợp đồng nếu còn năng lượng, rồi chuyển sang màn đi ngang */
export function enterLevel() {
  const g = useGame.getState();
  if (g.mode !== "foot" || g.flatlinedAt !== null) return;
  if (!useHunter.getState().contract) {
    const err = startNewContract();
    if (err) g.showToast(`${err}. Vào màn luyện tập (chỉ nhận CRED)`);
  }
  document.exitPointerLock?.();
  useLevel.getState().start();
  g.setLocation("level");
}

/** Về Hub: đứng ngay trước cổng, quay lưng lại cổng */
function exitToHub() {
  const body = handles.player?.body;
  if (body) {
    body.setTranslation({ x: MISSION_GATE.x, y: 1.3, z: MISSION_GATE.z + 4 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }
  useGame.getState().setLocation("city");
}
