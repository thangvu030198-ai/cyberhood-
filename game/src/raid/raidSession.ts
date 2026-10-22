// Cổng Sinh Vật Cổ Đại – sảnh và vòng đời trận (GDD 4J): Bảng Tuyển quân (lập phòng, người thật xin vào),
// Tìm đội (ghép tự động), Thuê NPC Thợ Săn Quái (70–85% sức mạnh), Lò rèn Thần binh. Vào trận cần 1 Ấn Triệu Hồi
// (trưởng nhóm trả). Thưởng: nguyên liệu cổ đại, Rương tuần (1 lần/tuần/sinh vật), CRED, Điểm Hunter 60–150,
// Cúp hạ đầu tiên + tượng ở Hub, thú cưng hiếm. Bỏ ngang giữa trận → khoá cổng 30 phút (lặp lại tăng dần).
//
// Bản chơi đơn: "người thật" khác trong phòng là đồng đội mô phỏng mang tên người chơi (sức mạnh 95–110%).

import { create } from "zustand";
import { RAID, ROLES, RaidSim, teamCheck, type CreatureId, type Difficulty, type MaterialId, type Role, type TeamSlot } from "./raidSim";
import { useGame } from "../game/store";
import { handles } from "../game/refs";
import { RAID_GATE, RAID_ORIGIN } from "../game/config";
import { useMissions, trackMission } from "../game/missionStore";
import { useGear } from "../game/gearStore";
import { GEAR, rollGear, type GearId } from "../level/gear";
import { createRng } from "../sim/rng";

export type RaidTab = "recruit" | "find" | "hire" | "forge";
export const MATERIALS: Record<MaterialId, { name: string; icon: string; color: string }> = {
  lev_scale: { name: "Vảy Leviathan", icon: "◆", color: "#36e7ff" },
  lev_horn: { name: "Sừng Sấm", icon: "▲", color: "#ffd166" },
  lev_core: { name: "Lõi Tim Điện", icon: "●", color: "#ff4fd8" },
  lev_soul: { name: "Linh Hồn Biển Sâu", icon: "✦", color: "#c38bff" },
};

/** Thần binh chế từ nguyên liệu Leviathan */
export const DIVINE: { id: GearId; cost: Partial<Record<MaterialId, number>>; cred: number }[] = [
  { id: "thunderspear", cost: { lev_scale: 12, lev_horn: 4, lev_core: 2, lev_soul: 1 }, cred: 2000 },
  { id: "levscale", cost: { lev_scale: 20, lev_core: 2 }, cred: 1500 },
  { id: "chip_levheart", cost: { lev_scale: 6, lev_core: 1, lev_soul: 1 }, cred: 1200 },
];

/** Phí thuê NPC Thợ Săn Quái. Bản mạng: Thường trả Coin, Ác mộng / Huyền thoại trả Coin + token (một nửa vào Quỹ Thưởng
 * Người Chơi, một nửa đốt). Bản chơi đơn quy hết ra CRED. */
export const HIRE_COST: Record<Difficulty, { cred: number; token: boolean }> = {
  normal: { cred: 120, token: false },
  nightmare: { cred: 300, token: true },
  legend: { cred: 550, token: true },
};

const NAMES = ["NeonFox", "KaitoX", "MiraX", "Blitz", "ZeroCool", "Akira77", "Lyra", "HexQueen", "DukeNova", "Sora", "Kenji_R", "Vesper", "Nova", "BlazeKid", "Quinn", "RyuGhost", "Tama", "Juno", "Viper99", "Max.K"];
/** Tên NPC Thợ Săn Quái: tên nước ngoài (không dùng tên tiếng Việt) */
const ELITE = ["Hunter Kael", "Hunter Rhea", "Hunter Orin", "Hunter Yuki", "Hunter Brann", "Hunter Sable", "Hunter Ivo", "Hunter Nyx", "Hunter Taka", "Hunter Vance", "Hunter Freya", "Hunter Dax"];

