// Cổng Sinh Vật Cổ Đại – raid đội 4–10 người (GDD mục 4J). Mô phỏng thuần TypeScript, bước cố định 20 Hz.
// Mùa 1 mở Leviathan Điện (Neon City ngập nước): rắn biển điện khổng lồ quấn quanh 3 cao ốc giữa phố ngập.
//
// Toạ độ cục bộ (mét): x ngang, z dọc, y cao. Mặt nước ở y = 0; 6 mái nhà thấp (cao 3,2 m, có dốc lên) là chỗ
// tránh phóng điện; 4 mái có cột thu lôi. Bãi tập kết của đội ở phía +z.
//
// Trận đấu 3 giai đoạn theo máu: Thức tỉnh (100→70%) → Cuồng hoả (70→30%, gọi lươn máy, nước điện dày hơn,
// cột thu lôi hồi lại) → Tuyệt vọng (<30%, mưa vòng đỏ, đòn "Hồng Thuỷ Sấm Sét"). Hết giờ: cuồng nộ (gần như diệt đội).
// Bộ phận phá được: 2 sừng, 3 mảng vảy lưng, lõi đuôi – mỗi cái rơi nguyên liệu cho cả đội và làm sinh vật yếu đi.
// Phá đủ 4 cột thu lôi → tê liệt 8 s. Thanh CHOÁNG đầy hoặc ≥ 3 người cùng biến hình Mech → ngã quỵ 10 s, lộ lõi tim
// (sát thương ×2,5).

import { createRng, type Rng } from "../sim/rng";

export type CreatureId = "leviathan" | "phantom" | "titan" | "icedragon";
export type Difficulty = "normal" | "nightmare" | "legend";
export type Role = "tank" | "dps" | "healer" | "support";
export type MemberKind = "player" | "human" | "elite";
export type RaidPhase = "awaken" | "frenzy" | "despair" | "end";
export type Skill = "grenade" | "missiles" | "orbital" | "role";
export type PartId = "hornL" | "hornR" | "scale1" | "scale2" | "scale3" | "tail";
export type MaterialId = "lev_scale" | "lev_horn" | "lev_core" | "lev_soul";

export const CREATURES: Record<CreatureId, { name: string; zone: string; shape: string; mechanic: string; open: boolean; season: string; color: string }> = {
  leviathan: { name: "Leviathan Điện", zone: "Neon City", shape: "Rắn biển điện khổng lồ quấn quanh các cao ốc ngập nước", mechanic: "Đứng trên mái nhà để tránh phóng điện · phá 4 cột thu lôi để làm nó tê liệt", open: true, season: "Mùa 1", color: "#36e7ff" },
  phantom: { name: "Bóng Ma Vạn Mặt", zone: "Hollow Hotel", shape: "Thực thể ma quái nhiều khuôn mặt, nuốt ánh sáng", mechanic: "Cả đội thắp 3 hải đăng neon cùng lúc mới lộ mặt thật", open: false, season: "Mở ở mùa sau", color: "#c38bff" },
  titan: { name: "Titan Cát", zone: "Warzone", shape: "Khổng lồ bằng cát và xác tàu, cao bằng toà nhà 20 tầng", mechanic: "Leo lên lưng nó phá 3 lõi năng lượng · bão cát che tầm nhìn", open: false, season: "Mở ở mùa sau", color: "#ffb35a" },
  icedragon: { name: "Rồng Băng Cổ Đại", zone: "Thành Băng", shape: "Rồng băng cánh pha lê", mechanic: "Liên tục di chuyển · dùng lửa phá giáp vảy băng", open: false, season: "Mở ở mùa sau", color: "#9fe8ff" },
};

export const ROLES: Record<Role, { label: string; icon: string; hp: number; dmg: number; range: number; cd: number; color: string; hint: string }> = {
  tank: { label: "Vệ binh", icon: "🛡", hp: 950, dmg: 46, range: 14, cd: 0.6, color: "#ffb000", hint: "Giữ sinh vật quay lưng về phía đội" },
  dps: { label: "Xung kích", icon: "⚔", hp: 420, dmg: 84, range: 34, cd: 0.6, color: "#ff4f6a", hint: "Gây sát thương, phá bộ phận" },
  healer: { label: "Kỹ sư y tế", icon: "✚", hp: 400, dmg: 28, range: 28, cd: 0.6, color: "#5dff9a", hint: "Hồi máu, hồi sinh đồng đội" },
  support: { label: "Phá giáp", icon: "⚡", hp: 460, dmg: 56, range: 30, cd: 0.6, color: "#36e7ff", hint: "Phá cột thu lôi, điểm yếu, kích hoạt cơ chế" },
};

