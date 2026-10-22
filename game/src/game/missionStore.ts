// Kho trạng thái nhiệm vụ ngày/tuần/tháng: lưu máy người chơi, ghi tiến độ, trao thưởng vào tài khoản.

import { create } from "zustand";
import { MISSIONS, PERIOD_BONUS, claim, claimBonus, freshMissions, refresh, track, type Metric, type MissionState, type Period, type Reward , addHunterPoints } from "./missions";
import { rollDrop } from "../sim/loot";
import { createRng } from "../sim/rng";
import { useGame } from "./store";
import { useHunter } from "./hunter";
import { playSfx } from "./assets";

const SAVE_KEY = "cyberhood.missions.v1";

function load(): MissionState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return refresh(JSON.parse(raw) as MissionState, new Date());
  } catch {
    // Không đọc được bộ nhớ trình duyệt: bắt đầu mới
  }
  return freshMissions(new Date());
}

function save(s: MissionState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Chế độ ẩn danh / bộ nhớ đầy: tiến độ chỉ giữ trong phiên này
  }
}

type Store = {
  state: MissionState;
  open: boolean;
  setOpen: (open: boolean) => void;
  track: (metric: Metric, amount?: number) => void;
  claim: (id: string) => void;
  claimBonus: (p: Period) => void;
  /** Cộng Điểm Hunter trực tiếp (Công thành: 30–80 điểm/trận) */
  gainPoints: (n: number) => void;
};

export const useMissions = create<Store>((set, get) => ({
  state: load(),
  open: false,
  setOpen: (open) => {
    if (open) document.exitPointerLock?.();
    set({ open });
    useGame.setState({ panelOpen: open });
  },
  track: (metric, amount = 1) => {
    const state = track(get().state, metric, amount, new Date());
    save(state);
    set({ state });
  },
  gainPoints: (n) => {
    const state = addHunterPoints(get().state, n);
    save(state);
    set({ state });
  },
  claim: (id) => {
    const r = claim(get().state, id, new Date());
    if (!r) return;
    save(r.state);
    set({ state: r.state });
    grant(r.reward, MISSIONS.find((m) => m.id === id)?.title ?? "");
  },
  claimBonus: (p) => {
    const r = claimBonus(get().state, p, new Date());
    if (!r) return;
    save(r.state);
    set({ state: r.state });
    grant(PERIOD_BONUS[p], p === "daily" ? "Xong cả ngày" : p === "weekly" ? "Xong cả tuần" : "Xong cả tháng");
  },
}));

/** Trao phần thưởng: CRED, Chìa rương, Stim, rương Sử thi/Huyền thoại (mở ngay, đồ vào kho linh kiện) */
function grant(r: Reward, title: string) {
  const g = useGame.getState();
  const h = useHunter.getState();
  const got: string[] = [];
  if (r.cred) {
    g.addCred(r.cred);
    got.push(`+${r.cred} CRED`);
  }
  if (r.chestKeys) {
    g.addItem("chestKey", r.chestKeys);
    got.push(`+${r.chestKeys} Chìa rương`);
  }
  if (r.stims) {
    g.addItem("stim", r.stims);
    got.push(`+${r.stims} Stim`);
  }
  if (r.hunterPoints) got.push(`+${r.hunterPoints} Điểm Hunter`);
  const rng = createRng(Date.now() & 0xffffff);
  const parts = [
    ...Array.from({ length: r.epicChest ?? 0 }, () => rollDrop(rng, h.pity, { minRarity: "epic" })),
    ...Array.from({ length: r.legendaryChest ?? 0 }, () => rollDrop(rng, h.pity, { minRarity: "legendary" })),
  ];
  if (parts.length) {
    useHunter.setState({ parts: [...h.parts, ...parts], pity: { ...h.pity } });
    for (const p of parts) h.notifyDrop(p);
    got.push(`${parts.length} rương đồ hiếm`);
  }
  playSfx("pickup", 0.9);
  g.showToast(`${title}: ${got.join(" · ")}`);
}

/** Ghi tiến độ từ bất kỳ đâu (màn chơi, Hub) */
export const trackMission = (metric: Metric, amount = 1) => useMissions.getState().track(metric, amount);