type Saved = {
  materials: Record<MaterialId, number>;
  weekly: Partial<Record<CreatureId, string>>;
  firstKill: Partial<Record<CreatureId, number>>;
  trophies: string[];
  title: string | null;
  pet: boolean;
  rep: number;
  lockUntil: number;
  leaves: number;
  gotStarterSeal: boolean;
  kills: number;
};
const KEY = "cyberhood.raid.v1";
const EMPTY: Saved = { materials: { lev_scale: 0, lev_horn: 0, lev_core: 0, lev_soul: 0 }, weekly: {}, firstKill: {}, trophies: [], title: null, pet: false, rep: 100, lockUntil: 0, leaves: 0, gotStarterSeal: false, kills: 0 };
function load(): Saved {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { ...EMPTY };
  }
}

/** Mã tuần (rương tuần reset thứ Hai) */
export function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day);
  return t.toISOString().slice(0, 10);
}

export type RaidResult = {
  won: boolean;
  rank: string;
  pts: number;
  share: number;
  time: number;
  cred: number;
  points: number;
  mats: Partial<Record<MaterialId, number>>;
  chest: GearId | null;
  chestNote: string;
  firstKill: boolean;
  pet: boolean;
  leader: boolean;
  mates: { name: string; kind: string; role: Role }[];
};

type RaidState = Saved & {
  lobby: boolean;
  tab: RaidTab;
  creature: CreatureId;
  diff: Difficulty;
  role: Role;
  /** Số chỗ muốn tuyển cho từng vai trò (không tính bạn) */
  want: Record<Role, number>;
  minPower: number;
  recruiting: boolean;
  recruitAt: number;
  team: TeamSlot[];
  leader: boolean;
  sim: RaidSim | null;
  result: RaidResult | null;
  rated: Record<string, 1 | -1>;
  setLobby: (v: boolean) => void;
  set: (p: Partial<RaidState>) => void;
  myPower: () => number;
  startRecruit: () => void;
  tickRecruit: () => void;
  findTeam: () => void;
  hire: (role: Role) => string | null;
  kick: (i: number) => void;
  canStart: () => string | null;
  start: () => string | null;
  leave: (abandon?: boolean) => void;
  settle: () => void;
  rate: (name: string, v: 1 | -1) => void;
  craft: (id: GearId) => string | null;
  persist: () => void;
};

export const toWorld = (x: number, z: number) => ({ x: RAID_ORIGIN.x + x, z: RAID_ORIGIN.z + z });

function teleport(x: number, y: number, z: number, yaw = 0) {
  const body = handles.player?.body;
  if (!body) return;
  body.setTranslation({ x, y, z }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
}

const rng = createRng(Date.now() & 0xffffff);
const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];

