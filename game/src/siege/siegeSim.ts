// Cổng Công Thành 3D – Đại chiến Thành Băng IXO (GDD mục 4I). Mô phỏng thuần TypeScript, bước cố định 20 Hz,
// chạy được trong test. Hai phe: Hunter (tấn công) và IXO (thủ thành), mỗi phe N quân: 30% "người thật"
// (offline: tay súng tinh nhuệ mang tên người chơi) + 70% NPC (55–65% sức mạnh). Người chơi là một quân của
// phe mình chọn, chỉ huy tiểu đội 2 NPC bằng bánh xe lệnh.
//
// Toạ độ cục bộ của bản đồ (mét): x ngang, z dọc. Lâu đài ở gốc toạ độ, trại Hunter ở phía +z.
//
// 5 giai đoạn: Xung phong → Phá khiên (3 máy phát) → Phá cổng → Sân trong (chiếm 2 tháp) → Lõi Thành (giữ 60 s,
// phe thủ có Boss Mech và một Bom Nova).

export type Side = 0 | 1; // 0 = Hunter (tấn công), 1 = IXO (thủ thành)
export type Role = "infantry" | "shield" | "ranged" | "medic" | "special" | "tank";
/** Thế đánh của người chơi: Xạ thủ (súng), Cận chiến (kiếm, máu ×2,2), Tanker (giáp Mech, máu ×4,5) */
export type Stance = "gunner" | "melee" | "tank";
export type Skill = "grenade" | "missiles" | "orbital" | "shockwave";
export type Phase = "charge" | "shield" | "gate" | "courtyard" | "core" | "end";
export type Order = "follow" | "hold" | "attack" | "regroup";

export const SIEGE = {
  step: 1 / 20,
  /** Thời lượng trận (giây). GDD: 25 phút cho trận 100 người thật; bản chơi đơn rút gọn còn 12 phút */
  duration: 12 * 60,
  chargeTime: 40,
  respawnWave: 20,
  ticketsPerUnit: 3,
  humanRatio: 0.3,
  npcPower: [0.55, 0.65] as [number, number],
  /** Bản đồ */
  camp: { z: 190, spread: 34 },
  defSpawn: { x: 0, z: -11 },
  moat: { z0: 52, z1: 60, bridges: [-45, 0, 45], bridgeHalf: 4.2 },
  dome: { r: 70 },
  wall: { r: 42, thick: 2.2, gateHalf: 4.5 },
  generators: [
    { x: -58, z: 80 },
    { x: 0, z: 90 },
    { x: 58, z: 80 },
  ],
  genHp: 900,
  gate: { x: 0, z: 42, hp: 2600 },
  towers: [
    { x: -24, z: 14 },
    { x: 24, z: 14 },
  ],
  towerR: 8,
  /** Tốc độ chiếm tháp mỗi giây cho mỗi quân chênh lệch */
  captureRate: 0.035,
  core: { x: 0, z: -8, r: 8, hold: 60 },
  cannons: [-0.38, -0.12, 0.12, 0.38].map((a) => ({ x: Math.sin(a) * 42, z: Math.cos(a) * 42 })),
  cannonHp: 520,
  cannon: { every: 4.2, warn: 1.6, r: 4.2, dmg: 45, range: 120 },
  boss: { hp: 5200, speed: 3.2, stompEvery: 5.5, stompWarn: 1.2, stompR: 7, stompDmg: 70, laserEvery: 9, laserWarn: 1.4, laserLen: 34, laserW: 2.4, laserDmg: 55 },
  nova: { at: 30, warn: 6, r: 34 },
  roles: {
    infantry: { hp: 100, dmg: 9, range: 26, keep: 14, cd: 1.0, speed: 5.2 },
    shield: { hp: 170, dmg: 7, range: 16, keep: 5, cd: 1.2, speed: 4.4 },
    ranged: { hp: 80, dmg: 14, range: 40, keep: 26, cd: 1.6, speed: 4.8 },
    medic: { hp: 90, dmg: 5, range: 20, keep: 16, cd: 1.3, speed: 5.0 },
    special: { hp: 120, dmg: 8, range: 22, keep: 10, cd: 1.1, speed: 5.0 },
    /** Tanker khổng lồ (Hunter: robot chiến đấu, IXO: golem / quái hai đầu): vừa bắn pháo xa vừa đập cận chiến lan */
    tank: { hp: 1300, dmg: 26, range: 34, keep: 3, cd: 1.7, speed: 3.1 },
  } as Record<Role, { hp: number; dmg: number; range: number; keep: number; cd: number; speed: number }>,
  /** Quân đánh mục tiêu (máy phát / cổng / pháo) mỗi giây; quân đặc biệt (phá khiên) mạnh gấp 3 */
  objDps: 5,
  repairDps: 3.5,
  healDps: 6,
  player: { hp: 100, dmgTaken: 0.28, focus: 0.5, regenDelay: 4, regen: 6 },
  /** Ba thế của người chơi (phím X đổi): hệ số máu, hệ số sát thương nhận, tốc độ đổi thế */
  stances: {
    gunner: { hpMul: 1, taken: 1, label: "XẠ THỦ" },
    melee: { hpMul: 2.2, taken: 0.8, label: "CẬN CHIẾN" },
    tank: { hpMul: 4.5, taken: 0.55, label: "TANKER" },
  } as Record<Stance, { hpMul: number; taken: number; label: string }>,
  stanceCd: 1.5,
  /** Kiếm cận chiến: tầm, góc chém (rad), sát thương, nghỉ; Tanker dậm đất xung quanh */
  slash: { range: 4.8, arc: 2.2, dmg: 75, cd: 0.42, tankRange: 5.5, tankDmg: 95 },
  /**
   * Kỹ năng (Q / E / R / F): lựu đạn plasma, chùm tên lửa đuổi, pháo kích quỹ đạo, sóng xung kích quanh thân.
   * Tanker: sóng xung kích to hơn và kéo quái địch về (khiêu khích)
   */
  skills: {
    grenade: { cd: 6, r: 6.5, dmg: 150, fuse: 0.9, label: "Lựu đạn plasma", key: "Q" },
    missiles: { cd: 12, n: 8, range: 45, dmg: 110, delay: 0.7, label: "Chùm tên lửa", key: "E" },
    orbital: { cd: 30, r: 12, dmg: 520, warn: 2, label: "Pháo kích quỹ đạo", key: "R" },
    shockwave: { cd: 9, r: 8.5, dmg: 95, push: 9, label: "Sóng xung kích", key: "F" },
  } as Record<Skill, { cd: number; r?: number; dmg: number; fuse?: number; n?: number; range?: number; delay?: number; warn?: number; push?: number; label: string; key: string }>,
  /** Cận chiến: quân áp sát thì đâm / chém, đánh bật lùi */
  melee: { range: 2.4, cd: 0.9, dmg: 13, push: 4 },
  /** Phe thủ mở cửa phụ xuất quân ra cánh đồng giáp lá cà (giai đoạn Xung phong / Phá khiên) */
  sortie: { share: 0.45 },
  /**
   * Rơi đồ khi hạ quân (người chơi hạ, hoặc quân địch gục trong bán kính `near` quanh người chơi): xác suất mỗi loại,
   * CRED [ít, nhiều]; tay súng tinh nhuệ rơi nhiều hơn; phá công trình mưa đồ; tầm hút đồ về người chơi
   */
  loot: { near: 26, cred: 0.85, credAmt: [4, 12] as [number, number], stim: 0.08, key: 0.03, gear: 0.025, heroMul: 2.5, iceShare: 0.25, shower: 14, magnet: 14, pick: 1.6, life: 40 },
};

