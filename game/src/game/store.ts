import { create } from "zustand";
import { BLOCK_CENTERS, CITY_PITCH } from "./config";

export type Emote = "wave" | "dance" | "thumbsUp";

const DISTRICTS = ["Neon Bazaar", "Chrome Arena", "Data Haven", "The Undergrid"];

/** Mỗi góc phần tư của thành phố là một District. */
export function districtAt(x: number, z: number) {
  const i = (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0);
  return DISTRICTS[i];
}

/** Toạ độ ô lưới kiểu "B-3" để hiển thị trên HUD. */
export function gridRef(x: number, z: number) {
  const half = (BLOCK_CENTERS.length * CITY_PITCH) / 2;
  const col = Math.min(BLOCK_CENTERS.length - 1, Math.max(0, Math.floor((x + half) / CITY_PITCH)));
  const row = Math.min(BLOCK_CENTERS.length - 1, Math.max(0, Math.floor((z + half) / CITY_PITCH)));
  return `${String.fromCharCode(65 + col)}-${row + 1}`;
}

type GameState = {
  x: number;
  z: number;
  emote: Emote | null;
  ready: boolean;
  setReady: () => void;
  setPosition: (x: number, z: number) => void;
  setEmote: (e: Emote | null) => void;
};

export const useGame = create<GameState>((set) => ({
  x: 0,
  z: 0,
  emote: null,
  ready: false,
  setReady: () => set({ ready: true }),
  setPosition: (x, z) => set({ x, z }),
  setEmote: (emote) => set({ emote }),
}));
