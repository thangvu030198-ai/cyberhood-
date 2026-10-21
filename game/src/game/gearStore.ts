// Kho trang bị của người chơi: vũ khí / giáp đã nhặt (đếm số lượng) và món đang mặc.
// Lưu trong trình duyệt; súng tay mặc định luôn có.

import { create } from "zustand";
import { GEAR, type ArmorId, type GearId, type WeaponId } from "../level/gear";

const KEY = "cyberhood.gear.v1";

type GearState = {
  owned: Partial<Record<GearId, number>>;
  weapon: WeaponId;
  armor: ArmorId;
  /** Món mới nhặt chưa xem trong Túi đồ (chấm đỏ trên nút túi) */
  fresh: GearId[];
  add: (ids: GearId[]) => void;
  equip: (id: WeaponId | ArmorId) => void;
  seen: () => void;
};

type Saved = Pick<GearState, "owned" | "weapon" | "armor" | "fresh">;

function load(): Saved {
  const empty: Saved = { owned: {}, weapon: "buster", armor: "none", fresh: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw) as Partial<Saved>;
    const owned = Object.fromEntries(Object.entries(s.owned ?? {}).filter(([k]) => k in GEAR)) as Saved["owned"];
    const has = (id: string) => id in owned;
    return {
      owned,
      weapon: s.weapon && (s.weapon === "buster" || has(s.weapon)) ? s.weapon : "buster",
      armor: s.armor && (s.armor === "none" || has(s.armor)) ? s.armor : "none",
      fresh: (s.fresh ?? []).filter(has) as GearId[],
    };
  } catch {
    return empty;
  }
}

function save(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // bộ nhớ trình duyệt không dùng được: chỉ giữ trong phiên
  }
}

export const useGear = create<GearState>((set, get) => ({
  ...load(),
  add: (ids) => {
    if (!ids.length) return;
    const owned = { ...get().owned };
    for (const id of ids) owned[id] = (owned[id] ?? 0) + 1;
    const fresh = [...new Set([...get().fresh, ...ids])];
    set({ owned, fresh });
    save({ ...get() });
  },
  equip: (id) => {
    const isWeapon = id === "buster" || (id in GEAR && GEAR[id as GearId].slot === "weapon");
    const owned = id === "buster" || id === "none" || !!get().owned[id as GearId];
    if (!owned) return;
    if (isWeapon) set({ weapon: id as WeaponId });
    else set({ armor: id as ArmorId });
    save({ ...get() });
  },
  seen: () => {
    set({ fresh: [] });
    save({ ...get() });
  },
}));
