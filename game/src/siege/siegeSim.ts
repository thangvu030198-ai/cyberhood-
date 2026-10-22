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
export type Role = "infantry" | "shield" | "ranged" | "medic" | "special";
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
  } as Record<Role, { hp: number; dmg: number; range: number; keep: number; cd: number; speed: number }>,
  /** Quân đánh mục tiêu (máy phát / cổng / pháo) mỗi giây; quân đặc biệt (phá khiên) mạnh gấp 3 */
  objDps: 5,
  repairDps: 3.5,
  healDps: 6,
  player: { hp: 100 },
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
};

export type Objective = { kind: "gen" | "gate" | "cannon" | "boss"; i: number; x: number; z: number; hp: number; maxHp: number; alive: boolean };

export type Warn = { kind: "cannon" | "stomp" | "laser" | "nova"; x0: number; z0: number; x1: number; z1: number; r: number; warnAt: number; liveAt: number; dmg: number; done: boolean };

export type SiegeEvent =
  | { kind: "tracer"; x0: number; z0: number; x1: number; z1: number; side: Side; hero: boolean; at: number }
  | { kind: "boom"; x: number; z: number; big: boolean; at: number }
  | { kind: "death"; id: number; x: number; z: number; side: Side; at: number }
  | { kind: "callout"; text: string; color: string; at: number }
  | { kind: "playerHit"; dmg: number; at: number }
  | { kind: "objDown"; obj: Objective["kind"]; i: number; at: number };

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
  player = { x: 0, z: 0, alive: true, hp: SIEGE.player.hp, extraCoin: false, kills: 0, objDmg: 0, captures: 0, deaths: 0, inMech: false, invulnUntil: -9 };
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
        const role: Role = r < 0.55 ? "infantry" : r < 0.7 ? "shield" : r < 0.85 ? "ranged" : r < 0.93 ? "medic" : "special";
        const hero = i < heroes;
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
    this.player.hp = SIEGE.player.hp;
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
      if (d * 0.8 < bd) best = -2;
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
        if (d > R.keep) {
          gx = tx;
          gz = tz;
        } else {
          gx = u.x;
          gz = u.z;
        }
        u.yaw = Math.atan2(tx - u.x, tz - u.z);
        if (u.cd <= 0 && d < R.range) {
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
    const p = Math.max(0.15, Math.min(0.8, 0.82 - d / 70)) * (u.hero ? 1.15 : 1);
    const hit = this.rng() < p;
    const dmg = R.dmg * u.power * (u.hero ? 1.2 : 1);
    this.events.push({ kind: "tracer", x0: u.x, z0: u.z, x1: tx + (hit ? 0 : (this.rng() - 0.5) * 3), z1: tz + (hit ? 0 : (this.rng() - 0.5) * 3), side: u.side, hero: u.hero, at: this.time });
    if (!hit) return;
    if (target === -2) this.hurtPlayer(dmg * 0.45);
    else {
      const t = this.units[target];
      // Lính khiên đỡ đạn trực diện
      this.damageUnit(t, t.role === "shield" ? dmg * 0.55 : dmg, u);
    }
  }

  damageUnit(t: Unit, dmg: number, by: Unit | "player" | null) {
    if (!t.alive) return;
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.alive = false;
      t.diedAt = this.time;
      this.events.push({ kind: "death", id: t.id, x: t.x, z: t.z, side: t.side, at: this.time });
      if (by === "player") this.player.kills++;
      else if (by) by.kills++;
    }
  }

  hurtPlayer(dmg: number) {
    if (!this.player.alive || this.time < this.player.invulnUntil) return;
    this.player.hp -= dmg;
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
    if (u.side === this.playerSide && this.player.alive && Math.hypot(this.player.x - u.x, this.player.z - u.z) < 8) this.player.hp = Math.min(SIEGE.player.hp, this.player.hp + SIEGE.healDps * 0.5);
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
        const mul = u.role === "special" ? 3 : u.role === "ranged" && o.kind === "cannon" ? 2 : 1;
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

  private warn(kind: Warn["kind"], x0: number, z0: number, x1: number, z1: number, r: number, warn: number, dmg: number) {
    this.warns.push({ kind, x0, z0, x1, z1, r, warnAt: this.time, liveAt: this.time + warn, dmg, done: false });
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
