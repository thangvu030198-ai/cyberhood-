// Đua kart camera sau lưng (học từ Chocobo Racing / Crash Team Racing PS1): vòng đua kín 3 vòng, 6 xe,
// tấm tăng tốc, hộp vật phẩm (turbo / tên lửa), xếp hạng theo thời gian thực. Thuần TypeScript, có test.
// Xe chạy trong toạ độ đường đua: s = quãng đường dọc tâm đường, d = lệch ngang so với tâm (âm = trái).

export type KartInput = { left: boolean; right: boolean; gas: boolean; brake: boolean; item: boolean };
export const NO_KART: KartInput = { left: false, right: false, gas: false, brake: false, item: false };

export const KART = {
  step: 1 / 60,
  laps: 3,
  introTime: 3,
  halfWidth: 5,
  maxSpeed: 26,
  accel: 14,
  brake: 26,
  drag: 0.35,
  /** Tốc độ trượt ngang khi đánh lái (m/s), giảm khi chạy chậm */
  steer: 9,
  /** Va vách: tốc độ còn lại */
  wallKeep: 0.55,
  boostSpeed: 36,
  boostTime: 1.2,
  /** Trúng tên lửa: tốc độ còn lại và thời gian xoay vòng */
  spinKeep: 0.2,
  spinTime: 1.1,
  missileSpeed: 48,
  /** AI: tốc độ mục tiêu so với tối đa (mỗi xe khác nhau một chút) */
  aiSpeed: [0.86, 0.9, 0.93, 0.88, 0.95] as number[],
  /** Bám đuôi (rubber band): xe tụt xa người chơi chạy nhanh hơn một chút */
  rubber: 0.12,
};

export type Kart = {
  id: number;
  s: number;
  d: number;
  v: number;
  lap: number;
  /** Đi lùi ngang qua vạch đích không tính vòng */
  bestS: number;
  boostUntil: number;
  spinUntil: number;
  item: "turbo" | "missile" | null;
  finishedAt: number | null;
  /** Lệch ngang mong muốn của AI */
  lane: number;
  ai: boolean;
};

export type KartPad = { s: number; d: number; kind: "boost" | "item"; takenUntil: number };
export type Missile = { s: number; d: number; owner: number; life: number };

/** Đường đua: đường cong Catmull-Rom kín qua các điểm điều khiển (x, z), lấy mẫu đều mỗi `step` mét */
export class Track {
  readonly pts: { x: number; z: number }[] = [];
  readonly tan: { x: number; z: number }[] = [];
  readonly cum: number[] = [];
  readonly length: number;
  readonly step = 1;

  constructor(ctrl: [number, number][]) {
    const n = ctrl.length;
    const dense: { x: number; z: number }[] = [];
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n];
      const p1 = ctrl[i];
      const p2 = ctrl[(i + 1) % n];
      const p3 = ctrl[(i + 2) % n];
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        dense.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    // Lấy mẫu lại cách đều theo độ dài
    let acc = 0;
    let next = 0;
    for (let i = 0; i < dense.length; i++) {
      const a = dense[i];
      const b = dense[(i + 1) % dense.length];
      const seg = Math.hypot(b.x - a.x, b.z - a.z);
      while (next <= acc + seg) {
        const u = (next - acc) / seg;
        this.pts.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u });
        this.cum.push(next);
        next += this.step;
      }
      acc += seg;
    }
    this.length = acc;
    for (let i = 0; i < this.pts.length; i++) {
      const a = this.pts[(i - 1 + this.pts.length) % this.pts.length];
      const b = this.pts[(i + 1) % this.pts.length];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      this.tan.push({ x: (b.x - a.x) / l, z: (b.z - a.z) / l });
    }
  }

  wrap(s: number) {
    return ((s % this.length) + this.length) % this.length;
  }

  /** Toạ độ thế giới (x, z) và hướng (góc quay quanh trục đứng) của điểm (s, d) */
  at(s: number, d: number) {
    const u = this.wrap(s) / this.step;
    const i = Math.floor(u) % this.pts.length;
    const j = (i + 1) % this.pts.length;
    const f = u - Math.floor(u);
    const p = { x: this.pts[i].x + (this.pts[j].x - this.pts[i].x) * f, z: this.pts[i].z + (this.pts[j].z - this.pts[i].z) * f };
    const t = this.tan[i];
    // Pháp tuyến phải của hướng chạy (t.x, t.z) trên mặt phẳng XZ
    const nx = -t.z;
    const nz = t.x;
    return { x: p.x + nx * d, z: p.z + nz * d, yaw: Math.atan2(t.x, t.z) };
  }

  /** Độ cong (rad/m) quanh s, dùng cho AI giảm tốc ở khúc cua */
  curvature(s: number) {
    const a = this.at(s - 4, 0).yaw;
    const b = this.at(s + 4, 0).yaw;
    return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))) / 8;
  }
}

