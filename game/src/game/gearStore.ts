// Tủ đồ của người chơi: trang bị đã có (đếm số lượng), cấp cường hoá từng món, món đang mặc ở 6 ô
// (vũ khí, giáp, mũ, găng, giày, chip). Lưu trong trình duyệt; súng tay mặc định luôn có.
// Kèm các dịch vụ ở sảnh: lò rèn (đập đồ), vòng quay may mắn, cửa hàng trang bị.

import { create } from "zustand";
import { FORGE, forgeRoll, GEAR, MAX_ENHANCE, rollGear, type AccessoryId, type ArmorId, type GearId, type Loadout, type Slot, type WeaponId } from "../level/gear";
import { rarityIndex } from "../sim/config";
import { useGame } from "./store";
import { useHunter } from "./hunter";

const KEY = "cyberhood.gear.v1";

type Saved = Loadout & {
  owned: Partial<Record<GearId, number>>;
  enh: Partial<Record<GearId, number>>;
  fresh: GearId[];
  /** Ngày đã dùng lượt quay miễn phí (yyyy-mm-dd) */
  freeSpin: string;
};

type GearState = Saved & {
  add: (ids: GearId[]) => void;
  equip: (id: GearId | "buster" | "none") => void;
  unequip: (slot: Slot) => void;
  seen: () => void;
  /** Đập đồ: trả về kết quả để bảng lò rèn hiện hiệu ứng */
  forge: (id: GearId) => { ok: boolean; level: number; error?: string };
  spin: () => { prize: SpinPrize; free: boolean } | { error: string };
  buy: (id: GearId) => string | null;
};

const EMPTY: Saved = { owned: {}, enh: {}, weapon: "buster", armor: "none", head: null, hands: null, feet: null, chip: null, fresh: [], freeSpin: "" };

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const s = JSON.parse(raw) as Partial<Saved>;
    const owned = Object.fromEntries(Object.entries(s.owned ?? {}).filter(([k]) => k in GEAR)) as Saved["owned"];
    const has = (id: string | null | undefined) => !!id && id in owned;
    const acc = (id: AccessoryId | null | undefined) => (has(id) ? id! : null);
    return {
      owned,
      enh: Object.fromEntries(Object.entries(s.enh ?? {}).filter(([k]) => k in GEAR)) as Saved["enh"],
      weapon: s.weapon && (s.weapon === "buster" || has(s.weapon)) ? s.weapon : "buster",
      armor: s.armor && (s.armor === "none" || has(s.armor)) ? s.armor : "none",
      head: acc(s.head),
      hands: acc(s.hands),
      feet: acc(s.feet),
      chip: acc(s.chip),
      fresh: (s.fresh ?? []).filter(has) as GearId[],
      freeSpin: s.freeSpin ?? "",
    };
  } catch {
    return EMPTY;
  }
}

function save(s: Saved) {
  try {
    const { owned, enh, weapon, armor, head, hands, feet, chip, fresh, freeSpin } = s;
    localStorage.setItem(KEY, JSON.stringify({ owned, enh, weapon, armor, head, hands, feet, chip, fresh, freeSpin }));
  } catch {
    // bộ nhớ trình duyệt không dùng được: chỉ giữ trong phiên
  }
}

export const loadoutOf = (s: Loadout): Loadout => ({ weapon: s.weapon, armor: s.armor, head: s.head, hands: s.hands, feet: s.feet, chip: s.chip });

// ---------------------------------------------------------------------------
// Vòng quay may mắn: 8 ô thưởng có trọng số; ô Jackpot hiếm nhất

export type SpinPrize = { id: string; label: string; weight: number; color: string };
export const SPIN_COST = 60;
export const SPIN_PRIZES: SpinPrize[] = [
  { id: "cred30", label: "30 CRED", weight: 26, color: "#ffd23d" },
  { id: "key", label: "Chìa rương", weight: 16, color: "#7dffb0" },
  { id: "cred120", label: "120 CRED", weight: 14, color: "#ffb03d" },
  { id: "stim", label: "Stim Pack", weight: 14, color: "#7dff9a" },
  { id: "gear", label: "Trang bị", weight: 12, color: "#5ab4ff" },
  { id: "key3", label: "3 Chìa rương", weight: 9, color: "#2fffd0" },
  { id: "epic", label: "Đồ Sử thi+", weight: 6, color: "#c27dff" },
  { id: "jackpot", label: "JACKPOT", weight: 3, color: "#ff4a64" },
];