export type Unit = {
  id: number;
  side: Side;
  role: Role;
  /** "Người thật" (offline: tay súng tinh nhuệ có tên) */
  hero: boolean;
  name: string;
  power: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  diedAt: number;
  cd: number;
  think: number;
  target: number;
  /** Nhánh tấn công (0 trái, 1 giữa, 2 phải) / chốt phòng thủ */
  lane: number;
  squad: boolean;
  shooting: number;
  kills: number;
  /** Lần cuối ra đòn cận chiến / bị trúng (hoạt ảnh, nháy) */
  meleeAt: number;
  hurtAt: number;
};

export type Objective = { kind: "gen" | "gate" | "cannon" | "boss"; i: number; x: number; z: number; hp: number; maxHp: number; alive: boolean };

export type Warn = { kind: "cannon" | "stomp" | "laser" | "nova" | "grenade" | "orbital"; x0: number; z0: number; x1: number; z1: number; r: number; warnAt: number; liveAt: number; dmg: number; done: boolean; byPlayer?: boolean; fromX?: number; fromZ?: number };

/** Đồ rơi trên tuyết: CRED, Stim, Chìa rương, trang bị (độ hiếm quyết định khi nhặt) */
export type Drop = { id: number; kind: "cred" | "stim" | "key" | "gear"; amount: number; x: number; z: number; vx: number; vz: number; y: number; vy: number; at: number; taken: boolean; ice?: boolean };

export type SiegeEvent =
  | { kind: "tracer"; x0: number; z0: number; x1: number; z1: number; side: Side; hero: boolean; at: number }
  | { kind: "boom"; x: number; z: number; big: boolean; at: number }
  | { kind: "death"; id: number; x: number; z: number; side: Side; at: number }
  | { kind: "callout"; text: string; color: string; at: number }
  | { kind: "playerHit"; dmg: number; at: number }
  | { kind: "objDown"; obj: Objective["kind"]; i: number; at: number }
  | { kind: "melee"; x: number; z: number; side: Side; at: number }
  | { kind: "hit"; x: number; z: number; dmg: number; side: Side; byPlayer: boolean; crit: boolean; at: number }
  | { kind: "kill"; killer: string; victim: string; side: Side; byPlayer: boolean; at: number }
  | { kind: "loot"; drop: Drop; at: number }
  | { kind: "streak"; n: number; at: number };

export type SiegeOpts = { perSide?: number; playerSide?: Side; seed?: number; extraCoin?: boolean };

const HERO_NAMES = ["Kaito", "Mira", "Zed", "Linh", "Raven", "Nova", "Bao", "Yuki", "Ash", "Tran", "Vex", "Kiro", "Hana", "Duc", "Sora", "Neo", "Lyra", "Minh", "Jax", "Iris", "Quan", "Echo", "Rin", "Phong", "Ghost", "Ly", "Talon", "Hoa", "Blitz", "Nam"];

export class SiegeSim {
  time = 0;
  phase: Phase = "charge";
  winner: Side | null = null;
  units: Unit[] = [];
  objectives: Objective[] = [];
  warns: Warn[] = [];
  events: SiegeEvent[] = [];
  tickets: [number, number];
  readonly perSide: number;
  readonly playerSide: Side;
  towerProgress = [0, 0];
  towerTaken = [false, false];
  coreHold = 0;
  novaUsed = false;
  novaAt = -9;
  /** Người chơi: vị trí do engine Hub đưa vào mỗi khung; máu và trạng thái quản lý ở đây */
  player = { x: 0, z: 0, alive: true, hp: SIEGE.player.hp, extraCoin: false, kills: 0, objDmg: 0, captures: 0, deaths: 0, inMech: false, invulnUntil: -9, hurtAt: -9, streak: 0, streakAt: -9, bestStreak: 0, stance: "gunner" as Stance, stanceAt: -9, slashAt: -9, maxHp: SIEGE.player.hp, cds: { grenade: 0, missiles: 0, orbital: 0, shockwave: 0 } as Record<Skill, number> };
  /** Tên lửa đang bay (hiển thị): từ người chơi tới mục tiêu */
  missiles: { x0: number; z0: number; id: number; at: number; hitAt: number }[] = [];
  drops: Drop[] = [];
  private dropId = 0;
  order: Order = "attack";
  holdAt = { x: 0, z: 0 };
  private acc = 0;
  private nextWave = SIEGE.respawnWave;
  private rng: () => number;
  private grid = new Map<number, number[]>();
  private bossThink = 0;

  constructor(opts: SiegeOpts = {}) {
    this.perSide = opts.perSide ?? 100;
    this.playerSide = opts.playerSide ?? 0;
    this.player.extraCoin = !!opts.extraCoin;
    let s = (opts.seed ?? 7) >>> 0 || 1;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
    this.tickets = [this.perSide * SIEGE.ticketsPerUnit, this.perSide * SIEGE.ticketsPerUnit];
    SIEGE.generators.forEach((g, i) => this.objectives.push({ kind: "gen", i, x: g.x, z: g.z, hp: SIEGE.genHp, maxHp: SIEGE.genHp, alive: true }));
    this.objectives.push({ kind: "gate", i: 0, x: SIEGE.gate.x, z: SIEGE.gate.z, hp: SIEGE.gate.hp, maxHp: SIEGE.gate.hp, alive: true });
    SIEGE.cannons.forEach((c, i) => this.objectives.push({ kind: "cannon", i, x: c.x, z: c.z, hp: SIEGE.cannonHp, maxHp: SIEGE.cannonHp, alive: true }));
    let id = 0;
    for (const side of [0, 1] as Side[]) {
      // Người chơi chiếm một suất "người thật" của phe mình
      const n = side === this.playerSide ? this.perSide - 1 : this.perSide;
      const heroes = Math.round(this.perSide * SIEGE.humanRatio) - (side === this.playerSide ? 1 : 0);
      let squad = 0;
      for (let i = 0; i < n; i++) {
        const r = this.rng();
        // Mỗi 25 quân có một Tanker khổng lồ (không phải "người thật")
        const role: Role = i % 25 === 12 ? "tank" : r < 0.5 ? "infantry" : r < 0.66 ? "shield" : r < 0.83 ? "ranged" : r < 0.91 ? "medic" : "special";
        const hero = i < heroes && i % 25 !== 12;
        const R = SIEGE.roles[role];
        const power = hero ? 1 : SIEGE.npcPower[0] + this.rng() * (SIEGE.npcPower[1] - SIEGE.npcPower[0]);
        const u: Unit = {
          id: id++,
          side,
          role,
          hero,
          name: hero ? `${HERO_NAMES[i % HERO_NAMES.length]}${side === 1 ? "·IXO" : ""}` : "",
          power,
          x: 0,
          z: 0,
          vx: 0,
          vz: 0,
          yaw: side === 0 ? Math.PI : 0,
          hp: R.hp * (hero ? 1.5 : 1),
          maxHp: R.hp * (hero ? 1.5 : 1),
          alive: true,
          diedAt: -9,
          cd: this.rng() * R.cd,
          think: this.rng() * 0.3,
          target: -1,
          lane: i % 3,
          // Tiểu đội của người chơi: 2 NPC đầu tiên (không phải tay súng tinh nhuệ) cùng phe
          squad: side === this.playerSide && !hero && squad < 2 && (squad++, true),
          shooting: -9,
          kills: 0,
          meleeAt: -9,
          hurtAt: -9,
        };
        this.spawnAt(u, true);
        this.units.push(u);
      }
    }
    const sp = this.spawnPoint(this.playerSide, 0);
    this.player.x = sp.x;
    this.player.z = sp.z;
    this.callout("XUNG PHONG! Hàng trăm quân Hunter lao về Thành Băng", "#7ff3ff");
  }