/** Đường đua Neon Loop: hình chữ L bo tròn có khúc cua tay áo, dài ~600 m */
export const NEON_LOOP: [number, number][] = [
  [0, 0],
  [60, -10],
  [110, 10],
  [130, 60],
  [100, 100],
  [60, 90],
  [40, 130],
  [-10, 150],
  [-60, 120],
  [-70, 60],
  [-40, 20],
];

export type KartStatus = "intro" | "race" | "finished";

export class KartSim {
  readonly track = new Track(NEON_LOOP);
  time = 0;
  status: KartStatus = "intro";
  karts: Kart[];
  pads: KartPad[] = [];
  missiles: Missile[] = [];
  events: { kind: "boost" | "item" | "hit" | "lap" | "finish" | "wall"; kart: number; at: number }[] = [];
  private prev: KartInput = NO_KART;
  private acc = 0;

  constructor() {
    // Lưới xuất phát: 2 hàng sau vạch, người chơi ở cuối (vượt lên cho có không khí)
    this.karts = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      s: this.track.length - 4 - Math.floor(i / 2) * 5,
      d: i % 2 === 0 ? -2.2 : 2.2,
      v: 0,
      lap: 0,
      bestS: 0,
      boostUntil: -9,
      spinUntil: -9,
      item: null,
      finishedAt: null,
      lane: (i % 3) - 1,
      ai: i !== 5,
    }));
    const L = this.track.length;
    for (const f of [0.18, 0.47, 0.8]) this.pads.push({ s: L * f, d: 0, kind: "boost", takenUntil: -9 });
    for (const f of [0.3, 0.62, 0.92]) for (const d of [-3, 0, 3]) this.pads.push({ s: L * f, d, kind: "item", takenUntil: -9 });
  }

  get player() {
    return this.karts[5];
  }

  /** Quãng đường đã đi (để xếp hạng): vòng × chiều dài + s */
  progress(k: Kart) {
    return k.lap * this.track.length + (k.lap === 0 && k.s > this.track.length / 2 ? k.s - this.track.length : k.s);
  }

  /** Thứ hạng hiện tại (1 = dẫn đầu) */
  rank(k: Kart) {
    const order = [...this.karts].sort((a, b) => {
      if (a.finishedAt !== null || b.finishedAt !== null) return (a.finishedAt ?? 1e9) - (b.finishedAt ?? 1e9);
      return this.progress(b) - this.progress(a);
    });
    return order.indexOf(k) + 1;
  }

  update(dt: number, input: KartInput) {
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= KART.step) {
      this.acc -= KART.step;
      this.step(input);
    }
  }

  step(input: KartInput) {
    const dt = KART.step;
    this.time += dt;
    if (this.status === "intro") {
      if (this.time >= KART.introTime) this.status = "race";
      this.prev = input;
      return;
    }
    const pf = this.progress(this.player);
    for (const k of this.karts) {
      const ctrl = k.ai ? this.aiInput(k, pf) : k.finishedAt !== null ? NO_KART : input;
      this.drive(k, ctrl, dt, k.ai ? NO_KART : this.prev);
    }
    this.updateMissiles(dt);
    if (this.player.finishedAt !== null && this.status === "race") {
      this.status = "finished";
      this.events.push({ kind: "finish", kart: 5, at: this.time });
    }
    this.prev = input;
  }

  private drive(k: Kart, c: KartInput, dt: number, prev: KartInput) {
    const t = this.time;
    const spinning = t < k.spinUntil;
    const boosting = t < k.boostUntil;
    const top = boosting ? KART.boostSpeed : KART.maxSpeed;
    if (spinning) k.v *= 0.96;
    else if (c.gas) k.v = Math.min(top, k.v + KART.accel * dt);
    else if (c.brake) k.v = Math.max(-5, k.v - KART.brake * dt);
    k.v -= k.v * KART.drag * dt;
    if (boosting) k.v = Math.max(k.v, KART.boostSpeed * 0.92);
    // Đánh lái: trượt ngang, nhạy hơn khi chạy nhanh
    const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
    if (!spinning) k.d += dir * KART.steer * Math.min(1, Math.abs(k.v) / 10) * dt;
    if (Math.abs(k.d) > KART.halfWidth) {
      k.d = Math.sign(k.d) * KART.halfWidth;
      k.v *= KART.wallKeep ** (dt * 6);
      if (!k.ai) this.events.push({ kind: "wall", kart: k.id, at: t });
    }
    const before = k.s;
    k.s = this.track.wrap(k.s + k.v * dt);
    // Qua vạch đích (s quay về 0) khi đang tiến: tính vòng
    if (k.v > 0 && before > this.track.length - 30 && k.s < 30) {
      k.lap++;
      if (k.lap > KART.laps && k.finishedAt === null) k.finishedAt = t;
      else if (!k.ai) this.events.push({ kind: "lap", kart: k.id, at: t });
    }
    // Tấm tăng tốc / hộp vật phẩm
    for (const p of this.pads) {
      if (t < p.takenUntil) continue;
      const ds = Math.abs(this.track.wrap(k.s - p.s + this.track.length / 2) - this.track.length / 2);
      if (ds > 1.6 || Math.abs(k.d - p.d) > 1.6) continue;
      if (p.kind === "boost") {
        k.boostUntil = t + KART.boostTime;
        this.events.push({ kind: "boost", kart: k.id, at: t });
      } else if (!k.item) {
        k.item = (k.id * 7 + Math.floor(t * 10)) % 3 === 0 ? "missile" : "turbo";
        p.takenUntil = t + 3;
        this.events.push({ kind: "item", kart: k.id, at: t });
      }
    }
    if (c.item && !prev.item && k.item) {
      if (k.item === "turbo") {
        k.boostUntil = t + KART.boostTime * 1.5;
        this.events.push({ kind: "boost", kart: k.id, at: t });
      } else this.missiles.push({ s: k.s + 2, d: k.d, owner: k.id, life: 4 });
      k.item = null;
    }
  }

  /** Tên lửa bay dọc đường, tự lái về phía xe gần nhất phía trước */
  private updateMissiles(dt: number) {
    for (const m of this.missiles) {
      m.s = this.track.wrap(m.s + KART.missileSpeed * dt);
      m.life -= dt;
      let best: Kart | null = null;
      let bestAhead = 60;
      for (const k of this.karts) {
        if (k.id === m.owner) continue;
        const ahead = this.track.wrap(k.s - m.s);
        if (ahead < bestAhead) {
          bestAhead = ahead;
          best = k;
        }
      }
      if (best) m.d += Math.sign(best.d - m.d) * Math.min(Math.abs(best.d - m.d), 8 * dt);
      for (const k of this.karts) {
        if (k.id === m.owner || m.life <= 0) continue;
        const ds = Math.abs(this.track.wrap(k.s - m.s + this.track.length / 2) - this.track.length / 2);
        if (ds < 1.5 && Math.abs(k.d - m.d) < 1.4) {
          k.v *= KART.spinKeep;
          k.spinUntil = this.time + KART.spinTime;
          m.life = 0;
          this.events.push({ kind: "hit", kart: k.id, at: this.time });
        }
      }
    }
    this.missiles = this.missiles.filter((m) => m.life > 0);
  }

  /** AI: ga đều, giảm tốc ở khúc cua gắt, bám làn riêng, dùng vật phẩm ngay khi có */
  private aiInput(k: Kart, playerProgress: number): KartInput {
    if (k.finishedAt !== null) return NO_KART;
    const curve = this.track.curvature(k.s + 12);
    const behind = Math.max(-1, Math.min(1, (playerProgress - this.progress(k)) / 80));
    const target = KART.maxSpeed * KART.aiSpeed[k.id] * (1 + behind * KART.rubber) * (curve > 0.05 ? 0.78 : 1);
    const lane = k.lane * 2.5 + Math.sin(this.time * 0.3 + k.id) * 0.8;
    return {
      gas: k.v < target,
      brake: k.v > target + 4,
      left: k.d > lane + 0.3,
      right: k.d < lane - 0.3,
      item: k.item !== null && Math.floor(this.time * 2 + k.id) % 4 === 0,
    };
  }
}
