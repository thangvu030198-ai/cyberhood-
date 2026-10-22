import type { HunterSkin } from "./skins";
import { create } from "zustand";
import { BLOCK_CENTERS, CITY_PITCH, DISTRICTS, ENEMY_DAMAGE_MUL, districtIdAt } from "./config";
import type { ItemId, NpcId } from "./story";

export type Emote = "wave" | "dance" | "thumbsUp";
export type Mode = "foot" | "drive";

/** Tên District tại một điểm */
export function districtAt(x: number, z: number) {
  return DISTRICTS[districtIdAt(x, z)].name;
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
  { id: "medkit", name: "Stim Pack", desc: "Cất vào túi đồ, nhấn Q để hồi 60 máu", price: 40 },
  { id: "repeater", name: "Blaster Repeater", desc: "Súng liên thanh: bắn nhanh gấp 2,5 lần", price: 250 },
  { id: "armor", name: "Dermal Plating", desc: "Giáp dưới da: máu tối đa 100 → 160", price: 300 },
  { id: "overclock", name: "Neural Overclock", desc: "Chip thần kinh: sát thương +50%", price: 400 },
];

export const BASE_HP = 100;
export const ARMOR_HP = 160;
export const MAX_WANTED = 5;
export const MAX_STIMS = 9;

type Upgrades = Record<UpgradeId, boolean>;

// ---------------------------------------------------------------------------
// Hồ sơ, túi đồ, nhiệm vụ, hội thoại

export type Profile = { handle: string; body: string; glow: string; hunter?: HunterSkin };
export type Inventory = Partial<Record<ItemId, number>>;
export type QuestState = { active: string | null; step: number; progress: number; done: string[] };
export type Quality = "high" | "low";
export type Location = "city" | "vault" | "level" | "siege" | "raid";

export type DialogueAction = "close" | "accept" | "advance" | "shop";
export type Dialogue = {
  npc: NpcId;
  text: string;
  choices: { label: string; action: DialogueAction; questId?: string }[];
};

/** Thứ có thể tương tác bằng phím E ở gần người chơi */
export type Interactable =
  | { kind: "npc"; id: NpcId }
  | { kind: "door" }
  | { kind: "exit" }
  | { kind: "terminal" }
  | { kind: "board" }
  | { kind: "gate" }
  | { kind: "service"; id: import("./services").ServiceId }
  | { kind: "missions" }
  | { kind: "siege" }
  | { kind: "raid" };

type SaveData = {
  cred: number;
  upgrades: Upgrades;
  kills: number;
  profile?: Profile | null;
  inventory?: Inventory;
  quest?: QuestState;
  quality?: Quality;
};
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
const touchDevice = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

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
  shopOpen: boolean;
  /** Bảng của Hunter (hợp đồng, gara, kết quả) đang mở */
  panelOpen: boolean;

  profile: Profile | null;
  inventory: Inventory;
  quest: QuestState;
  dialogue: Dialogue | null;
  inventoryOpen: boolean;
  nearInteract: Interactable | null;
  location: Location;
  quality: Quality;
  toast: { text: string; at: number } | null;

  setReady: () => void;
  setPosition: (x: number, z: number) => void;
  setEmote: (e: Emote | null) => void;
  setNearCar: (id: number | null) => void;
  setSpeed: (kmh: number) => void;
  enterCar: (id: number) => void;
  exitCar: () => void;

  damagePlayer: (amount: number, opts?: { emp?: boolean }) => void;
  heal: (amount: number) => void;
  addCred: (amount: number) => void;
  registerKill: () => void;
  coolDownWanted: () => void;
  markHit: () => void;
  respawn: () => void;
  setAiming: (aiming: boolean) => void;
  setPointerLocked: (locked: boolean) => void;
  setShopOpen: (open: boolean) => void;
  buy: (id: ShopItemId) => "ok" | "poor" | "owned" | "full";

  setProfile: (p: Profile) => void;
  addItem: (id: ItemId, n: number) => void;
  removeItem: (id: ItemId, n: number) => void;
  useStim: () => boolean;
  setQuest: (q: QuestState) => void;
  setDialogue: (d: Dialogue | null) => void;
  setInventoryOpen: (open: boolean) => void;
  setNearInteract: (i: Interactable | null) => void;
  setLocation: (l: Location) => void;
  setQuality: (q: Quality) => void;
  showToast: (text: string) => void;
};

const now = () => performance.now() / 1000;

/** Chặn sát thương trước khi trừ máu người (Mech gắn vào đây). Trả true nếu đã xử lý */
let damageHook: ((amount: number, emp: boolean) => boolean) | null = null;
export function setDamageHook(fn: typeof damageHook) {
  damageHook = fn;
}

