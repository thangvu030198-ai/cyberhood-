// Đối kháng 1 chọi 1 trên sàn đấu (học từ Bloody Roar 2 / Tekken PS1): nhìn ngang, hai thanh máu, đồng hồ đếm,
// đấm nhanh, đá mạnh, đỡ đòn, nhảy, combo 3 đòn. Thuần TypeScript, bước cố định 1/60 giây, có test.

export type DuelInput = { left: boolean; right: boolean; jump: boolean; block: boolean; punch: boolean; kick: boolean; dodge?: boolean };
export const NO_DUEL: DuelInput = { left: false, right: false, jump: false, block: false, punch: false, kick: false, dodge: false };

/**
 * Một đòn võ: clip Meshy để diễn, khung ra đòn (startup → active → recover), tầm, sát thương, lực đẩy.
 * `knock`: trúng là ngã sàn; `lunge`: lao tới khi ra đòn; `low`: đòn thấp (đỡ đứng không chặn được hết);
 * `hit`: đối thủ phản ứng kiểu nào (trúng mặt / trúng thân)
 */
export type MoveSpec = {
  clip: string;
  startup: number;
  active: number;
  recover: number;
  reach: number;
  damage: number;
  push: number;
  knock?: boolean;
  lunge?: number;
  low?: boolean;
  hit: "face" | "body";
};

export const DUEL = {
  step: 1 / 60,
  arenaHalf: 9,
  roundTime: 60,
  introTime: 1.5,
  /** Hai người đứng cách nhau tối thiểu: đủ chỗ cho tay chân vươn ra mà không xuyên vào thân nhau */
  bodyGap: 1.4,
  walk: 3.2,
  jumpVel: 9,
  gravity: 28,
  maxHp: 100,
  /**
   * Bộ chiêu (học từ Tekken / Bloody Roar): J bấm liên tục ra chuỗi đấm jab trái → jab phải → móc trái → đấm móc
   * ngửa (ngã); K ra chuỗi đá gối → đá vòng cầu → đạp Sparta (ngã). Tiến + J: chỏ lao tới; tiến + K: phi cước;
   * lùi + K: đá móc lộn ngược; giữ S + K: quét trụ; giữ S + J: đá hất; trên không J/K: đấm nhảy / phi cước.
   */
  moves: {
    jabL: { clip: "jabL", startup: 0.07, active: 0.07, recover: 0.13, reach: 1.55, damage: 5, push: 1.1, hit: "face" },
    jabR: { clip: "jabR", startup: 0.08, active: 0.07, recover: 0.14, reach: 1.6, damage: 6, push: 1.3, hit: "face" },
    hookL: { clip: "hookL", startup: 0.11, active: 0.08, recover: 0.18, reach: 1.55, damage: 8, push: 2, hit: "face" },
    upperR: { clip: "upperR", startup: 0.13, active: 0.09, recover: 0.3, reach: 1.5, damage: 11, push: 2.6, knock: true, hit: "face" },
    knee: { clip: "knee", startup: 0.1, active: 0.08, recover: 0.2, reach: 1.55, damage: 8, push: 1.6, hit: "body" },
    roundhouse: { clip: "roundhouse", startup: 0.19, active: 0.1, recover: 0.28, reach: 2.0, damage: 11, push: 3.2, hit: "face" },
    spartan: { clip: "spartan", startup: 0.18, active: 0.1, recover: 0.32, reach: 1.85, damage: 13, push: 5, knock: true, hit: "body" },
    elbow: { clip: "elbow", startup: 0.12, active: 0.08, recover: 0.22, reach: 1.5, damage: 10, push: 2.4, lunge: 4, hit: "face" },
    flykick: { clip: "flykick", startup: 0.24, active: 0.14, recover: 0.34, reach: 2.25, damage: 15, push: 5, knock: true, lunge: 7, hit: "body" },
    backflip: { clip: "backflipkick", startup: 0.2, active: 0.12, recover: 0.4, reach: 1.85, damage: 14, push: 4, knock: true, hit: "face" },
    sweep: { clip: "sweep", startup: 0.15, active: 0.1, recover: 0.3, reach: 2.0, damage: 9, push: 1, knock: true, low: true, hit: "body" },
    risekick: { clip: "risekick", startup: 0.12, active: 0.1, recover: 0.3, reach: 1.65, damage: 10, push: 2.2, hit: "face" },
    jumppunch: { clip: "jumppunch", startup: 0.14, active: 0.12, recover: 0.2, reach: 1.75, damage: 10, push: 2, hit: "face" },
  } satisfies Record<string, MoveSpec>,
  /** Chuỗi bấm liên tiếp cùng nút trong `comboWindow` giây */
  chains: { punch: ["jabL", "jabR", "hookL", "upperR"], kick: ["knee", "roundhouse", "spartan"] } as const,
  /** Đòn thứ 3 trúng liên tiếp trở đi mạnh gấp rưỡi */
  comboWindow: 0.45,
  /** Bấm đòn lúc đang bận (đang ra đòn / bị choáng) thì nhớ lại chừng này giây, rảnh là ra ngay: chuỗi đòn liền mạch */
  buffer: 0.22,
  comboBonus: 1.5,
  /** Đỡ đòn: chỉ nhận phần này sát thương (đòn thấp xuyên đỡ nhiều hơn) */
  blockChip: 0.15,
  lowChip: 0.6,
  hitStun: 0.32,
  /** Ngã sàn bao lâu, đứng dậy bao lâu (bất tử lúc đứng dậy) */
  downTime: 0.9,
  getupTime: 0.9,
  /** Né (L): lùi nhanh, bất tử trong khoảng này, hồi bao lâu mới né tiếp */
  dodge: { time: 0.32, speed: 7, cd: 0.6 },
  /** AI: độ trễ phản ứng và xác suất đỡ khi bị đánh */
  ai: { think: 0.28, blockChance: 0.35, aggression: 0.65 },
};

