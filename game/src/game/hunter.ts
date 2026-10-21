import { create } from "zustand";
import { GAME, MECH_SLOTS, rarityIndex, type MapId, type MechSlot } from "../sim/config";
import { freshPity, makePart, RARITY_LABEL, type MechPart, type PityState } from "../sim/loot";
import { assembleMech, craft, maxDurability, mechPower, mechRarity, repairCost, smelt, type Mech } from "../sim/mech";
import { currentEnergy, spendEnergy, type Energy } from "../sim/energy";
import { addShards, freshSeason, type KeyId, type SeasonProgress } from "../sim/season";
import { freshTransform, type TransformState } from "../sim/transform";
import { finishContract, type Contract, type ContractResult, type ContractStatus } from "../sim/contract";
import { createRng } from "../sim/rng";
import { useGame } from "./store";

// Tiến trình Hunter (GameFi): linh kiện, Mech, năng lượng, pity, mùa, hợp đồng đang chạy.
// Mọi quy tắc nằm trong sim/; store này chỉ giữ trạng thái và lưu xuống máy.
// $CRED tạm đóng vai token (sửa Mech, ghép đồ) cho tới khi nối ví.

const SAVE_KEY = "cyberhood.hunter.v1";

type HunterSave = {
  parts: MechPart[];
  mechs: Mech[];
  equipped: string | null;
  energy: Energy;
  pity: PityState;
  season: SeasonProgress;
  streak: { days: number; lastDay: string | null };
  contractsDone: number;
};

const today = () => new Date().toISOString().slice(0, 10);

function starterSave(): HunterSave {
  // Bộ Mech khởi đầu toàn đồ Thường để người mới thử biến hình ngay
  const rng = createRng(Date.now());
  const parts = Object.fromEntries(MECH_SLOTS.map((s) => [s, makePart(rng, "common", s)])) as Record<MechSlot, MechPart>;
  const mech = assembleMech(parts)!;
  return {
    parts: [],
    mechs: [mech],
    equipped: mech.id,
    energy: { value: GAME.energy.max, updatedAt: Date.now() },
    pity: freshPity(),
    season: freshSeason(),
    streak: { days: 0, lastDay: null },
    contractsDone: 0,
  };
}

function loadSave(): HunterSave {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as HunterSave;
      // Sang mùa mới: reset mảnh, Chìa, điểm mùa; giữ đồ, Mech, token
      if (s.season?.season !== GAME.season.id) s.season = freshSeason();
      return { ...starterSave(), ...s };
    }
  } catch {
    // Save hỏng: bắt đầu lại
  }
  return starterSave();
}

function writeSave(s: HunterSave) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Không lưu được: chơi tiếp không lưu
  }
}

/** Cập nhật chuỗi đăng nhập theo ngày: liên tiếp +1, bỏ 1 ngày thì về 1 */
function touchStreak(streak: HunterSave["streak"]): HunterSave["streak"] {
  const d = today();
  if (streak.lastDay === d) return streak;
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  return { days: streak.lastDay === yesterday ? streak.days + 1 : 1, lastDay: d };
}

export type HunterPanel = "garage" | "contracts" | "result" | null;

type HunterState = HunterSave & {
  transform: TransformState;
  contract: Contract | null;
  result: ContractResult | null;
  /** Đồ hiếm vừa rơi, để HUD hiện banner */
  lastDrop: { part: MechPart; at: number } | null;
  panel: HunterPanel;

  setPanel: (p: HunterPanel) => void;
  energyNow: () => Energy;
  equippedMech: () => Mech | null;
  beginContract: (c: Contract) => boolean;
  endContract: (outcome: Exclude<ContractStatus, "running">) => ContractResult | null;
  notifyDrop: (p: MechPart) => void;
  equipMech: (id: string) => void;
  assemble: (ids: Record<MechSlot, string>) => string | null;
  dismantle: (mechId: string) => void;
  repair: (mechId: string) => "ok" | "poor" | "full";
  craftParts: (ids: string[]) => string;
  smeltMech: (mechId: string) => string;
  useMechDurability: () => void;
  touch: () => void;
};

const saved = loadSave();