/** Có bảng giao diện nào đang mở chặn điều khiển nhân vật không */
export function uiBlocking(s: Pick<GameState, "shopOpen" | "dialogue" | "inventoryOpen" | "profile" | "panelOpen">) {
  return s.shopOpen || s.dialogue !== null || s.inventoryOpen || s.profile === null || s.panelOpen;
}

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
  shopOpen: false,
  panelOpen: false,

  profile: saved?.profile ?? null,
  inventory: saved?.inventory ?? {},
  quest: saved?.quest ?? { active: null, step: 0, progress: 0, done: [] },
  dialogue: null,
  inventoryOpen: false,
  nearInteract: null,
  location: "city",
  quality: saved?.quality ?? (touchDevice ? "low" : "high"),
  toast: null,

  setReady: () => set({ ready: true }),
  setPosition: (x, z) => set({ x, z }),
  setEmote: (emote) => set({ emote }),
  setNearCar: (nearCarId) => set({ nearCarId }),
  setSpeed: (speed) => set({ speed }),
  enterCar: (carId) => set({ mode: "drive", carId, nearCarId: null, emote: null, aiming: false, shopOpen: false }),
  exitCar: () => set({ mode: "foot", carId: null, speed: 0 }),

  damagePlayer: (raw, opts) => {
    const s = get();
    if (s.flatlinedAt !== null) return;
    const amount = raw * ENEMY_DAMAGE_MUL;
    // Đang trong Mech: Mech chịu đòn thay người
    if (damageHook?.(amount, !!opts?.emp)) {
      set({ lastDamageAt: now() });
      return;
    }
    const hp = Math.max(0, s.hp - amount);
    set({ hp, lastDamageAt: now() });
    if (hp === 0) {
      // Flatline: mất 10% CRED, hết truy nã
      set({
        flatlinedAt: now(),
        cred: Math.floor(s.cred * 0.9),
        wanted: 0,
        aiming: false,
        shopOpen: false,
        dialogue: null,
        inventoryOpen: false,
      });
    }
  },
  heal: (amount) => set((s) => ({ hp: Math.min(s.maxHp, s.hp + amount) })),
  addCred: (amount) => set((s) => ({ cred: s.cred + amount, lastLoot: { amount, at: now() } })),
  registerKill: () =>
    set((s) => ({ kills: s.kills + 1, wanted: Math.min(MAX_WANTED, s.wanted + 1), lastCrimeAt: now() })),
  coolDownWanted: () => set((s) => ({ wanted: Math.max(0, s.wanted - 1), lastCrimeAt: now() })),
  markHit: () => set({ lastHitAt: now() }),
  respawn: () =>
    set((s) => ({ hp: s.maxHp, flatlinedAt: null, mode: "foot", carId: null, speed: 0, location: "city" })),
  setAiming: (aiming) => set({ aiming }),
  setPointerLocked: (pointerLocked) => set(pointerLocked ? { pointerLocked } : { pointerLocked, aiming: false }),
  setShopOpen: (shopOpen) => set({ shopOpen }),
  buy: (id) => {
    const s = get();
    const item = SHOP_ITEMS.find((i) => i.id === id)!;
    if (id === "medkit") {
      if ((s.inventory.stim ?? 0) >= MAX_STIMS) return "full";
    } else if (s.upgrades[id]) {
      return "owned";
    }
    if (s.cred < item.price) return "poor";
    if (id === "medkit") {
      set({ cred: s.cred - item.price });
      s.addItem("stim", 1);
    } else {
      const upgrades = { ...s.upgrades, [id]: true };
      const maxHp = upgrades.armor ? ARMOR_HP : BASE_HP;
      set({ cred: s.cred - item.price, upgrades, maxHp, hp: id === "armor" ? maxHp : s.hp });
    }
    return "ok";
  },

  setProfile: (profile) => set({ profile }),
  addItem: (id, n) => set((s) => ({ inventory: { ...s.inventory, [id]: (s.inventory[id] ?? 0) + n } })),
  removeItem: (id, n) => set((s) => ({ inventory: { ...s.inventory, [id]: Math.max(0, (s.inventory[id] ?? 0) - n) } })),
  useStim: () => {
    const s = get();
    if ((s.inventory.stim ?? 0) <= 0 || s.hp >= s.maxHp || s.flatlinedAt !== null) return false;
    s.removeItem("stim", 1);
    s.heal(60);
    return true;
  },
  setQuest: (quest) => set({ quest }),
  setDialogue: (dialogue) => set({ dialogue }),
  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),
  setNearInteract: (nearInteract) => set({ nearInteract }),
  setLocation: (location) => set({ location }),
  setQuality: (quality) => set({ quality }),
  showToast: (text) => set({ toast: { text, at: now() } }),
}));

// Lưu tiến trình khi dữ liệu bền thay đổi.
useGame.subscribe((s, prev) => {
  if (
    s.cred !== prev.cred ||
    s.upgrades !== prev.upgrades ||
    s.kills !== prev.kills ||
    s.profile !== prev.profile ||
    s.inventory !== prev.inventory ||
    s.quest !== prev.quest ||
    s.quality !== prev.quality
  ) {
    writeSave({
      cred: s.cred,
      upgrades: s.upgrades,
      kills: s.kills,
      profile: s.profile,
      inventory: s.inventory,
      quest: s.quest,
      quality: s.quality,
    });
  }
});