  // ------------------------------------------------------------------ truy vấn

  get shieldUp() {
    return this.objectives.some((o) => o.kind === "gen" && o.alive);
  }
  get gateOpen() {
    return !this.obj("gate", 0)!.alive;
  }
  get boss() {
    return this.objectives.find((o) => o.kind === "boss") ?? null;
  }
  get timeLeft() {
    return Math.max(0, SIEGE.duration - this.time);
  }
  obj(kind: Objective["kind"], i: number) {
    return this.objectives.find((o) => o.kind === kind && o.i === i);
  }
  alive(side: Side) {
    let n = 0;
    for (const u of this.units) if (u.alive && u.side === side) n++;
    return n;
  }

  spawnPoint(side: Side, k: number) {
    if (side === 0) return { x: Math.sin(k * 2.39) * SIEGE.camp.spread, z: SIEGE.camp.z + ((k * 7) % 11) };
    return { x: SIEGE.defSpawn.x + Math.sin(k * 2.39) * 9, z: SIEGE.defSpawn.z + Math.cos(k * 1.7) * 5 };
  }

  private spawnAt(u: Unit, first = false) {
    const p = this.spawnPoint(u.side, u.id);
    u.x = p.x;
    u.z = p.z;
    // Lúc đầu trận phe thủ đứng sẵn ở các chốt (máy phát, tường thành, sân trong)
    if (first && u.side === 1) {
      const post = this.defPost(u);
      u.x = post.x + (this.rng() - 0.5) * 6;
      u.z = post.z + (this.rng() - 0.5) * 6;
    }
    u.hp = u.maxHp;
    u.alive = true;
    u.target = -1;
    u.vx = u.vz = 0;
  }

  // ------------------------------------------------------------------ bước mô phỏng

  update(dt: number) {
    this.acc = Math.min(this.acc + dt, 0.5);
    while (this.acc >= SIEGE.step) {
      this.acc -= SIEGE.step;
      this.step();
    }
  }

  step() {
    if (this.phase === "end") return;
    const dt = SIEGE.step;
    this.time += dt;
    this.buildGrid();
    for (const u of this.units) if (u.alive) this.updateUnit(u, dt);
    this.updateObjectives(dt);
    this.updateWarns();
    this.updateDrops(dt);
    this.updateMissiles();
    // Người chơi tự hồi máu khi tạm rời giao tranh
    const P = this.player;
    if (P.alive && this.time - P.hurtAt > SIEGE.player.regenDelay) P.hp = Math.min(P.maxHp, P.hp + SIEGE.player.regen * (P.maxHp / SIEGE.player.hp) * dt);
    this.updatePhase(dt);
    if (this.time >= this.nextWave) {
      this.nextWave += SIEGE.respawnWave;
      for (const u of this.units)
        if (!u.alive && this.tickets[u.side] > 0 && this.time - u.diedAt > 3) {
          this.tickets[u.side]--;
          this.spawnAt(u);
        }
      if (!this.player.alive) this.respawnPlayer();
    }
    // Sự kiện cũ bỏ bớt (hiển thị chỉ đọc vài giây gần nhất)
    if (this.events.length > 600) this.events.splice(0, this.events.length - 300);
  }

  private respawnPlayer() {
    const sp = this.spawnPoint(this.playerSide, 3);
    this.player.x = sp.x;
    this.player.z = sp.z;
    this.player.hp = this.player.maxHp;
    this.player.alive = true;
    this.player.invulnUntil = this.time + 3;
  }

  private key(cx: number, cz: number) {
    return (cx + 512) * 4096 + (cz + 512);
  }
  private buildGrid() {
    this.grid.clear();
    for (const u of this.units) {
      if (!u.alive) continue;
      const k = this.key(Math.floor(u.x / 12), Math.floor(u.z / 12));
      const a = this.grid.get(k);
      if (a) a.push(u.id);
      else this.grid.set(k, [u.id]);
    }
  }