export const useHunter = create<HunterState>((set, get) => ({
  ...saved,
  streak: touchStreak(saved.streak),
  transform: freshTransform("titan_frame"),
  contract: null,
  result: null,
  lastDrop: null,
  panel: null,

  setPanel: (panel) => {
    set({ panel });
    useGame.setState({ panelOpen: panel !== null });
  },
  energyNow: () => currentEnergy(get().energy, Date.now()),
  equippedMech: () => get().mechs.find((m) => m.id === get().equipped) ?? null,

  beginContract: (contract) => {
    const energy = spendEnergy(get().energy, Date.now(), GAME.modes.solo_mission.energyCost);
    if (!energy) return false;
    contract.pity = get().pity;
    set({ energy, contract, result: null, streak: touchStreak(get().streak) });
    get().setPanel(null);
    return true;
  },

  endContract: (outcome) => {
    const s = get();
    const c = s.contract;
    if (!c) return null;
    const res = finishContract(c, outcome, s.streak.days);
    const season = { ...s.season, shards: { ...s.season.shards }, keys: [...s.season.keys] };
    season.points += res.seasonPoints;
    const newKey: KeyId | null = addShards(season, c.mapId as MapId, res.shards);
    set({
      contract: null,
      result: res,
      parts: [...s.parts, ...res.keptLoot],
      pity: { ...c.pity },
      season,
      contractsDone: s.contractsDone + 1,
    });
    get().setPanel("result");
    if (newKey) useGame.getState().showToast(`Ghép được Chìa ${newKey === "copper" ? "Đồng" : newKey === "jade" ? "Ngọc Bích" : "Pha Lê"}!`);
    return res;
  },

  notifyDrop: (part) => {
    set({ lastDrop: { part, at: performance.now() / 1000 } });
    if (rarityIndex(part.rarity) >= rarityIndex(GAME.dropTable.serverAnnounceMinRarity as "legendary")) {
      useGame.getState().showToast(`Đồ ${RARITY_LABEL[part.rarity]}: ${part.name}!`);
    }
  },

  equipMech: (equipped) => set({ equipped }),

  assemble: (ids) => {
    const s = get();
    const parts = Object.fromEntries(MECH_SLOTS.map((slot) => [slot, s.parts.find((p) => p.id === ids[slot])])) as Partial<
      Record<MechSlot, MechPart>
    >;
    const mech = assembleMech(parts);
    if (!mech) return "Cần đủ 4 linh kiện đúng khe";
    const used = new Set(Object.values(ids));
    set({ mechs: [...s.mechs, mech], parts: s.parts.filter((p) => !used.has(p.id)), equipped: s.equipped ?? mech.id });
    return null;
  },

  dismantle: (mechId) => {
    const s = get();
    const mech = s.mechs.find((m) => m.id === mechId);
    if (!mech) return;
    // Tháo Mech trả lại linh kiện nhưng mất độ bền đã hao (linh kiện không lưu độ bền riêng)
    set({
      mechs: s.mechs.filter((m) => m.id !== mechId),
      parts: [...s.parts, ...MECH_SLOTS.map((slot) => mech.parts[slot])],
      equipped: s.equipped === mechId ? (s.mechs.find((m) => m.id !== mechId)?.id ?? null) : s.equipped,
    });
  },

  repair: (mechId) => {
    const s = get();
    const mech = s.mechs.find((m) => m.id === mechId);
    if (!mech) return "full";
    const max = maxDurability(mechRarity(mech.parts));
    if (mech.durability >= max) return "full";
    const cost = Math.ceil(repairCost(mech));
    const g = useGame.getState();
    if (g.cred < cost) return "poor";
    useGame.setState({ cred: g.cred - cost });
    set({ mechs: s.mechs.map((m) => (m.id === mechId ? { ...m, durability: max } : m)) });
    return "ok";
  },

  craftParts: (ids) => {
    const s = get();
    const inputs = ids.map((id) => s.parts.find((p) => p.id === id)).filter(Boolean) as MechPart[];
    const res = craft(createRng(Date.now()), inputs);
    if (!res.ok) return res.reason;
    const g = useGame.getState();
    if (g.cred < res.cost) return `Cần ${res.cost} $CRED`;
    useGame.setState({ cred: g.cred - res.cost });
    const rest = s.parts.filter((p) => !ids.includes(p.id));
    if (res.success) {
      set({ parts: [...rest, res.result] });
      get().notifyDrop(res.result);
      return `Ghép thành công: ${res.result.name} (${RARITY_LABEL[res.result.rarity]})`;
    }
    set({ parts: [...rest, ...res.kept] });
    return `Ghép thất bại, giữ lại ${res.kept.length} linh kiện`;
  },

  smeltMech: (mechId) => {
    const s = get();
    const mech = s.mechs.find((m) => m.id === mechId);
    if (!mech) return "Không tìm thấy Mech";
    if (mech.durability > 0) return "Chỉ nung chảy được Mech đã hết độ bền";
    const out = smelt(createRng(Date.now()), MECH_SLOTS.map((slot) => mech.parts[slot]));
    set({
      mechs: s.mechs.filter((m) => m.id !== mechId),
      parts: [...s.parts, ...out],
      equipped: s.equipped === mechId ? null : s.equipped,
    });
    return `Nung chảy được ${out.length} linh kiện`;
  },

  useMechDurability: () => {
    const s = get();
    set({
      mechs: s.mechs.map((m) =>
        m.id === s.equipped ? { ...m, durability: Math.max(0, m.durability - GAME.transform.durabilityCostPerUse) } : m,
      ),
    });
  },

  touch: () => set({ energy: currentEnergy(get().energy, Date.now()) }),
}));

export const equippedPower = () => {
  const m = useHunter.getState().equippedMech();
  return m ? mechPower(m.parts) : 0;
};

useHunter.subscribe((s, prev) => {
  if (
    s.parts !== prev.parts ||
    s.mechs !== prev.mechs ||
    s.equipped !== prev.equipped ||
    s.energy !== prev.energy ||
    s.pity !== prev.pity ||
    s.season !== prev.season ||
    s.streak !== prev.streak ||
    s.contractsDone !== prev.contractsDone
  ) {
    writeSave({
      parts: s.parts,
      mechs: s.mechs,
      equipped: s.equipped,
      energy: s.energy,
      pity: s.pity,
      season: s.season,
      streak: s.streak,
      contractsDone: s.contractsDone,
    });
  }
});
