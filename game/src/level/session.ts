// Vào / ra màn đi ngang từ cổng nhiệm vụ ở Hub và trao thưởng.
// Có hợp đồng: mỗi checkpoint hoàn thành một nhiệm vụ (rơi đồ), hạ trùm là sự kiện + rút lui thành công.
// Hết năng lượng thì vẫn chơi được ở chế độ luyện tập, chỉ nhận CRED.

import { create } from "zustand";
import { addKill, completeEvent, completeMission } from "../sim/contract";
import { playSfx } from "../game/assets";
import { useHunter } from "../game/hunter";
import { questProgress } from "../game/quests";
import { handles } from "../game/refs";
import { useGame } from "../game/store";
import { MISSION_GATE } from "../game/config";
import { LEVELS, levelById } from "./registry";
import { PlatformerSim } from "./platformer";
import { keptOnQuit, type LootDrop } from "./loot";
import { addShards, type KeyId } from "../sim/season";
import { createRng } from "../sim/rng";
import { RARITY_LABEL } from "../sim/loot";
import { rarityIndex } from "../sim/config";
import { trackMission } from "../game/missionStore";
import { useGear } from "../game/gearStore";
import { GEAR } from "./gear";

/** Khoá lưu danh sách map đã qua (khai báo trước store vì store đọc ngay lúc khởi tạo) */
const CLEARED_KEY = "cyberhood.levels.cleared.v1";

/** Thưởng CRED: cơ bản khi qua màn + mỗi địch hạ */
export const LEVEL_REWARD = { clear: 60, perKill: 3 };

type LevelState = {
  sim: PlatformerSim | null;
  /** Có hợp đồng đang chạy khi vào màn (false = luyện tập) */
  contract: boolean;
  /** Đã trao thưởng qua màn chưa */
  rewarded: boolean;
  /** Đồ vừa nhặt gần đây, cho HUD hiện dòng thông báo */
  feed: { text: string; color: string; at: number }[];
  /** Map đang chơi */
  levelId: string;
  /** Map đã qua ít nhất một lần (mở khoá map sau) */
  cleared: string[];
  /** Đang mở bảng chọn map ở cổng */
  selecting: boolean;
  setSelecting: (on: boolean) => void;
  start: (levelId: string) => void;
  leave: () => void;
};