  /** Quân địch gần nhất trong bán kính (id ≥ 0), hoặc -2 nếu là người chơi, -1 nếu không có */
  private nearestEnemy(u: Unit, range: number) {
    const cx = Math.floor(u.x / 12);
    const cz = Math.floor(u.z / 12);
    const n = Math.ceil(range / 12);
    let best = -1;
    let bd = range * range;
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) {
        const a = this.grid.get(this.key(cx + i, cz + j));
        if (!a) continue;
        for (const id of a) {
          const o = this.units[id];
          if (o.side === u.side || !o.alive) continue;
          const d = (o.x - u.x) ** 2 + (o.z - u.z) ** 2;
          if (d < bd) (bd = d), (best = id);
        }
      }
    if (this.player.alive && u.side !== this.playerSide) {
      const d = (this.player.x - u.x) ** 2 + (this.player.z - u.z) ** 2;
      // Người chơi nổi bật: quân địch ưu tiên nhắm người chơi hơn một chút
      if (d * 0.8 < bd && (u.id % 100) / 100 < SIEGE.player.focus) best = -2;
    }
    return best;
  }

  /** Chốt của quân thủ thành theo giai đoạn */
  private defPost(u: Unit): { x: number; z: number } {
    const k = u.id % 10;
    if (this.phase === "core" || (this.gateOpen && this.towerTaken[0] && this.towerTaken[1])) return { x: SIEGE.core.x + Math.sin(u.id) * 6, z: SIEGE.core.z + Math.cos(u.id) * 5 };
    if (this.gateOpen) {
      const t = SIEGE.towers[u.id % 2];
      return this.towerTaken[u.id % 2] ? { x: SIEGE.core.x, z: SIEGE.core.z + 4 } : { x: t.x + Math.sin(u.id) * 4, z: t.z + Math.cos(u.id) * 4 };
    }
    if (k < 3) {
      // Giữ máy phát (máy đã sập thì lui về cổng)
      const g = this.obj("gen", u.lane);
      if (g?.alive) return { x: g.x + Math.sin(u.id * 1.3) * 7, z: g.z - 4 + Math.cos(u.id) * 4 };
      return { x: (u.id % 5) * 3 - 6, z: SIEGE.gate.z - 6 };
    }
    // Xuất quân: phe thủ ra cánh đồng chặn quân Hunter (đánh giáp lá cà quanh người chơi / máy phát)
    if (!this.gateOpen && (this.phase === "charge" || this.phase === "shield") && (u.id % 100) / 100 < SIEGE.sortie.share && u.role !== "ranged") {
      const g = this.obj("gen", u.lane);
      const px = this.playerSide === 0 && this.player.alive && this.player.z > SIEGE.moat.z1 ? this.player.x : g?.x ?? 0;
      const pz = this.playerSide === 0 && this.player.alive && this.player.z > SIEGE.moat.z1 ? this.player.z : (g?.z ?? 90) + 14;
      return { x: px + Math.sin(u.id * 1.7) * 9, z: Math.min(pz, 175) + Math.cos(u.id * 0.9) * 7 - 4 };
    }
    if (k < 7) {
      // Trên tường thành, cung phía trước
      const a = (((u.id * 37) % 100) / 100 - 0.5) * 1.3;
      return { x: Math.sin(a) * (SIEGE.wall.r - 3), z: Math.cos(a) * (SIEGE.wall.r - 3) };
    }
    const t = SIEGE.towers[u.id % 2];
    return { x: t.x, z: t.z };
  }

  /** Mục tiêu hành quân của quân tấn công theo giai đoạn và nhánh */
  private attackGoal(u: Unit): { x: number; z: number } {
    if (u.squad && u.side === this.playerSide && this.order !== "attack") {
      if (this.order === "hold") return this.holdAt;
      const a = u.id * 2.1;
      return { x: this.player.x + Math.sin(a) * 2.5, z: this.player.z + Math.cos(a) * 2.5 };
    }
    if (u.side === 1) return this.defPost(u);
    // Chưa qua hào: đi về cầu của nhánh mình
    if (u.z > SIEGE.moat.z1 + 1) {
      const gensLeft = this.objectives.filter((o) => o.kind === "gen" && o.alive);
      if (gensLeft.length) {
        const g = this.obj("gen", u.lane)?.alive ? this.obj("gen", u.lane)! : gensLeft[u.id % gensLeft.length];
        // Máy phát nằm trước hào: đánh thẳng
        if (g.z > SIEGE.moat.z1) return { x: g.x + Math.sin(u.id) * 5, z: g.z + 4 + Math.cos(u.id) * 3 };
      }
      return { x: SIEGE.moat.bridges[u.lane], z: SIEGE.moat.z0 - 2 };
    }
    if (!this.gateOpen) return { x: SIEGE.gate.x + Math.sin(u.id) * 6, z: SIEGE.gate.z + 5 + Math.cos(u.id * 0.7) * 3 };
    if (!this.towerTaken[0] || !this.towerTaken[1]) {
      const pick = !this.towerTaken[u.lane === 2 ? 1 : 0] ? (u.lane === 2 ? 1 : 0) : this.towerTaken[0] ? 1 : 0;
      const t = SIEGE.towers[pick];
      return { x: t.x + Math.sin(u.id) * 4, z: t.z + Math.cos(u.id) * 4 };
    }
    return { x: SIEGE.core.x + Math.sin(u.id) * 5, z: SIEGE.core.z + Math.cos(u.id) * 4 };
  }

  private updateUnit(u: Unit, dt: number) {
    const R = SIEGE.roles[u.role];
    u.cd -= dt;
    u.think -= dt;
    if (u.think <= 0) {
      u.think = 0.3;
      u.target = this.nearestEnemy(u, R.range * 1.15);
    }
    let gx: number;
    let gz: number;
    const goal = this.attackGoal(u);
    gx = goal.x;
    gz = goal.z;
    let tx = 0;
    let tz = 0;
    let engaged = false;
    const regroup = u.squad && this.order === "regroup";
    if (u.target !== -1 && !regroup) {
      if (u.target === -2) {
        tx = this.player.x;
        tz = this.player.z;
      } else {
        const t = this.units[u.target];
        if (!t.alive) u.target = -1;
        tx = t.x;
        tz = t.z;
      }
      if (u.target !== -1) {
        engaged = true;
        const d = Math.hypot(tx - u.x, tz - u.z);
        // Giữ cự li theo vai trò: lính khiên áp sát, xạ thủ đứng xa
        const keep = u.role === "shield" || u.role === "special" || u.role === "tank" ? 1.5 : u.role === "infantry" && u.id % 3 === 0 ? 1.8 : R.keep;
        if (d > keep) {
          gx = tx;
          gz = tz;
        } else {
          gx = u.x;
          gz = u.z;
        }
        u.yaw = Math.atan2(tx - u.x, tz - u.z);
        // Áp sát: đâm / chém (lính khiên, đặc biệt, bộ binh lao vào khi địch quá gần)
        if (d < SIEGE.melee.range && u.cd <= 0) {
          u.cd = SIEGE.melee.cd;
          u.shooting = this.time;
          u.meleeAt = this.time;
          const dmg = SIEGE.melee.dmg * u.power * (u.role === "tank" ? 3.5 : u.role === "shield" || u.role === "special" ? 1.4 : 1);
          // Tanker đập lan: trúng mọi quân địch quanh chỗ đập
          if (u.role === "tank") {
            for (const o of this.units) if (o.alive && o.side !== u.side && o.id !== u.target && Math.hypot(o.x - tx, o.z - tz) < 3.5) this.damageUnit(o, dmg * 0.6, u);
            this.events.push({ kind: "boom", x: tx, z: tz, big: false, at: this.time });
          }
          this.events.push({ kind: "melee", x: (u.x + tx) / 2, z: (u.z + tz) / 2, side: u.side, at: this.time });
          if (u.target === -2) this.hurtPlayer(dmg * SIEGE.player.dmgTaken * 1.2);
          else {
            const t = this.units[u.target];
            this.damageUnit(t, dmg, u);
            const k = SIEGE.melee.push / (d || 1);
            t.x += (t.x - u.x) * k * 0.15;
            t.z += (t.z - u.z) * k * 0.15;
          }
        } else if (u.cd <= 0 && d < R.range) {
          u.cd = R.cd * (0.85 + this.rng() * 0.3);
          this.shoot(u, tx, tz, d, u.target);
        }
      }
    }
    // Không có địch trong tầm: đánh mục tiêu công trình gần
    if (!engaged) this.workObjective(u, dt);
    // Thầy thuốc hồi máu đồng đội gần
    if (u.role === "medic" && this.time % 1 < dt) this.healAround(u);
    // Di chuyển
    const dx = gx - u.x;
    const dz = gz - u.z;
    const d = Math.hypot(dx, dz);
    const speed = R.speed * (regroup ? 1.4 : 1) * (engaged ? 0.6 : 1);
    if (d > 1.2) {
      u.vx = (dx / d) * speed;
      u.vz = (dz / d) * speed;
      if (!engaged) u.yaw = Math.atan2(dx, dz);
    } else {
      u.vx *= 0.7;
      u.vz *= 0.7;
    }
    const nx = u.x + u.vx * dt;
    const nz = u.z + u.vz * dt;
    const c = this.constrain(u.x, u.z, nx, nz, u.side);
    u.x = c.x;
    u.z = c.z;
  }

  /** Va chạm bản đồ: hào băng (chỉ qua cầu), khiên năng lượng (chặn quân tấn công khi còn khiên), tường thành (chỉ qua cổng đã vỡ) */
  constrain(x0: number, z0: number, x: number, z: number, side: Side) {
    const M = SIEGE.moat;
    const onBridge = M.bridges.some((b) => Math.abs(x - b) < M.bridgeHalf);
    if (!onBridge && z > M.z0 && z < M.z1) {
      // Không bước xuống hào: giữ nguyên trục z, cho trượt ngang về phía cầu
      z = z0 > M.z1 - 0.01 ? Math.max(z, M.z1) : z0 < M.z0 + 0.01 ? Math.min(z, M.z0) : z0;
    }
    const r0 = Math.hypot(x0, z0);
    const r = Math.hypot(x, z);
    if (side === 0 && this.shieldUp && r < SIEGE.dome.r && r0 >= SIEGE.dome.r - 0.5) {
      const k = SIEGE.dome.r / (r || 1);
      x *= k;
      z *= k;
    }
    const W = SIEGE.wall;
    const inGate = Math.abs(x) < W.gateHalf && z > 0;
    const crossing = (r0 - W.r) * (r - W.r) <= 0 || Math.abs(r - W.r) < W.thick / 2;
    if (crossing && !(inGate && this.gateOpen)) {
      // Đẩy về phía ban đầu của tường
      const k = (r0 >= W.r ? W.r + W.thick / 2 + 0.05 : W.r - W.thick / 2 - 0.05) / (r || 1);
      x *= k;
      z *= k;
    }
    return { x, z };
  }

  private shoot(u: Unit, tx: number, tz: number, d: number, target: number) {
    const R = SIEGE.roles[u.role];
    u.shooting = this.time;
    const p = Math.max(0.15, Math.min(0.8, 0.82 - d / 70)) * (u.hero ? 1.15 : 1) * (u.role === "tank" ? 1.2 : 1);
    const hit = this.rng() < p;
    const dmg = R.dmg * u.power * (u.hero ? 1.2 : 1);
    this.events.push({ kind: "tracer", x0: u.x, z0: u.z, x1: tx + (hit ? 0 : (this.rng() - 0.5) * 3), z1: tz + (hit ? 0 : (this.rng() - 0.5) * 3), side: u.side, hero: u.hero, at: this.time });
    if (!hit) return;
    if (target === -2) this.hurtPlayer(dmg * SIEGE.player.dmgTaken);
    else {
      const t = this.units[target];
      // Lính khiên đỡ đạn trực diện
      this.damageUnit(t, t.role === "shield" ? dmg * 0.55 : dmg, u);
    }
  }

  damageUnit(t: Unit, dmg: number, by: Unit | "player" | null, crit = false) {
    if (!t.alive) return;
    t.hp -= dmg;
    t.hurtAt = this.time;
    const byPlayer = by === "player";
    const nearP = Math.hypot(t.x - this.player.x, t.z - this.player.z) < 40;
    if (byPlayer || nearP) this.events.push({ kind: "hit", x: t.x, z: t.z, dmg: Math.round(dmg), side: t.side, byPlayer, crit, at: this.time });
    if (t.hp <= 0) {
      t.alive = false;
      t.diedAt = this.time;
      this.events.push({ kind: "death", id: t.id, x: t.x, z: t.z, side: t.side, at: this.time });
      const killer = byPlayer ? "BẠN" : by ? by.name || (by.side === 0 ? "Hunter" : "IXO") : t.side === 0 ? "Pháo IXO" : "Hunter";
      if (byPlayer || t.hero || (by && by.hero) || nearP) this.events.push({ kind: "kill", killer, victim: t.name || (t.side === 0 ? "lính Hunter" : "quái IXO"), side: t.side, byPlayer, at: this.time });
      if (byPlayer) {
        this.player.kills++;
        // Chuỗi hạ gục: hạ liên tiếp trong 4 giây
        this.player.streak = this.time - this.player.streakAt < 4 ? this.player.streak + 1 : 1;
        this.player.streakAt = this.time;
        this.player.bestStreak = Math.max(this.player.bestStreak, this.player.streak);
        if (this.player.streak >= 2) this.events.push({ kind: "streak", n: this.player.streak, at: this.time });
      } else if (by) by.kills++;
      // Quân phe địch của người chơi gục gần người chơi / do người chơi hạ: rơi đồ
      if (t.side !== this.playerSide && (byPlayer || nearP)) this.dropLoot(t.x, t.z, t.hero ? SIEGE.loot.heroMul : 1, byPlayer ? 1 : 0.5);
    }
  }

  /** Rơi đồ tại (x, z): `mul` nhân xác suất, `chance` hệ số chung (quân đồng đội hạ thì ít hơn) */
  dropLoot(x: number, z: number, mul = 1, chance = 1) {
    const L = SIEGE.loot;
    const push = (kind: Drop["kind"], amount: number) => {
      const a = this.rng() * Math.PI * 2;
      const sp = 1.5 + this.rng() * 3;
      this.drops.push({ id: this.dropId++, kind, amount, x, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, y: 1.2, vy: 5 + this.rng() * 3, at: this.time, taken: false, ice: kind === "gear" && this.rng() < L.iceShare });
    };
    if (this.rng() < L.cred * chance) {
      const n = 1 + Math.floor(this.rng() * 2 * mul);
      for (let i = 0; i < n; i++) push("cred", Math.round(L.credAmt[0] + this.rng() * (L.credAmt[1] - L.credAmt[0])));
    }
    if (this.rng() < L.stim * mul * chance) push("stim", 1);
    if (this.rng() < L.key * mul * chance) push("key", 1);
    if (this.rng() < L.gear * mul * chance) push("gear", 1);
  }

  /** Đồ rơi: nảy lên rồi nằm trên tuyết, lại gần thì bay về người chơi và được nhặt */
  private updateDrops(dt: number) {
    const L = SIEGE.loot;
    const p = this.player;
    for (const d of this.drops) {
      if (d.taken) continue;
      if (d.y > 0 || d.vy > 0) {
        d.vy -= 22 * dt;
        d.y = Math.max(0, d.y + d.vy * dt);
        d.x += d.vx * dt;
        d.z += d.vz * dt;
        if (d.y === 0) (d.vy = d.vy < -3 ? -d.vy * 0.35 : 0), (d.vx *= 0.5), (d.vz *= 0.5);
      }
      if (!p.alive || this.time - d.at < 0.5) continue;
      const dist = Math.hypot(p.x - d.x, p.z - d.z);
      if (dist < L.magnet) {
        const k = Math.min(1, (14 * dt) / Math.max(dist, 0.01));
        d.x += (p.x - d.x) * k;
        d.z += (p.z - d.z) * k;
      }
      if (dist < L.pick) {
        d.taken = true;
        this.events.push({ kind: "loot", drop: d, at: this.time });
      }
    }
    this.drops = this.drops.filter((d) => !d.taken && this.time - d.at < L.life);
  }

  hurtPlayer(dmg: number) {
    if (!this.player.alive || this.time < this.player.invulnUntil) return;
    dmg *= SIEGE.stances[this.player.stance].taken;
    this.player.hp -= dmg;
    this.player.hurtAt = this.time;
    this.events.push({ kind: "playerHit", dmg, at: this.time });
    if (this.player.hp <= 0) {
      this.player.alive = false;
      this.player.deaths++;
      this.tickets[this.playerSide] = Math.max(0, this.tickets[this.playerSide] - 1);
    }
  }

  private healAround(u: Unit) {
    for (const o of this.units)
      if (o.alive && o.side === u.side && o.hp < o.maxHp && Math.abs(o.x - u.x) < 8 && Math.abs(o.z - u.z) < 8) o.hp = Math.min(o.maxHp, o.hp + SIEGE.healDps);
    if (u.side === this.playerSide && this.player.alive && Math.hypot(this.player.x - u.x, this.player.z - u.z) < 8) this.player.hp = Math.min(this.player.maxHp, this.player.hp + SIEGE.healDps * 0.5);
  }

  /** Quân rảnh tay: phe công phá máy phát / cổng / pháo / Boss gần đó; phe thủ (kỹ sư) sửa chữa */
  private workObjective(u: Unit, dt: number) {
    for (const o of this.objectives) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - u.x, o.z - u.z);
      const reach = o.kind === "gate" ? 9 : o.kind === "boss" ? 26 : o.kind === "cannon" ? 30 : 14;
      if (d > reach) continue;
      if (u.side === 0) {
        if (o.kind === "gate" && this.shieldUp) continue;
        const mul = u.role === "tank" ? 5 : u.role === "special" ? 3 : u.role === "ranged" && o.kind === "cannon" ? 2 : 1;
        o.hp -= SIEGE.objDps * u.power * mul * dt;
        if (this.time - u.shooting > 0.5) {
          u.shooting = this.time;
          this.events.push({ kind: "tracer", x0: u.x, z0: u.z, x1: o.x, z1: o.z, side: 0, hero: u.hero, at: this.time });
        }
        if (o.hp <= 0) this.destroy(o);
        return;
      }
      if ((u.role === "medic" || u.role === "special") && o.kind !== "boss" && o.hp < o.maxHp) {
        o.hp = Math.min(o.maxHp, o.hp + SIEGE.repairDps * dt);
        return;
      }
    }
  }

  /** Người chơi gây sát thương mục tiêu công trình (bắn trúng / húc bằng Mech) */
  damageObjective(o: Objective, dmg: number) {
    if (!o.alive) return;
    if (o.kind === "gate" && this.shieldUp) return;
    // Phe thủ không tự phá công trình của mình
    if (this.playerSide === 1) return;
    o.hp -= dmg;
    this.player.objDmg += dmg;
    if (o.hp <= 0) this.destroy(o);
  }

  private destroy(o: Objective) {
    o.alive = false;
    o.hp = 0;
    // Phá công trình (máy phát, cổng, pháo, Boss): mưa đồ
    if (this.playerSide === 0) for (let i = 0; i < (o.kind === "cannon" ? 5 : SIEGE.loot.shower); i++) this.dropLoot(o.x + (this.rng() - 0.5) * 4, o.z + 3 + (this.rng() - 0.5) * 4, o.kind === "boss" ? 4 : 2, 1);
    this.events.push({ kind: "boom", x: o.x, z: o.z, big: true, at: this.time });
    this.events.push({ kind: "objDown", obj: o.kind, i: o.i, at: this.time });
    if (o.kind === "gen") {
      const left = this.objectives.filter((x) => x.kind === "gen" && x.alive).length;
      this.callout(left ? `Máy phát khiên bị phá! Còn ${left}` : "KHIÊN NĂNG LƯỢNG ĐÃ SẬP! Tấn công cổng thành!", left ? "#7ff3ff" : "#ffd23d");
    } else if (o.kind === "gate") this.callout("CỔNG THÀNH ĐÃ VỠ! Chiếm 2 tháp canh trong sân", "#ffd23d");
    else if (o.kind === "boss") this.callout("BOSS MECH ĐÃ GỤC!", "#ffd23d");
    else if (o.kind === "cannon") this.callout("Pháo tường thành bị phá", "#9fe8ff");
  }

  private updateObjectives(dt: number) {
    // Pháo tường thành: bắn vào cụm quân tấn công đông nhất trong tầm, vùng nổ báo trước
    for (const o of this.objectives) {
      if (o.kind !== "cannon" || !o.alive) continue;
      const C = SIEGE.cannon;
      if ((this.time + o.i * 1.1) % C.every < dt) {
        let best: { x: number; z: number } | null = null;
        let bestN = 0;
        for (let k = 0; k < 8; k++) {
          const u = this.units[Math.floor(this.rng() * this.units.length)];
          if (!u.alive || u.side !== 0 || Math.hypot(u.x - o.x, u.z - o.z) > C.range || Math.hypot(u.x, u.z) < SIEGE.wall.r + 3) continue;
          let n = 0;
          for (const v of this.units) if (v.alive && v.side === 0 && Math.abs(v.x - u.x) < C.r && Math.abs(v.z - u.z) < C.r) n++;
          if (n > bestN) (bestN = n), (best = u);
        }
        if (this.playerSide === 0 && this.player.alive && this.rng() < 0.3 && Math.hypot(this.player.x - o.x, this.player.z - o.z) < C.range) best = this.player;
        if (best) this.warn("cannon", best.x, best.z, best.x, best.z, C.r, C.warn, C.dmg);
      }
    }
    const boss = this.boss;
    if (boss && boss.alive) this.updateBoss(boss, dt);
  }

  private warn(kind: Warn["kind"], x0: number, z0: number, x1: number, z1: number, r: number, warn: number, dmg: number, byPlayer = false) {
    this.warns.push({ kind, x0, z0, x1, z1, r, warnAt: this.time, liveAt: this.time + warn, dmg, done: false, byPlayer });
  }

  private inWarn(w: Warn, x: number, z: number) {
    if (w.kind === "laser") {
      const vx = w.x1 - w.x0;
      const vz = w.z1 - w.z0;
      const l = vx * vx + vz * vz || 1;
      const t = Math.max(0, Math.min(1, ((x - w.x0) * vx + (z - w.z0) * vz) / l));
      return Math.hypot(x - w.x0 - vx * t, z - w.z0 - vz * t) < w.r;
    }
    return Math.hypot(x - w.x0, z - w.z0) < w.r;
  }

  private updateWarns() {
    for (const w of this.warns) {
      if (w.done || this.time < w.liveAt) continue;
      w.done = true;
      this.events.push({ kind: "boom", x: w.x1, z: w.z1, big: w.kind !== "cannon", at: this.time });
      if (w.byPlayer) {
        // Kỹ năng của người chơi: trúng quân phe địch + công trình địch trong vùng
        for (const u of this.units) if (u.alive && u.side !== this.playerSide && this.inWarn(w, u.x, u.z)) this.damageUnit(u, w.dmg * (u.role === "tank" ? 0.6 : 1), "player", true);
        if (this.playerSide === 0) for (const o of this.objectives) if (o.alive && this.inWarn(w, o.x, o.z)) this.damageObjective(o, w.dmg * (o.kind === "boss" ? 1 : 0.8));
        continue;
      }
      // Pháo / Boss của phe IXO chỉ trúng quân tấn công; Bom Nova xoá sổ mọi quân Hunter trong vùng
      for (const u of this.units) if (u.alive && u.side === 0 && this.inWarn(w, u.x, u.z)) this.damageUnit(u, w.kind === "nova" ? 9999 : w.dmg, null);
      if (this.playerSide === 0 && this.player.alive && this.inWarn(w, this.player.x, this.player.z)) {
        if (w.kind === "nova") {
          // Có Extra Coin thì sống sót (cảnh bom trong phim)
          if (this.player.extraCoin) {
            this.player.extraCoin = false;
            this.player.hp = 25;
            this.player.invulnUntil = this.time + 3;
            this.callout("EXTRA COIN cứu bạn khỏi Bom Nova!", "#ffd23d");
          } else this.hurtPlayer(9999);
        } else this.hurtPlayer(w.dmg);
      }
    }
    this.warns = this.warns.filter((w) => !w.done || this.time - w.liveAt < 1);
  }

  private updateBoss(b: Objective, dt: number) {
    const B = SIEGE.boss;
    // Đi về phía cụm quân tấn công gần Lõi Thành
    let tx = SIEGE.core.x;
    let tz = SIEGE.core.z + 6;
    let bd = 1e9;
    for (const u of this.units) {
      if (!u.alive || u.side !== 0) continue;
      const d = Math.hypot(u.x - b.x, u.z - b.z);
      if (d < bd && Math.hypot(u.x, u.z) < SIEGE.wall.r) (bd = d), (tx = u.x), (tz = u.z);
    }
    if (this.playerSide === 0 && this.player.alive && Math.hypot(this.player.x - b.x, this.player.z - b.z) < bd + 4) {
      tx = this.player.x;
      tz = this.player.z;
    }
    const d = Math.hypot(tx - b.x, tz - b.z);
    if (d > 6) {
      b.x += ((tx - b.x) / d) * B.speed * dt;
      b.z += ((tz - b.z) / d) * B.speed * dt;
    }
    this.bossThink -= dt;
    if (this.bossThink <= 0) {
      this.bossThink = B.stompEvery;
      this.warn("stomp", b.x + ((tx - b.x) / (d || 1)) * 4, b.z + ((tz - b.z) / (d || 1)) * 4, b.x, b.z, B.stompR, B.stompWarn, B.stompDmg);
      if (Math.floor(this.time / B.laserEvery) !== Math.floor((this.time - B.stompEvery) / B.laserEvery)) {
        const ux = (tx - b.x) / (d || 1);
        const uz = (tz - b.z) / (d || 1);
        this.warn("laser", b.x, b.z, b.x + ux * B.laserLen, b.z + uz * B.laserLen, B.laserW, B.laserWarn, B.laserDmg);
      }
    }
  }

  private updatePhase(dt: number) {
    const was = this.phase;
    if (this.phase === "charge" && (this.time > SIEGE.chargeTime || !this.shieldUp || this.units.some((u) => u.alive && u.side === 0 && u.z < 100))) this.phase = "shield";
    if (this.phase === "shield" && !this.shieldUp) this.phase = "gate";
    if (this.phase === "gate" && this.gateOpen) this.phase = "courtyard";
    if (this.phase === "courtyard") {
      for (const i of [0, 1]) {
        if (this.towerTaken[i]) continue;
        const t = SIEGE.towers[i];
        let a = 0;
        let d = 0;
        for (const u of this.units) if (u.alive && Math.hypot(u.x - t.x, u.z - t.z) < SIEGE.towerR) u.side === 0 ? a++ : d++;
        if (this.player.alive && Math.hypot(this.player.x - t.x, this.player.z - t.z) < SIEGE.towerR) this.playerSide === 0 ? (a += 3) : (d += 3);
        this.towerProgress[i] = Math.max(0, Math.min(1, this.towerProgress[i] + (a - d) * SIEGE.captureRate * dt));
        if (this.towerProgress[i] >= 1) {
          this.towerTaken[i] = true;
          if (this.playerSide === 0 && Math.hypot(this.player.x - t.x, this.player.z - t.z) < SIEGE.towerR) this.player.captures++;
          this.callout(`Đã chiếm Tháp canh ${i === 0 ? "Trái" : "Phải"}!`, "#7ff3ff");
        }
      }
      if (this.towerTaken[0] && this.towerTaken[1]) this.phase = "core";
    }
    if (this.phase === "core") {
      if (was !== "core") {
        this.objectives.push({ kind: "boss", i: 0, x: 0, z: -13, hp: SIEGE.boss.hp, maxHp: SIEGE.boss.hp, alive: true });
        this.bossThink = 3;
      }
      const C = SIEGE.core;
      let a = 0;
      let d = 0;
      for (const u of this.units) if (u.alive && Math.hypot(u.x - C.x, u.z - C.z) < C.r) u.side === 0 ? a++ : d++;
      if (this.player.alive && Math.hypot(this.player.x - C.x, this.player.z - C.z) < C.r) this.playerSide === 0 ? (a += 3) : (d += 3);
      if (a > d) this.coreHold += dt;
      else if (d > a) this.coreHold = Math.max(0, this.coreHold - dt * 0.5);
      // Bom Nova: phe IXO dùng một lần khi Lõi Thành bị giữ quá nửa thời gian
      if (!this.novaUsed && this.coreHold >= SIEGE.nova.at) {
        this.novaUsed = true;
        this.novaAt = this.time;
        this.warn("nova", C.x, C.z, C.x, C.z, SIEGE.nova.r, SIEGE.nova.warn, 9999);
        this.callout("IXO KÍCH HOẠT BOM NOVA! Chạy khỏi vùng trắng!", "#ff4f7a");
      }
      if (this.coreHold >= C.hold) this.finish(0, "Hunter đã chiếm Lõi Thành!");
    }
    if (was !== this.phase && this.phase !== "end") {
      const text: Record<Phase, string> = {
        charge: "",
        shield: "PHÁ KHIÊN: phá cả 3 Máy phát khiên năng lượng",
        gate: "PHÁ CỔNG: dồn quân / biến hình Mech húc tung cổng thành",
        courtyard: "SÂN TRONG: chiếm 2 tháp canh",
        core: "LÕI THÀNH: giữ vùng Lõi 60 giây! BOSS MECH xuất hiện",
        end: "",
      };
      this.callout(text[this.phase], "#ffd23d");
    }
    if (this.phase !== "end") {
      if (this.time >= SIEGE.duration) this.finish(1, "Hết giờ: Thành Băng đứng vững");
      else if (this.tickets[0] <= 0 && this.alive(0) === 0 && !this.player.alive) this.finish(1, "Phe Hunter hết Vé quân");
      else if (this.tickets[1] <= 0 && this.alive(1) === 0) this.finish(0, "Phe IXO hết Vé quân");
    }
  }

  private finish(winner: Side, why: string) {
    this.winner = winner;
    this.phase = "end";
    this.callout(why, winner === 0 ? "#7ff3ff" : "#ff4fd8");
  }

  callout(text: string, color: string) {
    this.events.push({ kind: "callout", text, color, at: this.time });
  }

  // ------------------------------------------------------------------ người chơi: thế đánh & kỹ năng

  /** Đổi thế (Xạ thủ → Cận chiến → Tanker): máu tối đa đổi theo, giữ nguyên tỉ lệ máu hiện có */
  setStance(st: Stance) {
    const P = this.player;
    if (st === P.stance || this.time - P.stanceAt < SIEGE.stanceCd) return false;
    const frac = P.hp / P.maxHp;
    P.stance = st;
    P.stanceAt = this.time;
    P.maxHp = SIEGE.player.hp * SIEGE.stances[st].hpMul;
    P.hp = Math.max(1, frac * P.maxHp);
    this.callout(`Thế ${SIEGE.stances[st].label}`, st === "tank" ? "#ffb000" : st === "melee" ? "#ff6a2a" : "#7ff3ff");
    return true;
  }

  /** Chém kiếm (Cận chiến, quạt trước mặt) / dậm đất (Tanker, quanh thân) */
  playerSlash(yaw: number) {
    const P = this.player;
    const S = SIEGE.slash;
    if (!P.alive || this.time - P.slashAt < S.cd || P.stance === "gunner") return false;
    P.slashAt = this.time;
    const tank = P.stance === "tank";
    const range = tank ? S.tankRange : S.range;
    const dmg = tank ? S.tankDmg : S.dmg;
    let hits = 0;
    for (const u of this.units) {
      if (!u.alive || u.side === this.playerSide) continue;
      const dx = u.x - P.x;
      const dz = u.z - P.z;
      const d = Math.hypot(dx, dz);
      if (d > range + (u.role === "tank" ? 2 : 0)) continue;
      if (!tank) {
        const a = Math.atan2(dx, dz) - yaw;
        if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > S.arc / 2) continue;
      }
      const crit = this.rng() < 0.2;
      this.damageUnit(u, dmg * (crit ? 1.8 : 1), "player", crit);
      // Đánh bật lùi
      const k = (tank ? 3 : 1.6) / (d || 1);
      u.x += dx * k;
      u.z += dz * k;
      hits++;
    }
    if (this.playerSide === 0)
      for (const o of this.objectives) if (o.alive && Math.hypot(o.x - P.x, o.z - P.z) < range + (o.kind === "boss" ? 4 : o.kind === "gate" ? 6 : 3)) this.damageObjective(o, dmg * 1.5);
    this.events.push({ kind: "melee", x: P.x + Math.sin(yaw) * 2, z: P.z + Math.cos(yaw) * 2, side: this.playerSide, at: this.time });
    return hits;
  }

  /** Dùng kỹ năng nhắm vào (ax, az): trả về true nếu dùng được (hết hồi chiêu) */
  useSkill(sk: Skill, ax: number, az: number) {
    const P = this.player;
    const K = SIEGE.skills[sk];
    if (!P.alive || P.cds[sk] > this.time) return false;
    P.cds[sk] = this.time + K.cd;
    if (sk === "grenade") {
      this.warn("grenade", ax, az, ax, az, K.r!, K.fuse!, K.dmg, true);
      const w = this.warns[this.warns.length - 1];
      w.fromX = P.x;
      w.fromZ = P.z;
    }
    else if (sk === "orbital") this.warn("orbital", ax, az, ax, az, K.r!, K.warn!, K.dmg, true);
    else if (sk === "missiles") {
      const targets = this.units
        .filter((u) => u.alive && u.side !== this.playerSide && Math.hypot(u.x - P.x, u.z - P.z) < K.range!)
        .sort((a, b) => (b.role === "tank" ? 1 : 0) - (a.role === "tank" ? 1 : 0) || Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))
        .slice(0, K.n!);
      targets.forEach((u, i) => this.missiles.push({ x0: P.x, z0: P.z, id: u.id, at: this.time + i * 0.06, hitAt: this.time + K.delay! + i * 0.06 }));
    } else if (sk === "shockwave") {
      const tank = P.stance === "tank";
      const r = K.r! * (tank ? 1.3 : 1);
      for (const u of this.units) {
        if (!u.alive || u.side === this.playerSide) continue;
        const dx = u.x - P.x;
        const dz = u.z - P.z;
        const d = Math.hypot(dx, dz);
        if (d > r) continue;
        this.damageUnit(u, K.dmg * (tank ? 1.7 : 1), "player", true);
        const k = K.push! / (d || 1);
        u.x += dx * k * 0.3;
        u.z += dz * k * 0.3;
        // Tanker khiêu khích: quái quanh đó dồn đánh người chơi (đồng đội rảnh tay)
        if (tank) u.target = -2;
      }
      this.events.push({ kind: "boom", x: P.x, z: P.z, big: true, at: this.time });
    }
    return true;
  }

  private updateMissiles() {
    for (const m of this.missiles) {
      if (this.time < m.hitAt) continue;
      const u = this.units[m.id];
      if (u.alive) {
        this.damageUnit(u, SIEGE.skills.missiles.dmg * (u.role === "tank" ? 1.5 : 1), "player", true);
        this.events.push({ kind: "boom", x: u.x, z: u.z, big: false, at: this.time });
      }
      m.hitAt = Infinity;
    }
    this.missiles = this.missiles.filter((m) => m.hitAt !== Infinity || this.time - m.at < 0.1);
  }

  /** Mục tiêu hiện tại để HUD / mũi tên chỉ hướng */
  currentGoal(): { x: number; z: number; label: string } {
    const att = this.playerSide === 0;
    if (this.phase === "charge" || this.phase === "shield") {
      const g = this.objectives.filter((o) => o.kind === "gen" && o.alive).sort((a, b) => Math.hypot(a.x - this.player.x, a.z - this.player.z) - Math.hypot(b.x - this.player.x, b.z - this.player.z))[0];
      if (g) return { x: g.x, z: g.z, label: att ? "Phá máy phát khiên" : "Giữ máy phát khiên" };
    }
    if (this.phase === "gate") return { x: SIEGE.gate.x, z: SIEGE.gate.z, label: att ? "Phá cổng thành" : "Giữ cổng thành" };
    if (this.phase === "courtyard") {
      const i = this.towerTaken[0] ? 1 : 0;
      return { x: SIEGE.towers[i].x, z: SIEGE.towers[i].z, label: att ? "Chiếm tháp canh" : "Giữ tháp canh" };
    }
    return { x: SIEGE.core.x, z: SIEGE.core.z, label: att ? "Giữ Lõi Thành" : "Đẩy lùi khỏi Lõi Thành" };
  }

  /** Tia đạn của người chơi: quân địch / công trình đầu tiên trên đường đạn (mặt phẳng ngang, thân trụ cao ~2 m) */
  rayHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number) {
    const hl = Math.hypot(dx, dz) || 1;
    let best: { t: number; unit?: Unit; obj?: Objective } | null = null;
    const test = (x: number, z: number, r: number, h: number) => {
      // Khoảng cách gần nhất trên mặt phẳng ngang, rồi kiểm tra độ cao tại điểm đó
      const t = ((x - ox) * dx + (z - oz) * dz) / (hl * hl);
      if (t < 0 || t * hl > range) return -1;
      const px = ox + dx * t - x;
      const pz = oz + dz * t - z;
      const y = oy + dy * t;
      if (px * px + pz * pz > r * r || y < -0.5 || y > h) return -1;
      return t * Math.hypot(dx, dy, dz);
    };
    for (const u of this.units) {
      if (!u.alive || u.side === this.playerSide) continue;
      const t = test(u.x, u.z, 0.75, 2.1);
      if (t >= 0 && (!best || t < best.t)) best = { t, unit: u };
    }
    for (const o of this.objectives) {
      if (!o.alive) continue;
      const r = o.kind === "boss" ? 4 : o.kind === "gate" ? 6 : o.kind === "gen" ? 2.6 : 2.2;
      const h = o.kind === "boss" ? 12 : o.kind === "gate" ? 14 : o.kind === "gen" ? 9 : 16;
      const t = test(o.x, o.z, r, h);
      if (t >= 0 && (!best || t < best.t)) best = { t, obj: o };
    }
    return best;
  }

  /** Điểm đóng góp và hạng S/A/B/C cuối trận */
  score() {
    const p = this.player;
    const pts = p.kills * 10 + Math.round(p.objDmg / 20) + p.captures * 60 + (this.winner === this.playerSide ? 100 : 0) - p.deaths * 5;
    const rank = pts >= 400 ? "S" : pts >= 220 ? "A" : pts >= 100 ? "B" : "C";
    return { pts: Math.max(0, pts), rank };
  }
}