export type MoveId = keyof typeof DUEL.moves;

/** Đối thủ trên thang đấu trường: máu, lực đòn, tốc độ phản ứng, tỉ lệ đỡ, độ hung hăng, CRED thưởng */
export type Rival = {
  id: string;
  name: string;
  title: string;
  /** Model rig (đi + chạy riêng; chết mượn của vệ binh nếu không có) */
  base: string;
  height: number;
  hp: number;
  power: number;
  think: number;
  blockChance: number;
  aggression: number;
  reward: number;
};

/** Thang 8 bậc: từ goblin chợ đêm tới nhà vô địch ngồi trên ngai sắt */
export const RIVALS: Rival[] = [
  { id: "goblin", name: "GOBLIN", title: "Kẻ móc túi chợ đêm", base: "mx_dr_goblin", height: 1.5, hp: 0.8, power: 0.8, think: 0.36, blockChance: 0.15, aggression: 0.5, reward: 30 },
  { id: "guard", name: "VỆ BINH CITADEL", title: "Lính gác pháo đài", base: "mx_ct_guard", height: 1.95, hp: 1, power: 1, think: 0.28, blockChance: 0.35, aggression: 0.65, reward: 45 },
  { id: "knight", name: "HIỆP SĨ THÉP", title: "Giáp bạc nặng, đỡ đòn giỏi", base: "mx_dr_knight", height: 1.95, hp: 1.1, power: 1.05, think: 0.26, blockChance: 0.5, aggression: 0.55, reward: 55 },
  { id: "wolfwar", name: "CHIẾN BINH SÓI", title: "Thú hoá: nhanh và hung hăng", base: "mx_dr_wolfwar", height: 2, hp: 1.15, power: 1.15, think: 0.2, blockChance: 0.25, aggression: 0.85, reward: 65 },
  { id: "warlord", name: "GOBLIN HÀM SẮT", title: "Thủ lĩnh bộ lạc, chuỳ gai", base: "mx_dr_warlord", height: 2.1, hp: 1.3, power: 1.25, think: 0.24, blockChance: 0.35, aggression: 0.7, reward: 75 },
  { id: "obsidian", name: "HIỆP SĨ HẮC DIỆN", title: "Kiếm sĩ áo choàng đen", base: "mx_dr_obsidian", height: 2, hp: 1.35, power: 1.25, think: 0.19, blockChance: 0.55, aggression: 0.7, reward: 90 },
  { id: "golem", name: "THẦN ĐÁ", title: "Chậm mà nặng như núi", base: "mx_dr_golem", height: 2.6, hp: 1.8, power: 1.45, think: 0.32, blockChance: 0.2, aggression: 0.6, reward: 110 },
  { id: "aegis", name: "HIỆP SĨ LAM ĐUN", title: "Nhà vô địch ngai sắt", base: "mx_dr_aegis", height: 2.05, hp: 1.6, power: 1.35, think: 0.16, blockChance: 0.55, aggression: 0.8, reward: 160 },
];

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
  /** Lần cuối bị trúng đòn (cho hiệu ứng nháy) và kiểu trúng (mặt / thân) */
  hurtAt: number;
  hurtKind: "face" | "body";
  /** Vị trí trong chuỗi đòn đang bấm (đấm / đá) */
  chain: { kind: "punch" | "kick" | null; step: number; at: number };
  /** Ngã sàn tới lúc nào; đứng dậy xong lúc nào */
  downUntil: number;
  getupUntil: number;
  /** Né: bất tử tới lúc nào, hồi né */
  dodgeAt: number;
  /** Nút đòn bấm sớm đang chờ ra */
  queued: { kind: "punch" | "kick" | null; at: number };
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
  hurtKind: "face",
  chain: { kind: null, step: 0, at: -9 },
  downUntil: -9,
  getupUntil: -9,
  dodgeAt: -9,
  queued: { kind: null, at: -9 },
});