export function pickPrize(roll: number): SpinPrize {
  const total = SPIN_PRIZES.reduce((n, p) => n + p.weight, 0);
  let r = roll * total;
  for (const p of SPIN_PRIZES) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return SPIN_PRIZES[0];
}

/** Cửa hàng trang bị: chỉ bán đồ Thường / Hiếm; đồ Sử thi trở lên phải nhặt, quay hoặc đánh trùm */
export const SHOP_GEAR: { id: GearId; price: number }[] = [
  { id: "ar", price: 260 },
  { id: "shotgun", price: 520 },
  { id: "sniper", price: 560 },
  { id: "helm_visor", price: 480 },
  { id: "glove_shock", price: 480 },
  { id: "boot_runner", price: 480 },
];

const today = () => new Date().toISOString().slice(0, 10);

export const useGear = create<GearState>((set, get) => {
  const commit = (patch: Partial<Saved>) => {
    set(patch);
    save({ ...get() });
  };
  return {
    ...load(),
    add: (ids) => {
      if (!ids.length) return;
      const owned = { ...get().owned };
      for (const id of ids) owned[id] = (owned[id] ?? 0) + 1;
      commit({ owned, fresh: [...new Set([...get().fresh, ...ids])] });
    },
    equip: (id) => {
      if (id === "buster") return commit({ weapon: "buster" });
      if (id === "none") return commit({ armor: "none" });
      if (!get().owned[id]) return;
      const slot = GEAR[id].slot;
      if (slot === "weapon") commit({ weapon: id as WeaponId });
      else if (slot === "armor") commit({ armor: id as ArmorId });
      else commit({ [slot]: id as AccessoryId });
    },
    unequip: (slot) => {
      if (slot === "weapon") commit({ weapon: "buster" });
      else if (slot === "armor") commit({ armor: "none" });
      else commit({ [slot]: null });
    },
    seen: () => commit({ fresh: [] }),
    forge: (id) => {
      const level = get().enh[id] ?? 0;
      if (!get().owned[id]) return { ok: false, level, error: "Chưa có món này" };
      if (level >= MAX_ENHANCE) return { ok: false, level, error: "Đã cường hoá tối đa +10" };
      const g = useGame.getState();
      const cost = FORGE.cost(level);
      if (g.cred < cost) return { ok: false, level, error: `Thiếu CRED (cần ${cost})` };
      const h = useHunter.getState();
      let parts = h.parts;
      if (FORGE.needsPart(level)) {
        // Dùng linh kiện Hiếm rẻ nhất trong kho làm vật liệu
        const i = parts.reduce((best, p, k) => (rarityIndex(p.rarity) >= 1 && (best < 0 || rarityIndex(p.rarity) < rarityIndex(parts[best].rarity)) ? k : best), -1);
        if (i < 0) return { ok: false, level, error: "Từ +5 cần 1 linh kiện Hiếm trở lên làm vật liệu" };
        parts = parts.filter((_, k) => k !== i);
      }
      g.addCred(-cost);
      useHunter.setState({ parts });
      const r = forgeRoll(level, Math.random());
      commit({ enh: { ...get().enh, [id]: r.next } });
      return { ok: r.ok, level: r.next };
    },
    spin: () => {
      const g = useGame.getState();
      const free = get().freeSpin !== today();
      if (!free) {
        if (g.cred < SPIN_COST) return { error: `Cần ${SPIN_COST} CRED để quay` };
        g.addCred(-SPIN_COST);
      }
      const prize = pickPrize(Math.random());
      const rnd = () => Math.random();
      if (prize.id === "cred30") g.addCred(30);
      else if (prize.id === "cred120") g.addCred(120);
      else if (prize.id === "key") g.addItem("chestKey", 1);
      else if (prize.id === "key3") g.addItem("chestKey", 3);
      else if (prize.id === "stim") g.addItem("stim", 1);
      else if (prize.id === "gear") get().add([rollGear(rnd)]);
      else if (prize.id === "epic") get().add([rollGear(rnd, 1.5, "epic")]);
      else if (prize.id === "jackpot") {
        g.addCred(1000);
        get().add([rollGear(rnd, 2, "legendary")]);
      }
      if (free) commit({ freeSpin: today() });
      return { prize, free };
    },
    buy: (id) => {
      const item = SHOP_GEAR.find((x) => x.id === id);
      if (!item) return "Không bán món này";
      const g = useGame.getState();
      if (g.cred < item.price) return `Thiếu CRED (cần ${item.price})`;
      g.addCred(-item.price);
      get().add([id]);
      return null;
    },
  };
});
