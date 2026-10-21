// Đối kháng 1 chọi 1 trên sàn đấu (học từ Bloody Roar 2 / Tekken PS1): nhìn ngang, hai thanh máu, đồng hồ đếm,
// đấm nhanh, đá mạnh, đỡ đòn, nhảy, combo 3 đòn. Thuần TypeScript, bước cố định 1/60 giây, có test.

export type DuelInput = { left: boolean; right: boolean; jump: boolean; block: boolean; punch: boolean; kick: boolean };
export const NO_DUEL: DuelInput = { left: false, right: false, jump: false, block: false, punch: false, kick: false };

export const DUEL = {
  step: 1 / 60,
  arenaHalf: 9,
  roundTime: 60,
  introTime: 1.5,
  /** Hai người đứng cách nhau tối thiểu (thân không chồng lên nhau) */
  bodyGap: 1.1,
  walk: 3.2,
  jumpVel: 9,
  gravity: 28,
  maxHp: 100,
  /** Đòn: thời gian ra đòn (startup), đòn trúng trong `active`, hồi đòn `recover`, tầm, sát thương, đẩy lùi */
  moves: {
    punch: { startup: 0.08, active: 0.08, recover: 0.16, reach: 1.35, damage: 6, push: 1.5 },
    kick: { startup: 0.18, active: 0.1, recover: 0.3, reach: 1.7, damage: 11, push: 3.2 },
  },
  /** Đòn thứ 3 liên tiếp trong combo mạnh gấp rưỡi */
  comboWindow: 0.45,
  comboBonus: 1.5,
  /** Đỡ đòn: chỉ nhận phần này sát thương */
  blockChip: 0.15,
  hitStun: 0.32,
  /** AI: độ trễ phản ứng và xác suất đỡ khi bị đánh */
  ai: { think: 0.28, blockChance: 0.35, aggression: 0.65 },
};

type MoveId = keyof typeof DUEL.moves;

export type Fighter = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  /** Đòn đang ra và thời điểm bắt đầu */
  move: MoveId | null;
  moveAt: number;
  moveHit: boolean;
  blocking: boolean;
  stunUntil: number;
  combo: number;
  lastHitAt: number;
  /** Lần cuối bị trúng đòn (cho hiệu ứng nháy) */
  hurtAt: number;
};

export type DuelStatus = "intro" | "fight" | "won" | "lost" | "draw";

const fighter = (x: number, facing: 1 | -1): Fighter => ({
  x,
  y: 0,
  vx: 0,
  vy: 0,
  facing,
  hp: DUEL.maxHp,
  move: null,
  moveAt: -9,
  moveHit: false,
  blocking: false,
  stunUntil: -9,
  combo: 0,
  lastHitAt: -9,
  hurtAt: -9,
});

export class DuelSim {
  time = 0;
  status: DuelStatus = "intro";
  player = fighter(-3, 1);
  foe = fighter(3, -1);
  /** Sự kiện cho hiển thị / âm thanh */
  events: { kind: "hit" | "block" | "whiff" | "ko"; who: "player" | "foe"; x: number; at: number; move?: MoveId }[] = [];
  private prev: DuelInput = NO_DUEL;
  private acc = 0;
  private aiNext = 0;
  private aiIntent: DuelInput = NO_DUEL;
  private rng: () => number;

  constructor(seed = 1) {
    let s = seed >>> 0 || 1;
    this.rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  get timeLeft() {
    return Math.max(0, DUEL.roundTime - Math.max(0, this.time - DUEL.introTime));
  }

  update(dt: number, input: DuelInput) {
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= DUEL.step) {
      this.acc -= DUEL.step;
      this.step(input);
    }
  }

  step(input: DuelInput) {
    const dt = DUEL.step;
    this.time += dt;
    if (this.status === "intro") {
      if (this.time >= DUEL.introTime) this.status = "fight";
      this.prev = input;
      return;
    }
    if (this.status !== "fight") return;
    this.control(this.player, this.foe, input, this.prev);
    const ai = this.think();
    this.control(this.foe, this.player, ai.now, ai.prev);
    for (const [a, b, who] of [
      [this.player, this.foe, "foe"],
      [this.foe, this.player, "player"],
    ] as const)
      this.resolve(a, b, who);
    this.physics(dt);
    if (this.player.hp <= 0 || this.foe.hp <= 0) {
      this.status = this.foe.hp <= 0 ? "won" : "lost";
      this.events.push({ kind: "ko", who: this.foe.hp <= 0 ? "foe" : "player", x: 0, at: this.time });
    } else if (this.timeLeft <= 0) {
      const p = this.player.hp;
      const f = this.foe.hp;
      this.status = p > f ? "won" : p < f ? "lost" : "draw";
    }
    this.prev = input;
  }