export const RAID = {
  step: 1 / 20,
  /** Máu gốc cho đội 4 người, độ khó Thường; máu = gốc × (1 + 0,35 × (số người − 4)) × hệ số độ khó */
  baseHp: 100000,
  perMember: 0.35,
  minTeam: 4,
  maxTeam: 10,
  difficulty: {
    normal: { label: "Thường", minHumans: 1, maxNpc: 9, hpMul: 1, dmgMul: 1, enrage: 12 * 60, legend: 0.1, mythic: 0.01, mats: 1 },
    nightmare: { label: "Ác mộng", minHumans: 2, maxNpc: 6, hpMul: 1.6, dmgMul: 1.4, enrage: 11 * 60, legend: 0.2, mythic: 0.02, mats: 1.6 },
    legend: { label: "Huyền thoại", minHumans: 4, maxNpc: 4, hpMul: 2.4, dmgMul: 1.85, enrage: 10 * 60, legend: 0.35, mythic: 0.04, mats: 2.4 },
  } as Record<Difficulty, { label: string; minHumans: number; maxNpc: number; hpMul: number; dmgMul: number; enrage: number; legend: number; mythic: number; mats: number }>,
  /** Sức mạnh: người thật 100%, NPC Thợ Săn Quái 70–85% (lính đánh thuê thường chỉ 55–65%) */
  power: { human: [0.95, 1.1] as [number, number], elite: [0.7, 0.85] as [number, number] },
  /** Khả năng né đòn báo trước (người thật / NPC tinh anh) */
  dodge: { human: 0.92, elite: 0.85 },
  arena: { half: 78 },
  camp: { x: 0, z: 66, r: 9 },
  towers: [
    { x: -24, z: -8, r: 7, h: 70 },
    { x: 22, z: -18, r: 7, h: 62 },
    { x: 2, z: 20, r: 6, h: 54 },
  ],
  /** Mái nhà thấp: tâm, nửa cạnh, cao; dốc lên ở phía `ramp` (hướng xoay rad) */
  roofs: [
    { x: -50, z: -40, half: 7, h: 3.2, rod: true },
    { x: 50, z: -44, half: 7, h: 3.2, rod: true },
    { x: -54, z: 26, half: 7, h: 3.2, rod: true },
    { x: 52, z: 28, half: 7, h: 3.2, rod: true },
    { x: 0, z: -58, half: 6, h: 3.2, rod: false },
    { x: -22, z: 46, half: 6, h: 3.2, rod: false },
    { x: 24, z: 48, half: 6, h: 3.2, rod: false },
    { x: -6, z: -36, half: 5, h: 3.2, rod: false },
    { x: 42, z: 6, half: 5, h: 3.2, rod: false },
    { x: -46, z: -4, half: 5, h: 3.2, rod: false },
    { x: 14, z: 38, half: 4.5, h: 3.2, rod: false },
  ],
  rodHp: 2600,
  rodRecharge: 40,
  paralyze: 8,
  down: 10,
  stagger: { max: 1, perDmg: 1 / 26000, decay: 0.006 },
  mechSync: 3,
  /** Bộ phận: phần trăm máu tối đa, hitbox (r), vị trí (đầu / đốt thân thứ i) */
  parts: {
    hornL: { label: "Sừng trái", pct: 0.05, at: "head", r: 2.4, mat: "lev_horn" },
    hornR: { label: "Sừng phải", pct: 0.05, at: "head", r: 2.4, mat: "lev_horn" },
    scale1: { label: "Vảy lưng I", pct: 0.045, at: 8, r: 3.2, mat: "lev_scale" },
    scale2: { label: "Vảy lưng II", pct: 0.045, at: 16, r: 3.2, mat: "lev_scale" },
    scale3: { label: "Vảy lưng III", pct: 0.045, at: 24, r: 3.2, mat: "lev_scale" },
    tail: { label: "Lõi đuôi", pct: 0.07, at: 35, r: 3.4, mat: "lev_core" },
  } as Record<PartId, { label: string; pct: number; at: "head" | number; r: number; mat: MaterialId }>,
  segments: 36,
  spacing: 3.3,
  /** Đòn đánh (sát thương gốc trước hệ số độ khó) */
  atk: {
    bite: { every: 7, warn: 1.1, len: 16, arc: 0.9, dmg: 130 },
    slam: { every: 9, warn: 1.3, r: 9, dmg: 90 },
    breath: { every: 11, warn: 1.4, len: 46, w: 4.5, dmg: 85 },
    discharge: { every: 26, warn: 4.6, dmg: 130 },
    rain: { every: 6, warn: 1.5, r: 5.5, n: 6, dmg: 80 },
    tsunami: { every: 24, warn: 4.2, dmg: 320 },
    eels: { every: 26, hp: 260, dmg: 10 },
  },
  player: { hp: 520, regen: 6, regenDelay: 5, respawn: 12, revive: 4 },
  /** Kỹ năng người chơi: Q lựu đạn, E chùm tên lửa, R pháo kích, F kỹ năng vai trò */
  skills: {
    grenade: { cd: 6, r: 6.5, dmg: 420, fuse: 0.9, key: "Q", label: "Lựu đạn plasma" },
    missiles: { cd: 12, n: 8, dmg: 260, delay: 0.7, key: "E", label: "Chùm tên lửa" },
    orbital: { cd: 30, r: 12, dmg: 2400, warn: 2, key: "R", label: "Pháo kích quỹ đạo" },
    role: { cd: 20, key: "F", label: "Kỹ năng vai trò" },
  } as Record<Skill, { cd: number; r?: number; dmg?: number; fuse?: number; n?: number; delay?: number; warn?: number; key: string; label: string }>,
  roleSkill: {
    tank: { label: "Khiêu khích", dur: 6, reduce: 0.5 },
    dps: { label: "Bùng nổ", dur: 8, mul: 1.6 },
    healer: { label: "Trường hồi máu", r: 16, pct: 0.35 },
    support: { label: "Xung EMP", r: 14, mul: 3, stagger: 0.15 },
  },
  /** Vai trò của người chơi ảnh hưởng chỉ số */
  playerRole: {
    tank: { hpMul: 2, taken: 0.6, dmgMul: 0.9 },
    dps: { hpMul: 1, taken: 1, dmgMul: 1.3 },
    healer: { hpMul: 1, taken: 1, dmgMul: 0.9, heal: 16 },
    support: { hpMul: 1.1, taken: 0.9, dmgMul: 1, rodMul: 1.8 },
  } as Record<Role, { hpMul: number; taken: number; dmgMul: number; heal?: number; rodMul?: number }>,
};

export type Member = {
  id: number;
  name: string;
  kind: MemberKind;
  role: Role;
  power: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  downAt: number;
  inMech: boolean;
  shootAt: number;
  hurtAt: number;
  /** Đang nhắm: -1 đầu, 0..5 bộ phận, 10+i cột thu lôi, 20+i lươn máy */
  aim: number;
  dmgDone: number;
  /** Điểm đến do AI chọn */
  gx: number;
  gz: number;
};

export type Part = { id: PartId; hp: number; maxHp: number; broken: boolean };
export type Rod = { i: number; x: number; z: number; y: number; hp: number; maxHp: number; alive: boolean; downAt: number };
export type Eel = { id: number; x: number; y: number; z: number; hp: number; alive: boolean; shootAt: number; t: number };
export type Warn = { kind: "bite" | "slam" | "breath" | "discharge" | "rain" | "tsunami" | "grenade" | "orbital"; x0: number; z0: number; x1: number; z1: number; r: number; warnAt: number; liveAt: number; dmg: number; done: boolean; byPlayer?: boolean; fromX?: number; fromZ?: number };
export type RaidEvent =
  | { kind: "tracer"; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; member: boolean; at: number }
  | { kind: "hit"; x: number; y: number; z: number; dmg: number; byPlayer: boolean; crit: boolean; at: number }
  | { kind: "boom"; x: number; y: number; z: number; big: boolean; at: number }
  | { kind: "heal"; x: number; z: number; amount: number; at: number; fx?: number; fz?: number }
  | { kind: "break"; part: PartId; at: number }
  | { kind: "material"; mat: MaterialId; n: number; at: number }
  | { kind: "callout"; text: string; color: string; at: number }
  | { kind: "playerHit"; dmg: number; at: number }
  | { kind: "zap"; at: number };

export type TeamSlot = { name: string; kind: MemberKind; role: Role; power: number };

export function creatureHp(team: number, diff: Difficulty) {
  return Math.round(RAID.baseHp * (1 + RAID.perMember * (team - 4)) * RAID.difficulty[diff].hpMul);
}

/** Kiểm tra đội hợp lệ: 4–10 người, đủ người thật tối thiểu, không quá số NPC tối đa của độ khó */
export function teamCheck(slots: TeamSlot[], diff: Difficulty): string | null {
  const D = RAID.difficulty[diff];
  const humans = slots.filter((s) => s.kind !== "elite").length;
  const npcs = slots.length - humans;
  if (slots.length < RAID.minTeam) return `Cần tối thiểu ${RAID.minTeam} thành viên`;
  if (slots.length > RAID.maxTeam) return `Tối đa ${RAID.maxTeam} thành viên`;
  if (humans < D.minHumans) return `${D.label} cần tối thiểu ${D.minHumans} người thật`;
  if (npcs > D.maxNpc) return `${D.label} chỉ cho tối đa ${D.maxNpc} NPC`;
  return null;
}

