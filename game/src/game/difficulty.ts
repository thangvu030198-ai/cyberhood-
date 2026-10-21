// Độ khó chung cho mọi trò chơi sau cổng nhiệm vụ (màn 2D, đua kart, đấu trường). Lưu trong trình duyệt.

import { create } from "zustand";
import type { Difficulty } from "../level/platformer";

export const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: "easy", label: "Dễ", note: "Địch yếu, thưởng ×0.8" },
  { id: "normal", label: "Thường", note: "Cân bằng, thưởng ×1" },
  { id: "hard", label: "Khó", note: "Địch trâu và đau hơn, thưởng ×1.35" },
  { id: "nightmare", label: "Ác mộng", note: "Một sai lầm là trả giá, thưởng ×1.9" },
];

/** Hệ số cho đua kart (tốc độ AI) và đấu trường (máu / lực đòn đối thủ) */
export const DIFF_MODS: Record<Difficulty, { kartAi: number; duelHp: number; duelPower: number; duelThink: number; reward: number }> = {
  easy: { kartAi: 0.92, duelHp: 0.75, duelPower: 0.7, duelThink: 1.35, reward: 0.8 },
  normal: { kartAi: 1, duelHp: 1, duelPower: 1, duelThink: 1, reward: 1 },
  hard: { kartAi: 1.05, duelHp: 1.35, duelPower: 1.3, duelThink: 0.8, reward: 1.35 },
  nightmare: { kartAi: 1.1, duelHp: 1.8, duelPower: 1.7, duelThink: 0.62, reward: 1.9 },
};

const KEY = "cyberhood.difficulty.v1";

function load(): Difficulty {
  try {
    const v = localStorage.getItem(KEY);
    return v && DIFFICULTIES.some((d) => d.id === v) ? (v as Difficulty) : "normal";
  } catch {
    return "normal";
  }
}

export const useDifficulty = create<{ level: Difficulty; set: (d: Difficulty) => void }>((set) => ({
  level: load(),
  set: (level) => {
    try {
      localStorage.setItem(KEY, level);
    } catch {
      // chỉ giữ trong phiên
    }
    set({ level });
  },
}));