  private control(f: Fighter, other: Fighter, input: DuelInput, prev: DuelInput) {
    const stunned = this.time < f.stunUntil;
    const busy = f.move !== null;
    f.facing = other.x > f.x ? 1 : -1;
    f.blocking = !stunned && !busy && input.block && f.y === 0;
    if (stunned || busy || f.blocking) {
      if (f.y === 0) f.vx = 0;
      return;
    }
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (f.y === 0) f.vx = dir * DUEL.walk;
    if (input.jump && !prev.jump && f.y === 0) f.vy = DUEL.jumpVel;
    const start = (m: MoveId) => {
      // Combo: đòn kế tiếp trong khung thời gian thì đếm tiếp, quá lâu thì về 0
      f.combo = this.time - f.lastHitAt < DUEL.comboWindow ? f.combo : 0;
      f.move = m;
      f.moveAt = this.time;
      f.moveHit = false;
      if (f.y === 0) f.vx = 0;
    };
    if (input.punch && !prev.punch) start("punch");
    else if (input.kick && !prev.kick) start("kick");
  }

  /** Đòn đang ở khung trúng: chạm thì gây sát thương (đỡ thì chỉ trầy), hết đòn thì trả về trạng thái tự do */
  private resolve(a: Fighter, b: Fighter, who: "player" | "foe") {
    if (!a.move) return;
    const m = DUEL.moves[a.move];
    const t = this.time - a.moveAt;
    if (!a.moveHit && t >= m.startup && t < m.startup + m.active) {
      const dist = (b.x - a.x) * a.facing;
      if (dist > 0 && dist < m.reach && Math.abs(b.y - a.y) < 1.2) {
        a.moveHit = true;
        const blocked = b.blocking && b.facing === -a.facing;
        a.combo = Math.min(3, a.combo + 1);
        a.lastHitAt = this.time;
        const mul = a.combo >= 3 ? DUEL.comboBonus : 1;
        const dmg = m.damage * mul * (blocked ? DUEL.blockChip : 1);
        b.hp = Math.max(0, b.hp - dmg);
        b.vx = a.facing * m.push * (blocked ? 0.5 : 1);
        if (!blocked) {
          b.stunUntil = this.time + DUEL.hitStun;
          b.move = null;
          b.hurtAt = this.time;
        }
        this.events.push({ kind: blocked ? "block" : "hit", who, x: b.x, at: this.time, move: a.move });
        if (a.combo >= 3) a.combo = 0;
      }
    }
    if (t >= m.startup + m.active + m.recover) {
      if (!a.moveHit) this.events.push({ kind: "whiff", who: who === "foe" ? "player" : "foe", x: a.x, at: this.time });
      a.move = null;
    }
  }

  private physics(dt: number) {
    for (const f of [this.player, this.foe]) {
      f.vy -= DUEL.gravity * dt;
      f.y = Math.max(0, f.y + f.vy * dt);
      if (f.y === 0) f.vy = 0;
      f.x += f.vx * dt;
      // Lực đẩy lùi giảm dần
      if (this.time < f.stunUntil) f.vx *= 0.9;
      f.x = Math.max(-DUEL.arenaHalf, Math.min(DUEL.arenaHalf, f.x));
    }
    // Không cho hai thân chồng lên nhau
    const p = this.player;
    const q = this.foe;
    const gap = q.x - p.x;
    if (Math.abs(gap) < DUEL.bodyGap && Math.abs(p.y - q.y) < 1) {
      const push = (DUEL.bodyGap - Math.abs(gap)) / 2;
      const s = gap >= 0 ? 1 : -1;
      p.x -= s * push;
      q.x += s * push;
    }
  }

  /** AI đơn giản: tiến lại gần, vào tầm thì đấm/đá, thỉnh thoảng đỡ khi người chơi ra đòn, phản ứng có độ trễ */
  private think(): { now: DuelInput; prev: DuelInput } {
    const prev = this.aiIntent;
    if (this.time >= this.aiNext) {
      this.aiNext = this.time + DUEL.ai.think * (0.6 + this.rng() * 0.8);
      const f = this.foe;
      const p = this.player;
      const dist = Math.abs(p.x - f.x);
      const toward = p.x > f.x ? { right: true } : { left: true };
      let intent: DuelInput = { ...NO_DUEL };
      if (p.move && dist < 2 && this.rng() < DUEL.ai.blockChance) intent.block = true;
      else if (dist > DUEL.moves.kick.reach * 0.9) intent = { ...NO_DUEL, ...toward };
      else if (this.rng() < DUEL.ai.aggression) intent = { ...NO_DUEL, [this.rng() < 0.6 ? "punch" : "kick"]: true };
      else if (this.rng() < 0.3) intent = { ...NO_DUEL, jump: true };
      this.aiIntent = intent;
      // Nhấn phím một nhịp: lần nghĩ sau mới nhấn lại
      return { now: intent, prev: NO_DUEL };
    }
    return { now: prev, prev };
  }
}