const ang = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class RaidSim {
  rng: Rng;
  diff: Difficulty;
  creature: CreatureId = "leviathan";
  time = 0;
  phase: RaidPhase = "awaken";
  winner: "team" | "creature" | null = null;
  maxHp: number;
  hp: number;
  members: Member[] = [];
  parts: Part[];
  rods: Rod[];
  eels: Eel[] = [];
  warns: Warn[] = [];
  events: RaidEvent[] = [];
  missiles: { id: number; tgt: number; x0: number; z0: number; at: number; hitAt: number }[] = [];
  /** Đầu rắn và vệt đường đi (thân bám theo vệt) */
  head = { x: 0, y: 8, z: -30, yaw: 0, pitch: 0, mode: "swim" as "swim" | "rear" | "lunge" | "paralyzed" | "down" | "dead", modeAt: 0, tx: 0, tz: 0 };
  trail: { x: number; y: number; z: number }[] = [];
  body: { x: number; y: number; z: number }[] = [];
  stagger = 0;
  downUntil = -9;
  paralyzeUntil = -9;
  enrageAt: number;
  enraged = false;
  nextAt: Record<string, number> = {};
  aggro = 0;
  /** Người chơi */
  player: Member;
  cds: Record<Skill, number> = { grenade: 0, missiles: 0, orbital: 0, role: 0 };
  tauntUntil = -9;
  burstUntil = -9;
  materials: Record<MaterialId, number> = { lev_scale: 0, lev_horn: 0, lev_core: 0, lev_soul: 0 };
  mechSyncAt = -99;
  swimT = 0;
  private eelId = 0;

  constructor(team: TeamSlot[], diff: Difficulty, seed = 7) {
    this.rng = createRng(seed);
    this.diff = diff;
    this.maxHp = creatureHp(team.length, diff);
    this.hp = this.maxHp;
    this.enrageAt = RAID.difficulty[diff].enrage;
    this.parts = (Object.keys(RAID.parts) as PartId[]).map((id) => ({ id, hp: RAID.parts[id].pct * this.maxHp, maxHp: RAID.parts[id].pct * this.maxHp, broken: false }));
    this.rods = RAID.roofs.flatMap((r, i) => (r.rod ? [{ i, x: r.x + (r.x > 0 ? -3 : 3), z: r.z + (r.z > 0 ? -3 : 3), y: r.h, hp: RAID.rodHp, maxHp: RAID.rodHp, alive: true, downAt: -99 }] : []));
    team.forEach((s, i) => {
      const role = ROLES[s.role];
      const P = s.kind === "player" ? RAID.playerRole[s.role] : null;
      const maxHp = s.kind === "player" ? RAID.player.hp * P!.hpMul : role.hp * (0.8 + s.power * 0.3);
      const a = (i / team.length) * Math.PI - Math.PI;
      const C = RAID.camp;
      this.members.push({ id: i, name: s.name, kind: s.kind, role: s.role, power: s.power, x: C.x + Math.cos(a) * 5, z: C.z + Math.sin(a) * 4, y: 0, vx: 0, vz: 0, yaw: Math.PI, hp: maxHp, maxHp, alive: true, downAt: -99, inMech: false, shootAt: this.rng() * 0.6, hurtAt: -9, aim: -1, dmgDone: 0, gx: C.x, gz: C.z });
    });
    this.player = this.members.find((m) => m.kind === "player") ?? this.members[0];
    for (const k of ["bite", "slam", "breath", "discharge", "rain", "tsunami", "eels"]) this.nextAt[k] = 6 + this.rng() * 6;
    this.nextAt.discharge = 22;
    // Vệt ban đầu: thân nằm vòng quanh cao ốc giữa
    for (let i = 0; i < 200; i++) {
      const a = i * 0.05;
      this.trail.push({ x: Math.cos(a) * 30, y: -2 + Math.sin(i * 0.1) * 2, z: -10 + Math.sin(a) * 26 });
    }
    this.layBody();
  }

  get dmgMul() {
    return RAID.difficulty[this.diff].dmgMul * (this.enraged ? 4 : 1);
  }
  alive() {
    return this.members.filter((m) => m.alive).length;
  }
  callout(text: string, color = "#36e7ff") {
    this.events.push({ kind: "callout", text, color, at: this.time });
  }

  /** Mái nhà chứa điểm (x, z), hoặc -1 nếu đứng dưới nước */
  roofAt(x: number, z: number) {
    return RAID.roofs.findIndex((r) => Math.abs(x - r.x) < r.half && Math.abs(z - r.z) < r.half);
  }
  inWater(m: Member) {
    return m.y < 1.2;
  }

  update(dt: number) {
    if (this.phase === "end") return;
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(RAID.step, left);
      this.step(h);
      left -= h;
    }
    if (this.events.length > 600) this.events.splice(0, this.events.length - 400);
  }

  private step(dt: number) {
    this.time += dt;
    const t = this.time;
    // Giai đoạn theo máu
    const f = this.hp / this.maxHp;
    const ph: RaidPhase = f > 0.7 ? "awaken" : f > 0.3 ? "frenzy" : "despair";
    if (ph !== this.phase) {
      this.phase = ph;
      if (ph === "frenzy") this.callout("CUỒNG HOẢ · Leviathan gọi lươn máy, nước điện dâng!", "#ff9a3c");
      if (ph === "despair") this.callout("TUYỆT VỌNG · đòn diện rộng chí mạng – nhìn vòng đỏ!", "#ff3d5a");
    }
    if (!this.enraged && t >= this.enrageAt) {
      this.enraged = true;
      this.callout("HẾT GIỜ · LEVIATHAN CUỒNG NỘ!", "#ff2244");
    }
    this.moveHead(dt);
    this.layBody();
    this.creatureAttacks();
    this.updateWarns();
    this.updateRods();
    this.updateEels(dt);
    this.updateMechSync();
    this.updateMembers(dt);
    this.updateMissiles();
    this.stagger = Math.max(0, this.stagger - RAID.stagger.decay * dt);
    // Hồi sinh người chơi
    const P = this.player;
    if (!P.alive && t - P.downAt > RAID.player.respawn) this.revive(P, true);
    if (P.alive && t - P.hurtAt > RAID.player.regenDelay) P.hp = Math.min(P.maxHp, P.hp + RAID.player.regen * dt);
    // Kết thúc
    if (this.hp <= 0) this.finish("team");
    else if (this.members.every((m) => !m.alive)) this.finish("creature");
  }

  private finish(w: "team" | "creature") {
    this.phase = "end";
    this.winner = w;
    this.head.mode = w === "team" ? "dead" : this.head.mode;
    if (w === "team") {
      const M = RAID.difficulty[this.diff].mats;
      this.gainMat("lev_scale", Math.round(4 * M));
      this.gainMat("lev_core", Math.max(1, Math.round(1 * M)));
      if (this.rng() < 0.35 * M) this.gainMat("lev_soul", 1);
      this.callout("LEVIATHAN ĐÃ GỤC!", "#ffd166");
    } else this.callout("TOÀN ĐỘI BỊ HẠ", "#ff3d5a");
  }

  gainMat(mat: MaterialId, n: number) {
    this.materials[mat] += n;
    this.events.push({ kind: "material", mat, n, at: this.time });
  }

  // -------------------------------------------------------------------------
  // Leviathan: đầu bơi lượn quanh cao ốc, ngóc lên nhắm, lao cắn; thân bám vệt

  private moveHead(dt: number) {
    const H = this.head;
    const t = this.time;
    if (this.phase === "end") {
      // Chết: đổ ập xuống nước
      H.y = Math.max(-6, H.y - dt * 3);
      return;
    }
    if (t < this.paralyzeUntil || t < this.downUntil) {
      H.mode = t < this.downUntil ? "down" : "paralyzed";
      H.y += (1.2 - H.y) * Math.min(1, dt * 3);
      return;
    }
    if (H.mode === "down" || H.mode === "paralyzed") {
      H.mode = "swim";
      H.modeAt = t;
    }
    let tx: number, ty: number, tz: number, sp: number;
    if (H.mode === "rear" || H.mode === "lunge") {
      tx = H.tx;
      tz = H.tz;
      ty = H.mode === "rear" ? 16 : 3;
      sp = H.mode === "rear" ? 9 : 34;
      if (H.mode === "rear") {
        // Ngóc lên tại chỗ, quay mặt về mục tiêu
        const d = Math.hypot(tx - H.x, tz - H.z);
        if (d > 22) {
          tx = H.x + ((tx - H.x) / d) * 2;
          tz = H.z + ((tz - H.z) / d) * 2;
        } else {
          tx = H.x;
          tz = H.z;
        }
      }
      if (t - H.modeAt > (H.mode === "rear" ? RAID.atk.bite.warn : 0.7)) {
        H.mode = H.mode === "rear" ? "lunge" : "swim";
        H.modeAt = t;
      }
    } else {
      // Bơi vòng số 8 quanh các cao ốc, ngụp lặn lên xuống
      this.swimT += dt * (this.phase === "awaken" ? 0.16 : 0.21);
      const s = this.swimT;
      tx = Math.sin(s) * 40;
      tz = -8 + Math.sin(s * 2) * 30;
      ty = 6 + Math.sin(s * 3.1) * 6;
      sp = 16;
    }
    const dx = tx - H.x;
    const dy = ty - H.y;
    const dz = tz - H.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const k = Math.min(1, (sp * dt) / d);
    H.x += dx * k;
    H.y += dy * k;
    H.z += dz * k;
    if (Math.hypot(dx, dz) > 0.3) H.yaw += ang(Math.atan2(dx, dz) - H.yaw) * Math.min(1, dt * 4);
    H.pitch = Math.atan2(dy, Math.hypot(dx, dz) || 1) * 0.6;
    const last = this.trail[0];
    if (!last || Math.hypot(H.x - last.x, H.y - last.y, H.z - last.z) > 0.6) {
      this.trail.unshift({ x: H.x, y: H.y, z: H.z });
      if (this.trail.length > 260) this.trail.pop();
    }
  }

  /** Đặt các đốt thân theo vệt, cách đều `spacing` */
  private layBody() {
    const out: { x: number; y: number; z: number }[] = [];
    let need = RAID.spacing;
    let prev = { x: this.head.x, y: this.head.y, z: this.head.z };
    for (const p of this.trail) {
      let seg = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
      while (seg >= need && out.length < RAID.segments) {
        const k = need / seg;
        prev = { x: prev.x + (p.x - prev.x) * k, y: prev.y + (p.y - prev.y) * k, z: prev.z + (p.z - prev.z) * k };
        out.push(prev);
        seg = Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z);
        need = RAID.spacing;
      }
      need -= seg;
      prev = p;
      if (out.length >= RAID.segments) break;
    }
    while (out.length < RAID.segments) out.push({ ...(out[out.length - 1] ?? prev) });
    // Khi sinh vật nằm gục, thân chìm dần cho đỡ chắn đường bắn
    if (this.head.mode === "down" || this.head.mode === "paralyzed") for (const p of out) p.y = Math.min(p.y, 0.8);
    this.body = out;
  }

  /** Vị trí hitbox của bộ phận */
  partPos(id: PartId) {
    const at = RAID.parts[id].at;
    const H = this.head;
    if (at === "head") {
      const side = id === "hornL" ? 1 : -1;
      return { x: H.x + Math.cos(H.yaw) * 2.2 * side, y: H.y + 3, z: H.z - Math.sin(H.yaw) * 2.2 * side };
    }
    const b = this.body[at];
    return { x: b.x, y: b.y + 2.2, z: b.z };
  }

  /** Lõi tim lộ ra khi ngã quỵ / tê liệt: ngay sau đầu */
  heartPos() {
    const b = this.body[2];
    return { x: b.x, y: b.y + 1.6, z: b.z };
  }
  exposed() {
    return this.head.mode === "down" || this.head.mode === "paralyzed";
  }

  // -------------------------------------------------------------------------
  // Đòn đánh

  private pickTarget(): Member | null {
    const alive = this.members.filter((m) => m.alive);
    if (!alive.length) return null;
    // Khiêu khích của người chơi Vệ binh, rồi Vệ binh NPC được ưu tiên ×4
    if (this.time < this.tauntUntil && this.player.alive) return this.player;
    const w = alive.map((m) => (m.role === "tank" ? 4 : 1));
    let r = this.rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < alive.length; i++) if ((r -= w[i]) <= 0) return alive[i];
    return alive[0];
  }

  private warn(kind: Warn["kind"], x0: number, z0: number, x1: number, z1: number, r: number, warn: number, dmg: number, byPlayer = false) {
    const w: Warn = { kind, x0, z0, x1, z1, r, warnAt: this.time, liveAt: this.time + warn, dmg: byPlayer ? dmg : dmg * this.dmgMul, done: false, byPlayer };
    this.warns.push(w);
    return w;
  }

  private creatureAttacks() {
    const t = this.time;
    const H = this.head;
    if (this.phase === "end" || H.mode === "down" || H.mode === "paralyzed") return;
    const A = RAID.atk;
    const N = this.nextAt;
    const broken = (id: PartId) => this.parts.find((p) => p.id === id)!.broken;
    const fast = this.phase === "awaken" ? 1 : this.phase === "frenzy" ? 0.8 : 0.65;
    if (t >= N.bite && H.mode === "swim") {
      const tg = this.pickTarget();
      if (tg) {
        N.bite = t + A.bite.every * fast;
        H.mode = "rear";
        H.modeAt = t;
        H.tx = tg.x;
        H.tz = tg.z;
        // Cắn: hình quạt dài từ chỗ đầu ngóc lên tới mục tiêu
        const yaw = Math.atan2(tg.x - H.x, tg.z - H.z);
        const len = Math.min(A.bite.len + Math.hypot(tg.x - H.x, tg.z - H.z), 40);
        this.warn("bite", H.x, H.z, H.x + Math.sin(yaw) * len, H.z + Math.cos(yaw) * len, A.bite.arc, A.bite.warn, A.bite.dmg * (broken("hornL") && broken("hornR") ? 0.7 : 1));
      }
    }
    if (t >= N.slam) {
      N.slam = t + A.slam.every * fast;
      // Quất đuôi: vòng đỏ dưới chỗ đuôi + chỗ một thành viên gần đuôi
      const tail = this.body[RAID.segments - 1];
      const near = this.members.filter((m) => m.alive).sort((a, b) => Math.hypot(a.x - tail.x, a.z - tail.z) - Math.hypot(b.x - tail.x, b.z - tail.z))[0];
      const dmg = A.slam.dmg * (broken("tail") ? 0.6 : 1);
      this.warn("slam", tail.x, tail.z, tail.x, tail.z, A.slam.r, A.slam.warn, dmg);
      if (near && Math.hypot(near.x - tail.x, near.z - tail.z) < 30) this.warn("slam", near.x, near.z, near.x, near.z, A.slam.r * 0.8, A.slam.warn + 0.3, dmg);
    }
    if (t >= N.breath && H.mode === "swim") {
      const tg = this.pickTarget();
      if (tg) {
        N.breath = t + A.breath.every * fast;
        const yaw = Math.atan2(tg.x - H.x, tg.z - H.z);
        const horns = (broken("hornL") ? 1 : 0) + (broken("hornR") ? 1 : 0);
        this.warn("breath", H.x, H.z, H.x + Math.sin(yaw) * A.breath.len, H.z + Math.cos(yaw) * A.breath.len, A.breath.w, A.breath.warn, A.breath.dmg * (1 - horns * 0.2));
      }
    }
    if (t >= N.discharge) {
      // Phóng điện cả mặt nước: ai đứng dưới nước khi bùng lên đều trúng. Cuồng hoả: dày hơn
      N.discharge = t + A.discharge.every * (this.phase === "awaken" ? 1 : 0.8);
      this.warn("discharge", 0, 0, 0, 0, 999, A.discharge.warn, A.discharge.dmg);
      this.callout("PHÓNG ĐIỆN MẶT NƯỚC · LÊN MÁI NHÀ!", "#36e7ff");
    }
    if (this.phase !== "awaken" && t >= N.eels) {
      N.eels = t + A.eels.every;
      const n = 2 + Math.floor(this.members.length / 3);
      for (let i = 0; i < n; i++) {
        const a = this.rng() * Math.PI * 2;
        this.eels.push({ id: this.eelId++, x: H.x + Math.cos(a) * 6, y: 4, z: H.z + Math.sin(a) * 6, hp: A.eels.hp * RAID.difficulty[this.diff].hpMul, alive: true, shootAt: t + 1 + this.rng(), t: this.rng() * 10 });
      }
      this.callout("Lươn máy trồi lên!", "#ff9a3c");
    }
    if (this.phase === "despair") {
      if (t >= N.rain) {
        N.rain = t + A.rain.every;
        for (let i = 0; i < A.rain.n; i++) {
          const m = this.members.filter((x) => x.alive)[Math.floor(this.rng() * this.alive())];
          const x = m ? m.x + (this.rng() - 0.5) * 8 : (this.rng() - 0.5) * 100;
          const z = m ? m.z + (this.rng() - 0.5) * 8 : (this.rng() - 0.5) * 100;
          this.warn("rain", x, z, x, z, A.rain.r, A.rain.warn + i * 0.15, A.rain.dmg);
        }
      }
      if (t >= N.tsunami) {
        N.tsunami = t + A.tsunami.every;
        // Hồng Thuỷ Sấm Sét: chỉ đứng trên mái có cột thu lôi CÒN ĐỨNG mới an toàn (cột hút sét)
        this.warn("tsunami", 0, 0, 0, 0, 999, A.tsunami.warn, A.tsunami.dmg);
        this.callout("HỒNG THUỶ SẤM SÉT · đứng trên mái có cột thu lôi!", "#ff3d5a");
      }
    }
  }

  inWarn(w: Warn, x: number, z: number, m?: Member) {
    if (w.kind === "discharge") return !m || this.inWater(m);
    if (w.kind === "tsunami") {
      if (!m) return true;
      const r = this.roofAt(m.x, m.z);
      return !(r >= 0 && m.y > 1.2 && this.rods.some((d) => d.i === r && d.alive));
    }
    if (w.kind === "breath") {
      const vx = w.x1 - w.x0;
      const vz = w.z1 - w.z0;
      const L = Math.hypot(vx, vz) || 1;
      const u = ((x - w.x0) * vx + (z - w.z0) * vz) / (L * L);
      if (u < 0 || u > 1) return false;
      return Math.hypot(w.x0 + vx * u - x, w.z0 + vz * u - z) < w.r;
    }
    if (w.kind === "bite") {
      const vx = w.x1 - w.x0;
      const vz = w.z1 - w.z0;
      const L = Math.hypot(vx, vz) || 1;
      const d = Math.hypot(x - w.x0, z - w.z0);
      if (d > L) return false;
      return Math.abs(ang(Math.atan2(x - w.x0, z - w.z0) - Math.atan2(vx, vz))) < w.r / 2;
    }
    return Math.hypot(x - w.x0, z - w.z0) < w.r;
  }

  private updateWarns() {
    const t = this.time;
    for (const w of this.warns) {
      if (w.done || t < w.liveAt) continue;
      w.done = true;
      if (w.byPlayer) {
        // Kỹ năng của người chơi: trúng đầu / bộ phận / cột / lươn trong vùng
        const H = this.head;
        if (Math.hypot(H.x - w.x0, H.z - w.z0) < w.r + 4) this.damage(w.dmg, "player", -1, true);
        else if (this.body.some((b) => Math.hypot(b.x - w.x0, b.z - w.z0) < w.r + 2.5)) this.damage(w.dmg * 0.8, "player", -2, true);
        for (const e of this.eels) if (e.alive && Math.hypot(e.x - w.x0, e.z - w.z0) < w.r) this.hitEel(e, w.dmg, true);
        this.events.push({ kind: "boom", x: w.x0, y: 0.5, z: w.z0, big: w.kind === "orbital", at: t });
        continue;
      }
      if (w.kind === "discharge" || w.kind === "tsunami") this.events.push({ kind: "zap", at: t });
      else this.events.push({ kind: "boom", x: w.kind === "breath" ? (w.x0 + w.x1) / 2 : w.x0, y: 0.5, z: w.kind === "breath" ? (w.z0 + w.z1) / 2 : w.z0, big: w.kind === "slam", at: t });
      for (const m of this.members) if (m.alive && this.inWarn(w, m.x, m.z, m)) this.hurt(m, w.dmg);
    }
    this.warns = this.warns.filter((w) => !w.done || t - w.liveAt < 1.2);
  }

  hurt(m: Member, dmg: number) {
    if (!m.alive) return;
    let k = 1;
    if (m.kind === "player") {
      k *= RAID.playerRole[m.role].taken;
      if (this.time < this.tauntUntil) k *= 1 - RAID.roleSkill.tank.reduce;
    } else if (m.role === "tank") k *= 0.6;
    if (m.inMech) k *= 0.35;
    m.hp -= dmg * k;
    m.hurtAt = this.time;
    if (m.kind === "player") this.events.push({ kind: "playerHit", dmg: dmg * k, at: this.time });
    if (m.hp <= 0) {
      m.hp = 0;
      m.alive = false;
      m.inMech = false;
      m.downAt = this.time;
      if (m.kind !== "player") this.callout(`${m.name} gục ngã`, "#ff8a8a");
    }
  }

  revive(m: Member, atCamp = false) {
    m.alive = true;
    m.hp = m.maxHp * (atCamp ? 1 : 0.5);
    if (atCamp) {
      m.x = RAID.camp.x + (this.rng() - 0.5) * 6;
      m.z = RAID.camp.z;
    }
  }

  private updateRods() {
    const t = this.time;
    // Cột hồi lại (từ Cuồng hoả) sau một lúc kể từ khi sinh vật hết tê liệt
    if (this.phase !== "awaken" && this.rods.every((r) => !r.alive) && t > this.paralyzeUntil + RAID.rodRecharge) {
      for (const r of this.rods) {
        r.alive = true;
        r.hp = r.maxHp;
      }
      this.callout("Cột thu lôi đã nạp lại", "#36e7ff");
    }
  }

  hitRod(r: Rod, dmg: number, byPlayer: boolean) {
    if (!r.alive) return;
    r.hp -= dmg;
    this.events.push({ kind: "hit", x: r.x, y: r.y + 4, z: r.z, dmg: Math.round(dmg), byPlayer, crit: false, at: this.time });
    if (r.hp > 0) return;
    r.alive = false;
    r.downAt = this.time;
    this.events.push({ kind: "boom", x: r.x, y: r.y + 3, z: r.z, big: true, at: this.time });
    const left = this.rods.filter((x) => x.alive).length;
    if (left > 0) this.callout(`Cột thu lôi gãy · còn ${left}`, "#36e7ff");
    else {
      this.paralyzeUntil = this.time + RAID.paralyze;
      this.stagger = Math.min(1, this.stagger + 0.25);
      this.callout("LEVIATHAN TÊ LIỆT · DỒN SÁT THƯƠNG VÀO LÕI TIM!", "#ffd166");
    }
  }

  private updateEels(dt: number) {
    for (const e of this.eels) {
      if (!e.alive) continue;
      e.t += dt;
      // Lượn quanh đội, bắn tia điện
      const tg = this.members.find((m) => m.alive) ?? this.player;
      const a = e.t * 0.8 + e.id;
      const gx = tg.x + Math.cos(a) * 12;
      const gz = tg.z + Math.sin(a) * 12;
      e.x += (gx - e.x) * Math.min(1, dt * 0.8);
      e.z += (gz - e.z) * Math.min(1, dt * 0.8);
      e.y = 4 + Math.sin(e.t * 2) * 1.2;
      if (this.time >= e.shootAt) {
        e.shootAt = this.time + 1.6 + this.rng();
        const v = this.members.filter((m) => m.alive)[Math.floor(this.rng() * this.alive())];
        if (v) {
          this.events.push({ kind: "tracer", x0: e.x, y0: e.y, z0: e.z, x1: v.x, y1: v.y + 1.2, z1: v.z, member: false, at: this.time });
          if (this.rng() > (v.kind === "player" ? 0.3 : 0.45)) this.hurt(v, RAID.atk.eels.dmg * this.dmgMul);
        }
      }
    }
    this.eels = this.eels.filter((e) => e.alive || false);
  }

  hitEel(e: Eel, dmg: number, byPlayer: boolean) {
    if (!e.alive) return;
    e.hp -= dmg;
    this.events.push({ kind: "hit", x: e.x, y: e.y + 0.5, z: e.z, dmg: Math.round(dmg), byPlayer, crit: false, at: this.time });
    if (e.hp <= 0) {
      e.alive = false;
      this.events.push({ kind: "boom", x: e.x, y: e.y, z: e.z, big: false, at: this.time });
    }
  }

  /**
   * Gây sát thương lên sinh vật. `where`: -1 đầu (gần sừng thì vào sừng), 0..5 bộ phận, -2 thân, -3 lõi tim.
   * Bộ phận nhận sát thương riêng và vẫn trừ vào máu chung.
   */
  damage(dmg: number, by: "player" | Member, where: number, crit = false) {
    if (this.phase === "end") return;
    const byPlayer = by === "player";
    let k = 1;
    if (where === -3 || (this.exposed() && where === -1)) k *= 2.5;
    if (byPlayer) {
      k *= RAID.playerRole[this.player.role].dmgMul;
      if (this.time < this.burstUntil) k *= RAID.roleSkill.dps.mul;
      if (this.player.inMech) k *= 1.6;
    }
    const d = dmg * k;
    this.hp = Math.max(0, this.hp - d);
    this.stagger = Math.min(RAID.stagger.max, this.stagger + d * RAID.stagger.perDmg * (this.phase === "despair" ? 1.6 : 1));
    if (!byPlayer) by.dmgDone += d;
    else this.player.dmgDone += d;
    let pos = { x: this.head.x, y: this.head.y + 2, z: this.head.z };
    if (where >= 0) {
      const p = this.parts[where];
      pos = this.partPos(p.id);
      if (!p.broken) {
        p.hp -= d;
        if (p.hp <= 0) {
          p.broken = true;
          this.events.push({ kind: "break", part: p.id, at: this.time });
          this.events.push({ kind: "boom", ...pos, big: true, at: this.time });
          this.callout(`PHÁ ${RAID.parts[p.id].label.toUpperCase()}!`, "#ffd166");
          this.gainMat(RAID.parts[p.id].mat, 1);
        }
      }
    } else if (where === -3) pos = this.heartPos();
    else if (where === -2) {
      const b = this.body[10];
      pos = { x: b.x, y: b.y + 2, z: b.z };
    }
    if (byPlayer || this.rng() < 0.25) this.events.push({ kind: "hit", ...pos, dmg: Math.round(d), byPlayer, crit: crit || k > 2, at: this.time });
    // Thanh choáng đầy → ngã quỵ
    if (this.stagger >= RAID.stagger.max && this.time >= this.downUntil) this.knockDown("CHOÁNG");
  }

  knockDown(why: string) {
    this.downUntil = this.time + RAID.down;
    this.stagger = 0;
    this.callout(`${why} · LEVIATHAN NGÃ QUỴ 10 GIÂY · LỘ LÕI TIM!`, "#ffd166");
  }

  private updateMechSync() {
    const n = this.members.filter((m) => m.alive && m.inMech).length;
    if (n >= RAID.mechSync && this.time >= this.downUntil && this.time - this.mechSyncAt > 20) {
      this.mechSyncAt = this.time;
      this.knockDown(`ĐỒNG BỘ ${n} MECH`);
    }
  }

  // -------------------------------------------------------------------------
  // Tia bắn của người chơi (toạ độ cục bộ): trúng lươn → cột → bộ phận → lõi tim → đầu → thân

  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number) {
    let best: { t: number; kind: "eel" | "rod" | "part" | "heart" | "head" | "body"; idx: number } | null = null;
    const test = (x: number, y: number, z: number, r: number, kind: NonNullable<typeof best>["kind"], idx: number) => {
      const lx = x - ox;
      const ly = y - oy;
      const lz = z - oz;
      const tc = lx * dx + ly * dy + lz * dz;
      if (tc < 0 || tc > range) return;
      const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
      if (d2 > r * r) return;
      const th = tc - Math.sqrt(r * r - d2);
      if (!best || th < best.t) best = { t: Math.max(0, th), kind, idx };
    };
    for (const e of this.eels) if (e.alive) test(e.x, e.y, e.z, 1.6, "eel", e.id);
    for (const r of this.rods) if (r.alive) test(r.x, r.y + 4.5, r.z, 1.8, "rod", r.i);
    if (this.phase !== "end") {
      this.parts.forEach((p, i) => {
        if (p.broken) return;
        const q = this.partPos(p.id);
        test(q.x, q.y, q.z, RAID.parts[p.id].r, "part", i);
      });
      if (this.exposed()) {
        const h = this.heartPos();
        test(h.x, h.y, h.z, 2.6, "heart", 0);
      }
      test(this.head.x, this.head.y + 1, this.head.z, 4.2, "head", 0);
      for (let i = 1; i < this.body.length; i += 2) test(this.body[i].x, this.body[i].y + 1, this.body[i].z, 2.6, "body", i);
    }
    return best as { t: number; kind: "eel" | "rod" | "part" | "heart" | "head" | "body"; idx: number } | null;
  }

  /** Người chơi bắn trúng (toạ độ cục bộ). Trả về khoảng cách trúng hoặc null */
  playerShot(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number, dmg: number) {
    const P = this.player;
    if (!P.alive || this.phase === "end") return null;
    const h = this.rayHit(ox, oy, oz, dx, dy, dz, range);
    if (!h) return null;
    const crit = this.rng() < 0.12;
    const d = dmg * (crit ? 1.8 : 1);
    if (h.kind === "eel") {
      const e = this.eels.find((x) => x.id === h.idx);
      if (e) this.hitEel(e, d, true);
    } else if (h.kind === "rod") this.hitRod(this.rods.find((r) => r.i === h.idx)!, d * (RAID.playerRole[P.role].rodMul ?? 1), true);
    else if (h.kind === "part") this.damage(d, "player", h.idx, crit);
    else if (h.kind === "heart") this.damage(d, "player", -3, true);
    else if (h.kind === "head") this.damage(d, "player", -1, crit);
    else this.damage(d * 0.8, "player", -2, crit);
    return h.t;
  }

  /** Kỹ năng người chơi nhắm vào (ax, az) */
  useSkill(sk: Skill, ax: number, az: number) {
    const P = this.player;
    const K = RAID.skills[sk];
    if (!P.alive || this.phase === "end" || this.cds[sk] > this.time) return false;
    this.cds[sk] = this.time + K.cd;
    if (sk === "grenade") {
      const w = this.warn("grenade", ax, az, ax, az, K.r!, K.fuse!, K.dmg!, true);
      w.fromX = P.x;
      w.fromZ = P.z;
    } else if (sk === "orbital") this.warn("orbital", ax, az, ax, az, K.r!, K.warn!, K.dmg!, true);
    else if (sk === "missiles") {
      // Tên lửa ưu tiên bộ phận chưa vỡ, rồi lươn, rồi đầu
      const tg: number[] = [];
      this.parts.forEach((p, i) => !p.broken && tg.push(i));
      this.eels.forEach((e) => e.alive && tg.push(100 + e.id));
      if (!tg.length) tg.push(-1);
      for (let i = 0; i < K.n!; i++) this.missiles.push({ id: i, tgt: tg[i % tg.length], x0: P.x, z0: P.z, at: this.time + i * 0.06, hitAt: this.time + K.delay! + i * 0.06 });
    } else {
      const R = RAID.roleSkill;
      if (P.role === "tank") {
        this.tauntUntil = this.time + R.tank.dur;
        this.callout("KHIÊU KHÍCH · Leviathan nhắm vào bạn", "#ffb000");
      } else if (P.role === "dps") {
        this.burstUntil = this.time + R.dps.dur;
        this.callout("BÙNG NỔ · sát thương ×1,6", "#ff4f6a");
      } else if (P.role === "healer") {
        for (const m of this.members) {
          if (Math.hypot(m.x - P.x, m.z - P.z) > R.healer.r) continue;
          if (!m.alive && m !== P) this.revive(m);
          else if (m.alive) {
            const a = m.maxHp * R.healer.pct;
            m.hp = Math.min(m.maxHp, m.hp + a);
            this.events.push({ kind: "heal", x: m.x, z: m.z, amount: Math.round(a), at: this.time });
          }
        }
      } else {
        for (const r of this.rods) if (r.alive && Math.hypot(r.x - P.x, r.z - P.z) < R.support.r) this.hitRod(r, 1200 * R.support.mul / 3, true);
        this.stagger = Math.min(1, this.stagger + R.support.stagger);
        this.events.push({ kind: "boom", x: P.x, y: P.y + 1, z: P.z, big: true, at: this.time });
      }
    }
    return true;
  }

  /** Vị trí mục tiêu tên lửa */
  missileTarget(tgt: number) {
    if (tgt >= 100) {
      const e = this.eels.find((x) => x.id === tgt - 100);
      return e && e.alive ? { x: e.x, y: e.y, z: e.z } : { x: this.head.x, y: this.head.y, z: this.head.z };
    }
    if (tgt >= 0) return this.partPos(this.parts[tgt].id);
    return { x: this.head.x, y: this.head.y + 2, z: this.head.z };
  }

  private updateMissiles() {
    for (const m of this.missiles) {
      if (this.time < m.hitAt) continue;
      m.hitAt = Infinity;
      const K = RAID.skills.missiles;
      if (m.tgt >= 100) {
        const e = this.eels.find((x) => x.id === m.tgt - 100);
        if (e) this.hitEel(e, K.dmg!, true);
      } else if (m.tgt >= 0 && !this.parts[m.tgt].broken) this.damage(K.dmg!, "player", m.tgt, true);
      else this.damage(K.dmg!, "player", -1, true);
      const p = this.missileTarget(m.tgt);
      this.events.push({ kind: "boom", x: p.x, y: p.y, z: p.z, big: false, at: this.time });
    }
    this.missiles = this.missiles.filter((m) => m.hitAt !== Infinity || false);
  }

  // -------------------------------------------------------------------------
  // AI đồng đội: né vòng báo trước, lên mái tránh phóng điện, đứng/phá cột, hồi máu, dồn sát thương khi ngã

  private updateMembers(dt: number) {
    const t = this.time;
    const H = this.head;
    const dischargeSoon = this.warns.some((w) => !w.done && (w.kind === "discharge" || w.kind === "tsunami"));
    const tsunami = this.warns.some((w) => !w.done && w.kind === "tsunami");
    const rodsUp = this.rods.filter((r) => r.alive);
    for (const m of this.members) {
      if (m.kind === "player") continue;
      if (!m.alive) {
        // Kỹ sư y tế hồi sinh đồng đội nằm gục gần đó
        const medic = this.members.find((h) => h.alive && h.role === "healer" && h !== m && Math.hypot(h.x - m.x, h.z - m.z) < 8);
        if (medic && t - m.downAt > RAID.player.revive) this.revive(m);
        else if (t - m.downAt > RAID.player.respawn * 1.5) this.revive(m, true);
        continue;
      }
      const dodge = m.kind === "human" ? RAID.dodge.human : RAID.dodge.elite;
      // Điểm đến theo vai trò
      let gx = m.gx;
      let gz = m.gz;
      if ((t * 10 + m.id) % 10 < 1.01) {
        const hd = Math.hypot(m.x - H.x, m.z - H.z) || 1;
        if (m.role === "tank") {
          gx = H.x + Math.sin(H.yaw) * 12;
          gz = H.z + Math.cos(H.yaw) * 12;
        } else if (m.role === "healer") {
          // Ưu tiên chạy tới hồi sinh đồng đội gục gần (≤ 40 m), không thì bám người máu thấp nhất; luôn cách đầu ≥ 16 m
          const down = this.members.filter((x) => !x.alive && x !== m && t - x.downAt < RAID.player.respawn && Math.hypot(x.x - m.x, x.z - m.z) < 40)[0];
          const low = this.members.filter((x) => x.alive && x !== m).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
          const f = down ?? low;
          gx = f ? f.x + 3 : m.x;
          gz = f ? f.z + 3 : m.z;
          if (!down && Math.hypot(gx - H.x, gz - H.z) < 16) {
            const a = Math.atan2(gx - H.x, gz - H.z);
            gx = H.x + Math.sin(a) * 18;
            gz = H.z + Math.cos(a) * 18;
          }
        } else if ((m.role === "support" || (m.role === "dps" && m.id % 2 === 0)) && rodsUp.length && !this.exposed()) {
          // Phá cột gần nhất: đứng trên mái có cột
          // Mỗi người giữ một cột cố định theo số thứ tự (không đổi qua lại khi di chuyển)
          const r = rodsUp[m.id % rodsUp.length];
          gx = r.x + 2;
          gz = r.z + 2;
        } else {
          // Xung kích giữ khoảng cách 20–26 m quanh đầu; khi lộ lõi tim thì áp sát
          const want = this.exposed() ? 10 : 22;
          const a = Math.atan2(m.x - H.x, m.z - H.z) + 0.3;
          gx = hd > want + 6 || hd < want - 6 ? H.x + Math.sin(a) * want : m.x;
          gz = hd > want + 6 || hd < want - 6 ? H.z + Math.cos(a) * want : m.z;
        }
        // Phóng điện sắp tới: lên mái gần nhất (Hồng Thuỷ: mái có cột còn đứng)
        if (dischargeSoon && this.rng() < dodge + 0.05) {
          const roofs = RAID.roofs.map((r, i) => ({ r, i })).filter(({ i }) => !tsunami || this.rods.some((d) => d.i === i && d.alive));
          const best = (roofs.length ? roofs : RAID.roofs.map((r, i) => ({ r, i }))).sort((a, b) => Math.hypot(a.r.x - m.x, a.r.z - m.z) - Math.hypot(b.r.x - m.x, b.r.z - m.z))[0];
          gx = best.r.x + ((m.id % 3) - 1) * 2.5;
          gz = best.r.z + (((m.id >> 1) % 3) - 1) * 2.5;
        }
        m.gx = Math.max(-RAID.arena.half, Math.min(RAID.arena.half, gx));
        m.gz = Math.max(-RAID.arena.half, Math.min(RAID.arena.half, gz));
      }
      // Né vòng đỏ đang nạp (không phải phóng điện)
      let ex = 0;
      let ez = 0;
      for (const w of this.warns) {
        if (w.done || w.byPlayer || w.kind === "discharge" || w.kind === "tsunami") continue;
        if (!this.inWarn(w, m.x, m.z, m)) continue;
        if ((m.id * 7 + Math.floor(w.warnAt * 10)) % 100 >= dodge * 100) continue;
        const cx = w.kind === "breath" || w.kind === "bite" ? (w.x0 + w.x1) / 2 : w.x0;
        const cz = w.kind === "breath" || w.kind === "bite" ? (w.z0 + w.z1) / 2 : w.z0;
        const d = Math.hypot(m.x - cx, m.z - cz) || 1;
        ex += (m.x - cx) / d;
        ez += (m.z - cz) / d;
      }
      const sp = 6.2;
      let dx = m.gx - m.x + ex * 30;
      let dz = m.gz - m.z + ez * 30;
      const d = Math.hypot(dx, dz);
      if (d > 0.4) {
        dx /= d;
        dz /= d;
        // Vòng qua cao ốc: sắp đâm vào thì trượt theo tiếp tuyến (chọn phía gần đích hơn), quá sát thì đẩy ra
        for (const T of RAID.towers) {
          const ox = m.x - T.x;
          const oz = m.z - T.z;
          const od = Math.hypot(ox, oz) || 1;
          if (od < T.r + 7 && dx * ox + dz * oz < 0) {
            const side = dx * oz - dz * ox > 0 ? 1 : -1;
            const k = (T.r + 7 - od) / 7;
            dx += (oz / od) * side * 2 * k;
            dz += (-ox / od) * side * 2 * k;
          }
          if (od < T.r + 1.5) {
            dx += (ox / od) * 2;
            dz += (oz / od) * 2;
          }
        }
        const n = Math.hypot(dx, dz) || 1;
        m.vx = (dx / n) * sp * (ex || ez ? 1.3 : 1);
        m.vz = (dz / n) * sp * (ex || ez ? 1.3 : 1);
        m.x += m.vx * dt;
        m.z += m.vz * dt;
        m.yaw = Math.atan2(m.vx, m.vz);
      } else m.vx = m.vz = 0;
      // Cao độ: nhảy lên / xuống mái
      const roof = this.roofAt(m.x, m.z);
      const gy = roof >= 0 ? RAID.roofs[roof].h : 0;
      m.y += (gy - m.y) * Math.min(1, dt * 8);
      // Biến hình Mech đồng bộ: khi thanh choáng ≥ 70% ở Tuyệt vọng, người thật + NPC tinh anh cùng biến
      if (!m.inMech && this.phase === "despair" && this.stagger > 0.7 && t >= this.downUntil) m.inMech = true;
      else if (m.inMech && t >= this.downUntil && this.stagger < 0.5) m.inMech = false;
      this.memberAct(m);
    }
  }

  private memberAct(m: Member) {
    const t = this.time;
    if (t < m.shootAt) return;
    const R = ROLES[m.role];
    m.shootAt = t + R.cd * (0.85 + this.rng() * 0.3);
    // Kỹ sư y tế: hồi người máu thấp nhất trong tầm
    if (m.role === "healer") {
      const low = this.members.filter((x) => x.alive && x.hp < x.maxHp * 0.85 && Math.hypot(x.x - m.x, x.z - m.z) < R.range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (low) {
        const a = 45 * m.power;
        low.hp = Math.min(low.maxHp, low.hp + a);
        this.events.push({ kind: "heal", x: low.x, z: low.z, amount: Math.round(a), at: t, fx: m.x, fz: m.z });
        return;
      }
    }
    const dmg = R.dmg * m.power * (m.inMech ? 1.6 : 1);
    // Mục tiêu: lươn gần → cột (nếu đứng cạnh) → lõi tim khi lộ → bộ phận chưa vỡ → đầu
    const eel = this.eels.find((e) => e.alive && Math.hypot(e.x - m.x, e.z - m.z) < 20);
    const rod = this.rods.find((r) => r.alive && Math.hypot(r.x - m.x, r.z - m.z) < 7);
    let tx: number, ty: number, tz: number;
    if (eel && this.rng() < 0.6) {
      this.hitEel(eel, dmg, false);
      tx = eel.x;
      ty = eel.y;
      tz = eel.z;
    } else if (rod && !this.exposed()) {
      this.hitRod(rod, dmg * (m.role === "support" ? 1.8 : 1), false);
      tx = rod.x;
      ty = rod.y + 4;
      tz = rod.z;
    } else {
      const H = this.head;
      // Súng tầm xa: bắn được đầu rắn trong 55 m
      if (Math.hypot(H.x - m.x, H.z - m.z) > 55) return;
      if (this.exposed()) {
        this.damage(dmg, m, -3);
        ({ x: tx, y: ty, z: tz } = this.heartPos());
      } else {
        const open = this.parts.map((p, i) => ({ p, i })).filter(({ p }) => !p.broken);
        if (open.length && (m.role === "dps" || m.role === "support") && this.rng() < 0.7) {
          const { p, i } = open[(m.id + Math.floor(t / 8)) % open.length];
          this.damage(dmg, m, i);
          ({ x: tx, y: ty, z: tz } = this.partPos(p.id));
        } else {
          this.damage(dmg, m, -1);
          tx = H.x;
          ty = H.y + 1;
          tz = H.z;
        }
      }
    }
    this.events.push({ kind: "tracer", x0: m.x, y0: m.y + 1.3, z0: m.z, x1: tx, y1: ty, z1: tz, member: true, at: t });
  }

  /** Điểm đóng góp → hạng S/A/B/C của người chơi */
  score() {
    const P = this.player;
    const share = Math.min(1, P.dmgDone / Math.max(1, this.maxHp - this.hp));
    const pts = Math.round(share * 1000 + this.parts.filter((p) => p.broken).length * 20);
    const rank = pts >= 300 ? "S" : pts >= 180 ? "A" : pts >= 90 ? "B" : "C";
    return { pts, rank, share };
  }
}
