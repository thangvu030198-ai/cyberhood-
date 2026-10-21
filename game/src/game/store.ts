import { create } from "zustand";
import { BLOCK_CENTERS, CITY_PITCH } from "./config";

export type Emote = "wave" | "dance" | "thumbsUp";
export type Mode = "foot" | "drive";

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

// ---------------------------------------------------------------------------
// Kinh tế và nâng cấp

export type UpgradeId = "repeater" | "armor" | "overclock";
export type ShopItemId = "medkit" | UpgradeId;

export const SHOP_ITEMS: { id: ShopItemId; name: string; desc: string; price: number }[] = [
  { id: "medkit", name: "Stim Pack", desc: "Hồi 60 máu ngay lập tức", price: 40 },
  { id: "repeater", name: "Blaster Repeater", desc: "Súng liên thanh: bắn nhanh gấp 2,5 lần", price: 250 },
  { id: "armor", name: "Dermal Plating", desc: "Giáp dưới da: máu tối đa 100 → 160", price: 300 },
  { id: "overclock", name: "Neural Overclock", desc: "Chip thần kinh: sát thương +50%", price: 400 },
];

export const BASE_HP = 100;
export const ARMOR_HP = 160;
export const MAX_WANTED = 5;

type Upgrades = Record<UpgradeId, boolean>;

type SaveData = { cred: number; upgrades: Upgrades; kills: number };
const SAVE_KEY = "cyberhood.save.v1";

function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveData) : null;
  } catch {
    return null;
  }
}

function writeSave(data: SaveData) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Không lưu được (chế độ ẩn danh...): chơi tiếp không lưu.
  }
}

const saved = loadSave();
const savedUpgrades: Upgrades = { repeater: false, armor: false, overclock: false, ...saved?.upgrades };

type GameState = {
  x: number;
  z: number;
  emote: Emote | null;
  ready: boolean;
  mode: Mode;
  /** Xe đang lái */
  carId: number | null;
  /** Xe gần nhất đủ gần để lên */
  nearCarId: number | null;
  /** km/h, chỉ cập nhật khi đang lái */
  speed: number;

  hp: number;
  maxHp: number;
  cred: number;
  kills: number;
  upgrades: Upgrades;
  /** Mức truy nã 0–5 sao */
  wanted: number;
  /** Thời điểm (giây, performance.now) gây án gần nhất, dùng để hạ sao truy nã */
  lastCrimeAt: number;
  lastDamageAt: number;
  lastHitAt: number;
  /** Lần gần nhất nhặt CRED: hiện "+25" trên HUD */
  lastLoot: { amount: number; at: number } | null;
  flatlinedAt: number | null;
  aiming: boolean;
  /** Chuột đang bị khoá vào game (rê để xoay camera) */
  pointerLocked: boolean;
  nearShop: boolean;
  shopOpen: boolean;

  setReady: () => void;
  setPosition: (x: number, z: number) => void;
  setEmote: (e: Emote | null) => void;
  setNearCar: (id: number | null) => void;
  setSpeed: (kmh: number) => void;
  enterCar: (id: number) => void;
  exitCar: () => void;

  damagePlayer: (amount: number) => void;
  heal: (amount: number) => void;
  addCred: (amount: number) => void;
  registerKill: () => void;
  coolDownWanted: () => void;
  markHit: () => void;
  respawn: () => void;
  setAiming: (aiming: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  setNearShop: (near: boolean) => void;
  setShopOpen: (open: boolean) => void;
  buy: (id: ShopItemId) => "ok" | "poor" | "owned" | "full";
};

const now = () => performance.now() / 1000;

export const useGame = create<GameState>((set, get) => ({
  x: 0,
  z: 0,
  emote: null,
  ready: false,
  mode: "foot",
  carId: null,
  nearCarId: null,
  speed: 0,

  hp: savedUpgrades.armor ? ARMOR_HP : BASE_HP,
  maxHp: savedUpgrades.armor ? ARMOR_HP : BASE_HP,
  cred: saved?.cred ?? 50,
  kills: saved?.kills ?? 0,
  upgrades: savedUpgrades,
  wanted: 0,
  lastCrimeAt: 0,
  lastDamageAt: -Infinity,
  lastHitAt: -Infinity,
  lastLoot: null,
  flatlinedAt: null,
  aiming: false,
  pointerLocked: false,
  nearShop: false,
  shopOpen: false,

  setReady: () => set({ ready: true }),
  setPosition: (x, z) => set({ x, z }),
  setEmote: (emote) => set({ emote }),
  setNearCar: (nearCarId) => set({ nearCarId }),
  setSpeed: (speed) => set({ speed }),
  enterCar: (carId) => set({ mode: "drive", carId, nearCarId: null, emote: null, aiming: false, shopOpen: false }),
  exitCar: () => set({ mode: "foot", carId: null, speed: 0 }),

  damagePlayer: (amount) => {
    const s = get();
    if (s.flatlinedAt !== null) return;
    const hp = Math.max(0, s.hp - amount);
    set({ hp, lastDamageAt: now() });
    if (hp === 0) {
      // Flatline: mất 10% CRED, hết truy nã
      set({ flatlinedAt: now(), cred: Math.floor(s.cred * 0.9), wanted: 0, aiming: false, shopOpen: false });
    }
  },
  heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),
  addCred: (amount) => set((s) => ({ cred: s.cred + amount, lastLoot: { amount, at: now() } })),
  registerKill: () =>
    set((s) => ({ kills: s.kills + 1, wanted: Math.min(MAX_WANTED, s.wanted + 1), lastCrimeAt: now() })),
  coolDownWanted: () => set((s) => ({ wanted: Math.max(0, s.wanted - 1), lastCrimeAt: now() })),
  markHit: () => set({ lastHitAt: now() }),
  respawn: () => set((s) => ({ hp: s.maxHp, flatlinedAt: null, mode: "foot", carId: null, speed: 0 })),
  setAiming: (aiming) => set({ aiming }),
  setPointerLocked: (pointerLocked) => set(pointerLocked ? { pointerLocked } : { pointerLocked, aiming: false }),
  setNearShop: (nearShop) => set({ nearShop }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
  buy: (id) => {
    const s = get();
    const item = SHOP_ITEMS.find((i) => i.id === id)!;
    if (id === "medkit") {
      if (s.hp >= s.maxHp) return "full";
    } else if (s.upgrades[id]) {
      return "owned";
    }
    if (s.cred < item.price) return "poor";
    if (id === "medkit") {
      set({ cred: s.cred - item.price, hp: Math.min(s.maxHp, s.hp + 60) });
    } else {
      const upgrades = { ...s.upgrades, [id]: true };
      const maxHp = upgrades.armor ? ARMOR_HP : BASE_HP;
      set({ cred: s.cred - item.price, upgrades, maxHp, hp: id === "armor" ? maxHp : s.hp });
    }
    return "ok";
  },
}));

// Lưu tiến trình mỗi khi CRED, nâng cấp hoặc số lần hạ gục thay đổi.
useGame.subscribe((s, prev) => {
  if (s.cred !== prev.cred || s.upgrades !== prev.upgrades || s.kills !== prev.kills) {
    writeSave({ cred: s.cred, upgrades: s.upgrades, kills: s.kills });
  }
});