export const useLevel = create<LevelState>((set, get) => ({
  sim: null,
  contract: false,
  rewarded: false,
  feed: [],
  levelId: LEVELS[0].def.id,
  cleared: loadCleared(),
  selecting: false,
  setSelecting: (selecting) => {
    if (selecting) document.exitPointerLock?.();
    set({ selecting });
    useGame.setState({ panelOpen: selecting });
  },
  start: (levelId) => {
    const g = useGame.getState();
    const entry = levelById(levelId);
    const sim = new PlatformerSim(entry.def, {
      pity: useHunter.getState().pity,
      chestKeys: g.inventory.chestKey ?? 0,
      mapMultiplier: entry.mapMultiplier,
      weapon: useGear.getState().weapon,
      armor: useGear.getState().armor,
    });
    let lastCheckpoint = -1;
    const note = (text: string, color: string) =>
      set((st) => ({ feed: [...st.feed.filter((f) => sim.time - f.at < 4).slice(-4), { text, color, at: sim.time }] }));
    sim.onEvent = (kind, detail) => {
      if (kind === "loot" && detail?.drop) {
        const [text, color] = describe(detail.drop);
        note(text, color);
        const d = detail.drop;
        if (d.kind === "part" && rarityIndex(d.part.rarity) >= rarityIndex("epic")) trackMission("epic");
        if (d.kind === "part" && rarityIndex(d.part.rarity) >= rarityIndex("legendary")) trackMission("legendary");
        if (d.kind === "gear" && rarityIndex(GEAR[d.gear].rarity) >= rarityIndex("epic")) trackMission("epic");
      }
      if (kind === "kill") trackMission("kill");
      if (kind === "chest") {
        note("Mở rương!", "#ffd23d");
        trackMission("chest");
      }
      if (kind === "chestLocked") note("Rương bị khoá: cần Chìa rương (rơi từ địch)", "#ff8fb1");
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
    set({ sim, levelId, contract: !!useHunter.getState().contract, rewarded: false, feed: [] });
  },
  leave: () => {
    const { sim, rewarded } = get();
    const c = useHunter.getState().contract;
    // Bỏ dở giữa chừng: hợp đồng tính như thất bại
    if (sim && !rewarded) {
      // Bỏ dở: giữ chìa và CRED, mất 30% linh kiện từ Hiếm trở xuống
      grantLoot(keptOnQuit(sim.collected, createRng(Date.now() & 0xffff)), sim.chestKeys);
      if (c) {
        useHunter.getState().endContract("dead");
        useGame.getState().showToast("Bỏ dở nhiệm vụ: hợp đồng thất bại, mất 30% đồ thường/hiếm đã nhặt");
      }
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
  trackMission("clear");
  trackMission("boss");
  grantLoot(sim.collected, sim.chestKeys);
  if (!st.cleared.includes(st.levelId)) {
    const cleared = [...st.cleared, st.levelId];
    saveCleared(cleared);
    useLevel.setState({ cleared });
    const next = LEVELS.find((_, i) => i > 0 && LEVELS[i - 1].def.id === st.levelId);
    if (next) g.showToast(`Mở khoá map mới: ${next.def.name}`);
  }
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

/** Qua cổng: mở bảng chọn map */
export function enterLevel() {
  const g = useGame.getState();
  if (g.mode !== "foot" || g.flatlinedAt !== null) return;
  useLevel.getState().setSelecting(true);
}

/** Chọn map ở bảng: mở hợp đồng nếu còn năng lượng, rồi chuyển sang màn */
export function playLevel(levelId: string) {
  const g = useGame.getState();
  useLevel.getState().setSelecting(false);
  document.exitPointerLock?.();
  const go = () => {
    useLevel.getState().start(levelId);
    g.setLocation("level");
  };
  if (useHunter.getState().contract) return go();
  // Nạp muộn: contracts kéo theo Enemies, nạp tĩnh ở đây sẽ tạo vòng import
  void import("../game/contracts").then(({ startNewContract }) => {
    const err = startNewContract();
    if (err) g.showToast(`${err}. Vào màn luyện tập (chỉ nhận CRED)`);
    go();
  });
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

/** Cất đồ nhặt trong màn vào tài khoản: linh kiện vào kho, CRED, mảnh Chìa mùa, số Chìa rương còn lại */
function grantLoot(drops: LootDrop[], chestKeysLeft: number) {
  const g = useGame.getState();
  const h = useHunter.getState();
  const parts = drops.flatMap((d) => (d.kind === "part" ? [d.part] : []));
  const cred = drops.reduce((n, d) => n + (d.kind === "cred" ? d.amount : 0), 0);
  const shards = drops.filter((d) => d.kind === "keyShard").length;
  if (cred) g.addCred(cred);
  useGear.getState().add(drops.flatMap((d) => (d.kind === "gear" ? [d.gear] : [])));
  useGame.setState((s) => ({ inventory: { ...s.inventory, chestKey: chestKeysLeft } }));
  const season = { ...h.season, shards: { ...h.season.shards }, keys: [...h.season.keys] };
  const entry = levelById(useLevel.getState().levelId);
  const newKey: KeyId | null = shards ? addShards(season, entry.mapId, shards) : null;
  useHunter.setState({ parts: [...h.parts, ...parts], season, pity: { ...h.pity } });
  if (newKey) g.showToast(`Ghép được ${newKey === "copper" ? "Chìa Đồng" : newKey === "jade" ? "Chìa Ngọc Bích" : "Chìa Pha Lê"}!`);
}

function describe(d: LootDrop): [string, string] {
  if (d.kind === "part") return [`${d.part.name} · ${RARITY_LABEL[d.part.rarity]}`, RARITY_HEX[d.part.rarity]];
  if (d.kind === "cred") return [`+${d.amount} CRED`, "#ffd23d"];
  if (d.kind === "chestKey") return ["+1 Chìa rương", "#7dffb0"];
  if (d.kind === "gear") return [`${GEAR[d.gear].name} · ${RARITY_LABEL[GEAR[d.gear].rarity]} (vào Túi đồ)`, RARITY_HEX[GEAR[d.gear].rarity]];
  if (d.kind === "keyShard") return [`+1 Mảnh ${levelById(useLevel.getState().levelId).keyLabel}`, "#e0a060"];
  return ["Hồi máu", "#7dff9a"];
}

export const RARITY_HEX = { common: "#c9d0d8", rare: "#5ab4ff", epic: "#c27dff", legendary: "#ffc23d", mythic: "#ff4a64" } as const;


function loadCleared(): string[] {
  try {
    const raw = localStorage.getItem(CLEARED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveCleared(list: string[]) {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(list));
  } catch {
    // bộ nhớ trình duyệt không dùng được: chỉ giữ trong phiên
  }
}