export class DuelSim {
  time = 0;
  status: DuelStatus = "intro";
  player = fighter(-3, 1);
  foe = fighter(3, -1);
  /** Sự kiện cho hiển thị / âm thanh */
  events: { kind: "hit" | "block" | "whiff" | "ko" | "knock" | "dodge"; who: "player" | "foe"; x: number; at: number; move?: MoveId }[] = [];
  private prev: DuelInput = NO_DUEL;
  private acc = 0;
  private aiNext = 0;
  private aiIntent: DuelInput = NO_DUEL;
  private rng: () => number;

  /** Đối thủ đang đấu (mặc định: vệ binh) */
  readonly rival: Rival;
  readonly foeMaxHp: number;

  constructor(seed = 1, rival: Rival = RIVALS[1]) {
    this.rival = rival;
    this.foeMaxHp = Math.round(DUEL.maxHp * rival.hp);
    this.foe.hp = this.foeMaxHp;
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

  /** Đang nằm sàn / đứng dậy / né: không điều khiển được */
  lying(f: Fighter) {
    return this.time < f.getupUntil;
  }

  dodging(f: Fighter) {
    return this.time - f.dodgeAt < DUEL.dodge.time;
  }

  private control(f: Fighter, other: Fighter, input: DuelInput, prev: DuelInput) {
    const stunned = this.time < f.stunUntil;
    const busy = f.move !== null;
    if (this.lying(f)) {
      f.vx *= 0.85;
      f.blocking = false;
      return;
    }
    if (this.dodging(f)) return;
    f.facing = other.x > f.x ? 1 : -1;
    const fwd = f.facing > 0 ? input.right : input.left;
    const back = f.facing > 0 ? input.left : input.right;
    let punch = input.punch && !prev.punch;
    let kick = input.kick && !prev.kick;
    if (punch || kick) f.queued = { kind: punch ? "punch" : "kick", at: this.time };
    // Bấm trong lúc bận: giữ lại, hết bận trong khung đệm thì ra luôn
    if (!punch && !kick && f.queued.kind && this.time - f.queued.at < DUEL.buffer && !stunned && !busy) {
      punch = f.queued.kind === "punch";
      kick = f.queued.kind === "kick";
    }
    // Giữ S + đòn = đòn thấp; giữ S không đánh = đỡ
    f.blocking = !stunned && !busy && input.block && f.y === 0 && !punch && !kick;
    if (stunned || busy || f.blocking) {
      if (f.y === 0) f.vx = 0;
      return;
    }
    // Né lùi (L): lướt ra sau, bất tử chốc lát
    if (input.dodge && !prev.dodge && f.y === 0 && this.time - f.dodgeAt > DUEL.dodge.cd) {
      f.dodgeAt = this.time;
      f.vx = -f.facing * DUEL.dodge.speed;
      this.events.push({ kind: "dodge", who: f === this.player ? "player" : "foe", x: f.x, at: this.time });
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
      const L = (DUEL.moves[m] as MoveSpec).lunge;
      if (L) f.vx = f.facing * L;
      else if (f.y === 0) f.vx = 0;
    };
    // Bấm liên tiếp cùng nút trong nhịp combo thì ra đòn kế trong chuỗi
    const next = (kind: "punch" | "kick") => {
      const list = DUEL.chains[kind];
      const c = f.chain;
      const step = c.kind === kind && this.time - c.at < DUEL.comboWindow + 0.35 ? (c.step + 1) % list.length : 0;
      f.chain = { kind, step, at: this.time };
      return list[step] as MoveId;
    };
    if (!punch && !kick) return;
    f.queued = { kind: null, at: -9 };
    if (f.y > 0) start(punch ? "jumppunch" : "flykick");
    else if (input.block) start(punch ? "risekick" : "sweep");
    else if (fwd && kick) start("flykick");
    else if (fwd && punch) start("elbow");
    else if (back && kick) start("backflip");
    else start(next(punch ? "punch" : "kick"));
  }

  /** Đòn đang ở khung trúng: chạm thì gây sát thương (đỡ thì chỉ trầy), hết đòn thì trả về trạng thái tự do */
  private resolve(a: Fighter, b: Fighter, who: "player" | "foe") {
    if (!a.move) return;
    const m: MoveSpec = DUEL.moves[a.move];
    const t = this.time - a.moveAt;
    // Lao tới chỉ trong lúc vung đòn
    if (m.lunge && t > m.startup + m.active && a.y === 0) a.vx *= 0.8;
    if (!a.moveHit && t >= m.startup && t < m.startup + m.active) {
      const dist = (b.x - a.x) * a.facing;
      const immune = this.lying(b) || this.dodging(b);
      if (dist > 0 && dist < m.reach && Math.abs(b.y - a.y) < 1.2 && !immune) {
        a.moveHit = true;
        const blocked = b.blocking && b.facing === -a.facing;
        a.combo = Math.min(3, a.combo + 1);
        a.lastHitAt = this.time;
        // Đối thủ mạnh đánh đau hơn theo lực đòn của bậc
        const mul = (a.combo >= 3 ? DUEL.comboBonus : 1) * (a === this.foe ? this.rival.power : 1);
        const chip = blocked ? (m.low ? DUEL.lowChip : DUEL.blockChip) : 1;
        const dmg = m.damage * mul * chip;
        b.hp = Math.max(0, b.hp - dmg);
        b.vx = a.facing * m.push * (blocked ? 0.5 : 1);
        const knocked = !!m.knock && (!blocked || !!m.low);
        if (!blocked || knocked) {
          b.stunUntil = this.time + DUEL.hitStun;
          b.move = null;
          b.hurtAt = this.time;
          b.hurtKind = m.hit;
          b.chain = { kind: null, step: 0, at: -9 };
        }
        if (knocked) {
          // Ngã sàn: văng ra, nằm một lúc rồi đứng dậy (bất tử cho tới khi đứng hẳn)
          b.downUntil = this.time + DUEL.downTime;
          b.getupUntil = b.downUntil + DUEL.getupTime;
          b.stunUntil = b.getupUntil;
          b.blocking = false;
          if (b.y === 0) b.vy = 4;
        }
        this.events.push({ kind: knocked ? "knock" : blocked ? "block" : "hit", who, x: b.x, at: this.time, move: a.move });
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
      // Lực đẩy lùi / lướt né giảm dần
      if (this.time < f.stunUntil || this.dodging(f)) f.vx *= 0.9;
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

  /**
   * AI: tiến lại gần, vào tầm thì ra chuỗi đấm / đá hoặc đòn đặc biệt theo khoảng cách, thỉnh thoảng đỡ / né khi
   * người chơi ra đòn, quét trụ khi người chơi hay đỡ. Phản ứng có độ trễ theo bậc đối thủ.
   */
  private think(): { now: DuelInput; prev: DuelInput } {
    const prev = this.aiIntent;
    if (this.time >= this.aiNext) {
      this.aiNext = this.time + this.rival.think * (0.6 + this.rng() * 0.8);
      const f = this.foe;
      const p = this.player;
      const dist = Math.abs(p.x - f.x);
      const toward = p.x > f.x ? { right: true } : { left: true };
      const away = p.x > f.x ? { left: true } : { right: true };
      const r = this.rng();
      let intent: DuelInput = { ...NO_DUEL };
      if (this.lying(p)) intent = { ...NO_DUEL, ...away };
      else if (p.move && dist < 2.45 && r < this.rival.blockChance) intent = this.rng() < 0.3 ? { ...NO_DUEL, dodge: true } : { ...NO_DUEL, block: true };
      else if (dist > 3.2 && dist < 4.2 && r < this.rival.aggression * 0.35) intent = { ...NO_DUEL, ...toward, kick: true };
      else if (dist > 1.85) intent = { ...NO_DUEL, ...toward };
      else if (r < this.rival.aggression) {
        const k = this.rng();
        // Người chơi hay đỡ: quét trụ phá thế đỡ
        if (p.blocking && k < 0.5) intent = { ...NO_DUEL, block: true, kick: true };
        else if (k < 0.55) intent = { ...NO_DUEL, punch: true };
        else if (k < 0.85) intent = { ...NO_DUEL, kick: true };
        else intent = { ...NO_DUEL, ...toward, punch: true };
      } else if (this.rng() < 0.3) intent = { ...NO_DUEL, jump: true };
      this.aiIntent = intent;
      // Nhấn phím một nhịp: lần nghĩ sau mới nhấn lại
      return { now: intent, prev: NO_DUEL };
    }
    // Giữ hướng / đỡ, nhưng các nút đòn chỉ tính lần nhấn đầu
    return { now: prev, prev };
  }
}