export const useRaid = create<RaidState>((set, get) => ({
  ...load(),
  lobby: false,
  tab: "recruit",
  creature: "leviathan",
  diff: "normal",
  role: "dps",
  want: { tank: 1, dps: 2, healer: 1, support: 1 },
  minPower: 0,
  recruiting: false,
  recruitAt: 0,
  team: [],
  leader: true,
  sim: null,
  result: null,
  rated: {},
  persist: () => {
    const s = get();
    const saved: Saved = { materials: s.materials, weekly: s.weekly, firstKill: s.firstKill, trophies: s.trophies, title: s.title, pet: s.pet, rep: s.rep, lockUntil: s.lockUntil, leaves: s.leaves, gotStarterSeal: s.gotStarterSeal, kills: s.kills };
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {
      /* bỏ qua */
    }
  },
  set: (p) => set(p),
  setLobby: (v) => {
    const s = get();
    // Lần đầu tới cổng: tặng 1 Ấn Triệu Hồi để thử
    if (v && !s.gotStarterSeal) {
      useGame.getState().addItem("summonSeal", 1);
      set({ gotStarterSeal: true });
      get().persist();
      useGame.getState().showToast("Nhận 1 Ấn Triệu Hồi (quà lần đầu)");
    }
    if (v) set({ team: [{ name: useGame.getState().profile?.handle ?? "Bạn", kind: "player", role: s.role, power: 1 }], recruiting: false, leader: true });
    set({ lobby: v });
  },
  /** Sức mạnh hiển thị: 1000 + độ hiếm đồ đang mặc + cấp cường hoá */
  myPower: () => {
    const g = useGear.getState();
    const W: Record<string, number> = { common: 40, rare: 90, epic: 180, legendary: 320, mythic: 520 };
    let p = 1000;
    for (const id of [g.weapon, g.armor, g.head, g.hands, g.feet, g.chip]) {
      if (!id || id === "buster" || id === "none") continue;
      const info = GEAR[id as GearId];
      if (info) p += W[info.rarity] + (g.enh[id as GearId] ?? 0) * 25;
    }
    return p;
  },
  startRecruit: () => {
    const s = get();
    set({ recruiting: true, recruitAt: performance.now(), leader: true, team: [{ ...s.team[0], role: s.role }] });
  },
  /** Người thật (mô phỏng) xin vào phòng từng người một theo các chỗ còn trống */
  tickRecruit: () => {
    const s = get();
    if (!s.recruiting) return;
    const filled = (r: Role) => s.team.filter((x) => x.kind !== "player" && x.role === r).length;
    const open = (Object.keys(s.want) as Role[]).filter((r) => filled(r) < s.want[r]);
    if (!open.length || s.team.length >= RAID.maxTeam) {
      set({ recruiting: false });
      return;
    }
    // Độ khó cao: người thật đến chậm hơn; yêu cầu sức mạnh cao làm ít người đủ chuẩn
    const rate = (s.diff === "normal" ? 0.45 : s.diff === "nightmare" ? 0.3 : 0.18) * (s.minPower > s.myPower() ? 0.5 : 1);
    if (rng() > rate) return;
    const role = pick(open);
    const my = s.myPower();
    const power = Math.max(s.minPower, Math.round(my * (0.85 + rng() * 0.4)));
    const used = new Set(s.team.map((x) => x.name));
    const name = pick(NAMES.filter((n) => !used.has(n)));
    set({ team: [...s.team, { name, kind: "human", role, power: power / my }] });
  },
  /** Tìm đội: vào một phòng có sẵn (bạn là thành viên, không phải trưởng nhóm, không tốn Ấn) */
  findTeam: () => {
    const s = get();
    const diff = s.diff;
    const n = 4 + Math.floor(rng() * 5);
    const team: TeamSlot[] = [{ name: useGame.getState().profile?.handle ?? "Bạn", kind: "player", role: s.role, power: 1 }];
    const roles: Role[] = ["tank", "healer", "dps", "support", "dps", "tank", "dps", "healer", "support"];
    const humans = Math.max(RAID.difficulty[diff].minHumans, Math.round(n * (0.4 + rng() * 0.4)));
    for (let i = 1; i < n; i++) {
      const used = new Set(team.map((x) => x.name));
      const human = i < humans;
      team.push({ name: human ? pick(NAMES.filter((x) => !used.has(x))) : pick(ELITE.filter((x) => !used.has(x))), kind: human ? "human" : "elite", role: roles[i - 1], power: human ? 0.95 + rng() * 0.15 : 0.7 + rng() * 0.15 });
    }
    set({ team, leader: false, recruiting: false });
  },
  hire: (role) => {
    const s = get();
    if (s.team.length >= RAID.maxTeam) return "Đội đã đủ 10 người";
    const D = RAID.difficulty[s.diff];
    if (s.team.filter((x) => x.kind === "elite").length >= D.maxNpc) return `${D.label}: tối đa ${D.maxNpc} NPC`;
    const C = HIRE_COST[s.diff];
    const g = useGame.getState();
    if (g.cred < C.cred) return "Không đủ CRED";
    g.addCred(-C.cred);
    const used = new Set(s.team.map((x) => x.name));
    const [lo, hi] = RAID.power.elite;
    set({ team: [...s.team, { name: pick(ELITE.filter((x) => !used.has(x))), kind: "elite", role, power: lo + rng() * (hi - lo) }] });
    return null;
  },
  kick: (i) => {
    const s = get();
    if (i <= 0 || !s.leader) return;
    set({ team: s.team.filter((_, k) => k !== i) });
  },
  canStart: () => {
    const s = get();
    if (Date.now() < s.lockUntil) return `Cổng bị khoá ${Math.ceil((s.lockUntil - Date.now()) / 60000)} phút (bỏ ngang trận trước)`;
    if (s.diff === "legend" && s.rep < 60) return "Uy tín dưới 60: chưa được vào phòng Huyền thoại";
    const err = teamCheck(s.team, s.diff);
    if (err) return err;
    if (s.leader && (useGame.getState().inventory.summonSeal ?? 0) < 1) return "Trưởng nhóm cần 1 Ấn Triệu Hồi";
    return null;
  },
  start: () => {
    const err = get().canStart();
    if (err) return err;
    const s = get();
    if (s.leader) useGame.getState().addItem("summonSeal", -1);
    const team = s.team.map((x, i) => (i === 0 ? { ...x, role: s.role } : x));
    const sim = new RaidSim(team, s.diff, (Date.now() & 0xffff) + 1);
    set({ sim, lobby: false, result: null, rated: {}, recruiting: false, team });
    useGame.getState().setLocation("raid");
    const c = toWorld(RAID.camp.x, RAID.camp.z);
    teleport(c.x, 1.5, c.z, Math.PI);
    handles.aimCamera?.(0);
    return null;
  },
  leave: (abandon = false) => {
    const s = get();
    if (abandon && s.sim && s.sim.phase !== "end") {
      // Bỏ ngang: khoá 30 phút, lần sau gấp đôi; trừ uy tín
      const mins = 30 * Math.pow(2, Math.min(3, s.leaves));
      set({ lockUntil: Date.now() + mins * 60000, leaves: s.leaves + 1, rep: Math.max(0, s.rep - 10) });
      useGame.getState().showToast(`Bỏ ngang trận: khoá Cổng Sinh Vật ${mins} phút`);
      get().persist();
    }
    set({ sim: null, result: null });
    useGame.getState().setLocation("city");
    teleport(RAID_GATE.x - 5, 1.3, RAID_GATE.z, -Math.PI / 2);
    handles.aimCamera?.(-Math.PI / 2);
  },
  settle: () => {
    const s = get();
    const sim = s.sim;
    if (!sim || s.result || sim.phase !== "end") return;
    const won = sim.winner === "team";
    const { pts, rank, share } = sim.score();
    const D = RAID.difficulty[s.diff];
    const r = createRng(Date.now() & 0xffffff);
    // Nguyên liệu: những gì rơi trong trận (bộ phận vỡ + hạ gục); trưởng nhóm +5% (làm tròn lên ít nhất 1 vảy)
    const mats: Partial<Record<MaterialId, number>> = {};
    for (const [k, v] of Object.entries(sim.materials) as [MaterialId, number][]) if (v > 0) mats[k] = v;
    if (won && s.leader) mats.lev_scale = (mats.lev_scale ?? 0) + Math.max(1, Math.round(((mats.lev_scale ?? 0) + (mats.lev_core ?? 0)) * 0.05));
    const materials = { ...s.materials };
    for (const [k, v] of Object.entries(mats) as [MaterialId, number][]) materials[k] += v;
    // Rương tuần: 1 lần/tuần/sinh vật
    let chest: GearId | null = null;
    let chestNote = "";
    const wk = weekId();
    const weekly = { ...s.weekly };
    if (won) {
      if (weekly[sim.creature] !== wk) {
        weekly[sim.creature] = wk;
        const roll = r();
        const rar = roll < D.mythic ? "mythic" : roll < D.mythic + D.legend ? "legendary" : "epic";
        chest = rollGear(r, 3, rar);
        useGear.getState().add([chest]);
        chestNote = `Rương tuần: ${GEAR[chest].name}`;
      } else chestNote = "Rương tuần đã nhận tuần này (vẫn nhận nguyên liệu)";
    }
    const cred = Math.round((won ? 900 : 250) * (1 + (D.hpMul - 1) * 0.6) * (rank === "S" ? 1.4 : rank === "A" ? 1.2 : 1));
    const points = won ? Math.round(60 + 90 * Math.min(1, pts / 400)) : 20;
    const g = useGame.getState();
    g.addCred(cred);
    useMissions.getState().gainPoints(points);
    trackMission("kill", 1);
    if (won) trackMission("clear");
    // Hạ đầu tiên (trên máy này = "toàn server" khi chơi offline): Cúp NFT + danh hiệu + tượng ở Hub
    let firstKill = false;
    const firstKills = { ...s.firstKill };
    const trophies = [...s.trophies];
    let title = s.title;
    if (won && !firstKills[sim.creature]) {
      firstKill = true;
      firstKills[sim.creature] = Date.now();
      trophies.push(`Cúp NFT · Kẻ Diệt Leviathan`);
      title = "Kẻ Diệt Leviathan";
    }
    // Thú cưng: tỉ lệ rất thấp
    const pet = won && !s.pet && r() < (s.diff === "legend" ? 0.06 : s.diff === "nightmare" ? 0.03 : 0.012);
    const mates = sim.members.filter((m) => m.kind === "human").map((m) => ({ name: m.name, kind: m.kind, role: m.role }));
    set({
      materials,
      weekly,
      firstKill: firstKills,
      trophies,
      title,
      pet: s.pet || pet,
      kills: s.kills + (won ? 1 : 0),
      result: { won, rank, pts, share, time: sim.time, cred, points, mats, chest, chestNote, firstKill, pet, leader: s.leader, mates },
    });
    get().persist();
  },
  rate: (name, v) => {
    const s = get();
    if (s.rated[name]) return;
    // Đồng đội mô phỏng cũng chấm lại bạn: đa số khen nếu bạn đóng góp tốt
    const back = s.result && s.result.pts > 60 ? 1 : rng() < 0.6 ? 1 : -1;
    set({ rated: { ...s.rated, [name]: v }, rep: Math.max(0, Math.min(200, s.rep + back)) });
    get().persist();
  },
  craft: (id) => {
    const s = get();
    const rec = DIVINE.find((d) => d.id === id);
    if (!rec) return "Không có công thức";
    for (const [k, v] of Object.entries(rec.cost) as [MaterialId, number][]) if (s.materials[k] < v) return `Thiếu ${MATERIALS[k].name}`;
    const g = useGame.getState();
    if (g.cred < rec.cred) return "Không đủ CRED";
    g.addCred(-rec.cred);
    const materials = { ...s.materials };
    for (const [k, v] of Object.entries(rec.cost) as [MaterialId, number][]) materials[k] -= v;
    useGear.getState().add([id]);
    set({ materials });
    get().persist();
    return null;
  },
}));

/** Đạn người chơi trong trận raid (gọi từ PlayerCombat), toạ độ thế giới */
export function raidShot(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number, damage: number): number | null {
  const sim = useRaid.getState().sim;
  if (!sim) return null;
  return sim.playerShot(ox - RAID_ORIGIN.x, oy, oz - RAID_ORIGIN.z, dx, dy, dz, range, damage);
}

export { ROLES };
