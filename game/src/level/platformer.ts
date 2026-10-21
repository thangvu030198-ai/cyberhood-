// Lõi màn chơi đi ngang kiểu Rockman X: thuần TypeScript, bước cố định 1/60s, test được.
// Đơn vị: 1 ô = 1 mét. Trục x sang phải, trục y lên trên. Hiển thị 3D nằm ở LevelScene.tsx.

import { LEVEL_TUNING as T } from "./levelTuning";
import type { ThemeId } from "./themes";
import { chestContents, rollEnemyDrops, type ChestTier, type LootContext, type LootDrop } from "./loot";
import { freshPity, type PityState } from "../sim/loot";
import { createRng } from "../sim/rng";

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; shoot: boolean; dash: boolean };
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dash: false };

/**
 * Kiểu chơi của map:
 * - platform: chạy, nhảy, bắn ngang (Mega Man X)
 * - climb: leo ngược lên tháp, sương ma dâng từ dưới, chạm sương là mất mạng (Ice Climber / Kid Icarus)
 * - shmup: cưỡi xe bay, màn hình tự cuộn sang phải, bay tự do bốn hướng, chạm địa hình bị thương (Gradius / Metal Slug)
 */
export type PlayMode = "platform" | "climb" | "shmup";

export type Box = { x: number; y: number; w: number; h: number };

export type EnemyKind = "trooper" | "drone" | "zombie" | "boss";

export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  homeX: number;
  homeY: number;
  alive: boolean;
  /** Đang hoạt động (gần camera) */
  awake: boolean;
  timer: number;
  /** Thời điểm bắn gần nhất (cho animation) */
  firedAt: number;
  hurtAt: number;
  deadAt: number;
  onGround: boolean;
  /** Trùm: kiểu đòn đang ra */
  move: "walk" | "jump" | "volley" | "idle";
};

export type Shot = { x: number; y: number; vx: number; vy: number; r: number; dmg: number; pierce: boolean; life: number; enemy: boolean; level: 0 | 1 | 2 };

export type Pickup = { x: number; y: number; vx: number; vy: number; drop: LootDrop; taken: boolean; bornAt: number };

export type Chest = { x: number; y: number; tier: ChestTier; opened: boolean; lockedHintAt: number };

export type SimOptions = {
  /** Hạt giống ngẫu nhiên cho đồ rơi (test cố định được) */
  seed?: number;
  /** Bộ đếm pity của người chơi: dùng chung với hợp đồng, được cập nhật tại chỗ */
  pity?: PityState;
  /** Chìa rương mang vào màn */
  chestKeys?: number;
  /** Hệ số rơi đồ của map (GDD: Neon City ×1.0 … Citadel ×2.0) */
  mapMultiplier?: number;
};

export type SimEvent = "kill" | "checkpoint" | "cleared" | "loot" | "chest" | "chestLocked";

export type FxEvent = { kind: "hit" | "boom" | "shot" | "charge" | "hurt" | "pickup" | "checkpoint" | "land" | "dash" | "dust"; x: number; y: number; at: number };

export type LevelDef = {
  id: string;
  name: string;
  /** Hàng trên cùng trước. '#' đặc, '=' bậc nhảy xuyên lên được, '^' gai, '.' trống */
  rows: string[];
  start: [number, number];
  checkpoints: [number, number][];
  enemies: { kind: EnemyKind; x: number; y: number }[];
  pickups: [number, number][];
  /** Rương giấu trong màn, mở bằng Chìa rương */
  chests?: { x: number; y: number; tier: ChestTier }[];
  /** Vùng đấu trùm: [xMin, xMax]; đi vào thì cửa đóng lại */
  bossArena: [number, number];
  /** Bảng màu / bối cảnh để LevelScene trang trí (themes.ts) */
  theme: ThemeId;
  mode?: PlayMode;
  /** Chế độ leo: phòng trùm chỉ kích hoạt khi lên tới độ cao này */
  bossFloor?: number;
};

export type Status = "intro" | "playing" | "dead" | "cleared";

export class PlatformerSim {
  readonly def: LevelDef;
  readonly width: number;
  readonly height: number;
  private grid: string[];
  time = 0;
  status: Status = "intro";
  player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    w: T.player.w,
    h: T.player.h,
    facing: 1 as 1 | -1,
    onGround: false,
    /** -1/1 khi đang bám tường bên trái/phải */
    wall: 0 as -1 | 0 | 1,
    dashTime: 0,
    airDashUsed: false,
    /** Khoá điều khiển ngang sau khi nhảy tường */
    wallJumpLock: 0,
    coyote: 0,
    jumpBuffer: 0,
    hp: T.player.maxHp,
    invuln: 0,
    charge: 0,
    shootTimer: 0,
    knock: 0,
    /** Nhảy từ trạng thái lướt: giữ tốc độ lướt trên không */
    dashCarry: false,
    /** Đang ở sát tường bên nào khi trên không (cho động tác leo/trượt tường) */
    wallNear: 0 as -1 | 0 | 1,
  };
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  pickups: Pickup[] = [];
  fx: FxEvent[] = [];
  checkpoint: [number, number];
  checkpointIndex = -1;
  bossActive = false;
  kills = 0;
  deaths = 0;
  private prev: Input = NO_INPUT;
  private deadAt = 0;
  clearedAt = 0;
  /** Báo cho bên ngoài (thưởng, nhiệm vụ): hạ địch, qua checkpoint, qua màn */
  onEvent: ((kind: SimEvent, detail?: { enemy?: Enemy; drop?: LootDrop; chest?: Chest }) => void) | null = null;
  chests: Chest[] = [];
  /** Chìa rương đang có (mang vào + nhặt được − đã dùng) */
  chestKeys = 0;
  readonly mode: PlayMode;
  /** Chế độ leo: mặt sương ma (y); dưới mức này là mất mạng */
  fogY = -99;
  private fogFrom = 0;
  /** Chế độ bay: tâm màn hình đang cuộn tới (x) */
  scrollX = 0;
  /** Mọi thứ đã nhặt trong màn (trừ viên máu), để trao khi qua màn */
  collected: LootDrop[] = [];
  private loot: LootContext;
  private acc = 0;

  constructor(def: LevelDef, opts: SimOptions = {}) {
    this.loot = { rng: createRng(opts.seed ?? (Date.now() & 0xffffff)), pity: opts.pity ?? freshPity(), mapMultiplier: opts.mapMultiplier ?? 1 };
    this.chestKeys = opts.chestKeys ?? 0;
    this.mode = def.mode ?? "platform";
    this.chests = (def.chests ?? []).map((c) => ({ ...c, opened: false, lockedHintAt: -99 }));
    this.def = def;
    this.grid = def.rows;
    this.height = def.rows.length;
    this.width = Math.max(...def.rows.map((r) => r.length));
    this.checkpoint = def.start;
    this.reset(def.start);
    this.scrollX = def.start[0] + T.shmup.viewHalf - 3;
    let id = 0;
    this.enemies = def.enemies.map((e) => makeEnemy(id++, e.kind, e.x, e.y));
    this.pickups = def.pickups.map(([x, y]) => ({ x, y, vx: 0, vy: 0, drop: { kind: "health" as const }, taken: false, bornAt: -99 }));
  }

  private reset([x, y]: [number, number]) {
    const p = this.player;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.hp = T.player.maxHp;
    p.invuln = 1;
    p.charge = 0;
    p.dashTime = 0;
    p.wall = 0;
    // Sương ma lùi xuống dưới chỗ hồi sinh, nghỉ một nhịp rồi mới dâng tiếp
    this.fogY = y - T.climb.startBelow;
    this.fogFrom = this.time + T.climb.delay;
    if (this.mode === "shmup") this.scrollX = Math.max(x + T.shmup.viewHalf - 3, this.scrollX - T.shmup.viewHalf);
  }

  /** Ô tại cột c, hàng-từ-dưới-lên r */
  tile(c: number, r: number): string {
    if (c < 0 || c >= this.width) return "#";
    if (r < 0) return ".";
    if (r >= this.height) return ".";
    const row = this.grid[this.height - 1 - r];
    return row[c] ?? ".";
  }

  private solid(c: number, r: number) {
    const t = this.tile(c, r);
    if (t === "#") return true;
    // Cửa phòng trùm đóng lại khi trận đấu bắt đầu
    if (this.bossActive && (c === this.def.bossArena[0] - 1 || c === this.def.bossArena[1] + 1) && r >= 0) return true;
    return false;
  }

  /** Va chạm một hộp với ô đặc; trả về true nếu chạm */
  private hits(x: number, y: number, w: number, h: number) {
    for (let c = Math.floor(x - w / 2); c <= Math.floor(x + w / 2 - 1e-6); c++) {
      for (let r = Math.floor(y); r <= Math.floor(y + h - 1e-6); r++) if (this.solid(c, r)) return true;
    }
    return false;
  }

  /** Bậc "=": chỉ đỡ khi đang rơi xuống từ phía trên */
  private onPlatform(x: number, yOld: number, yNew: number, w: number) {
    if (yNew > yOld) return null;
    for (let c = Math.floor(x - w / 2); c <= Math.floor(x + w / 2 - 1e-6); c++) {
      for (let r = Math.floor(yOld - 1e-6); r >= Math.floor(yNew); r--) {
        if (this.tile(c, r) === "=" && yOld >= r + 1 - 1e-6 && yNew < r + 1) return r + 1;
      }
    }
    return null;
  }

  /** Di chuyển một thực thể có hộp chân tại (x, y): trả về cờ chạm đất / tường */
  private move(e: { x: number; y: number; vx: number; vy: number; w: number; h: number }, dt: number) {
    let ground = false;
    let wall: -1 | 0 | 1 = 0;
    // Trục X
    const nx = e.x + e.vx * dt;
    if (!this.hits(nx, e.y, e.w, e.h)) e.x = nx;
    else {
      wall = e.vx > 0 ? 1 : -1;
      // Áp sát tường
      if (e.vx > 0) e.x = Math.floor(nx + e.w / 2) - e.w / 2 - 1e-4;
      else e.x = Math.floor(nx - e.w / 2) + 1 + e.w / 2 + 1e-4;
      e.vx = 0;
    }
    // Trục Y
    const ny = e.y + e.vy * dt;
    const plat = this.onPlatform(e.x, e.y, ny, e.w);
    if (plat !== null) {
      e.y = plat;
      e.vy = 0;
      ground = true;
    } else if (!this.hits(e.x, ny, e.w, e.h)) e.y = ny;
    else {
      if (e.vy < 0) {
        e.y = Math.floor(ny) + 1;
        ground = true;
      } else e.y = Math.floor(ny + e.h) - e.h - 1e-4;
      e.vy = 0;
    }
    return { ground, wall };
  }

  private touchingWall(x: number, y: number, w: number, h: number, dir: -1 | 1, reach = 0.06) {
    return this.hits(x + dir * reach, y + 0.2, w, h - 0.4);
  }

  private standing(x: number, y: number, w: number) {
    if (this.hits(x, y - 0.05, w, 0.05)) return true;
    for (let c = Math.floor(x - w / 2); c <= Math.floor(x + w / 2 - 1e-6); c++) {
      const r = Math.round(y) - 1;
      if (this.tile(c, r) === "=" && Math.abs(y - (r + 1)) < 0.06) return true;
    }
    return false;
  }

  /** Chạy mô phỏng theo thời gian thật `dt` (bước cố định bên trong) */
  update(dt: number, input: Input) {
    this.acc = Math.min(this.acc + dt, 0.25);
    while (this.acc >= T.step) {
      this.acc -= T.step;
      this.step(input);
    }
  }

  step(input: Input) {
    const dt = T.step;
    this.time += dt;
    const pressed = (k: keyof Input) => input[k] && !this.prev[k];
    if (this.status === "intro") {
      if (this.time > T.introTime) this.status = "playing";
      this.prev = input;
      this.gravityOnly(dt);
      return;
    }
    if (this.status === "cleared") {
      this.prev = input;
      return;
    }
    if (this.status === "dead") {
      if (this.time - this.deadAt > T.respawnDelay) {
        this.deaths++;
        this.reset(this.checkpoint);
        this.status = "playing";
        // Chết trong phòng trùm: mở cửa, trùm hồi máu
        if (this.bossActive) {
          this.bossActive = false;
          const boss = this.enemies.find((e) => e.kind === "boss");
          if (boss) {
            boss.hp = boss.maxHp;
            boss.x = boss.homeX;
            boss.y = boss.homeY;
            boss.awake = false;
          }
        }
        this.shots = this.shots.filter((s) => !s.enemy);
      }
      this.prev = input;
      return;
    }

    if (this.mode === "shmup") this.updateFlyer(dt, input, pressed);
    else this.updatePlayer(dt, input, pressed);
    if (this.mode === "climb") this.updateFog(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.prev = input;
  }

  private gravityOnly(dt: number) {
    const p = this.player;
    p.vy = Math.max(-T.player.maxFall, p.vy - T.player.gravity * dt);
    const r = this.move(p, dt);
    p.onGround = r.ground;
  }

  private updatePlayer(dt: number, input: Input, pressed: (k: keyof Input) => boolean) {
    const p = this.player;
    const P = T.player;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (dir !== 0 && p.wallJumpLock <= 0) p.facing = dir as 1 | -1;

    p.onGround = this.standing(p.x, p.y, p.w);
    if (p.onGround) {
      p.coyote = P.coyote;
      p.airDashUsed = false;
    } else p.coyote -= dt;
    if (pressed("jump")) p.jumpBuffer = P.jumpBuffer;
    else p.jumpBuffer -= dt;

    // Lướt (dash): trên đất hoặc một lần trên không
    if (pressed("dash") && p.dashTime <= 0 && (p.onGround || !p.airDashUsed)) {
      p.dashTime = P.dashTime;
      if (!p.onGround) p.airDashUsed = true;
      this.fx.push({ kind: "dash", x: p.x, y: p.y, at: this.time });
    }
    const dashing = p.dashTime > 0;
    if (dashing) p.dashTime -= dt;
    if (dashing && !input.dash && p.onGround) p.dashTime = 0;

    // Tốc độ ngang
    p.wallJumpLock -= dt;
    p.knock -= dt;
    if (p.knock > 0) {
      // bị đánh bật lùi, mất điều khiển trong chốc lát
    } else if (p.wallJumpLock > 0) {
      // giữ đà nhảy tường
    } else if (dashing) p.vx = p.facing * P.dashSpeed;
    else {
      // Giữ đà lướt khi nhảy từ trạng thái lướt (kiểu Rockman X)
      const speed = p.onGround ? P.runSpeed : Math.max(P.runSpeed, Math.abs(p.vx) * (p.dashCarry ? 1 : 0));
      p.vx = dir * speed;
    }

    // Bám tường: đang rơi, ép vào tường, không đứng đất
    p.wall = 0;
    if (!p.onGround && dir !== 0 && p.vy <= 0 && this.touchingWall(p.x, p.y, p.w, p.h, dir as -1 | 1)) {
      p.wall = dir as -1 | 1;
      p.vy = Math.max(p.vy, -P.wallSlide);
      p.airDashUsed = false;
    }

    // Giữ nút nhảy + giữ hướng vào tường: tự đạp tường leo lên liên tục, không phải bấm lại từng nhịp
    if (
      input.jump &&
      dir !== 0 &&
      !p.onGround &&
      p.wallJumpLock <= 0 &&
      p.vy <= P.autoClimbVy &&
      this.touchingWall(p.x, p.y, p.w, p.h, dir as -1 | 1, P.wallGrace)
    )
      p.jumpBuffer = Math.max(p.jumpBuffer, dt);

    // Nhảy: từ đất (có thời gian ân hạn), hoặc nhảy tường
    if (p.jumpBuffer > 0) {
      if (p.coyote > 0) {
        p.vy = P.jumpVel;
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.dashCarry = dashing || input.dash;
        p.dashTime = 0;
      } else if (p.wall !== 0 || this.touchingWall(p.x, p.y, p.w, p.h, -1, P.wallGrace) || this.touchingWall(p.x, p.y, p.w, p.h, 1, P.wallGrace)) {
        // Cách tường một chút vẫn nhảy tường được (đỡ trượt tay)
        const side = p.wall !== 0 ? p.wall : this.touchingWall(p.x, p.y, p.w, p.h, 1, P.wallGrace) ? 1 : -1;
        p.vy = P.wallJumpVel;
        const dashJump = input.dash;
        // Giữ hướng vào tường: bật ra ít để leo tiếp chính bức tường đó; bấm hướng ngược lại: bật xa
        const away = dir === -side;
        p.vx = -side * (dashJump ? P.dashSpeed : away ? P.wallKickAway : P.wallKick);
        p.facing = -side as 1 | -1;
        p.wallJumpLock = P.wallJumpLock;
        p.jumpBuffer = 0;
        p.dashCarry = dashJump;
      }
    }
    // Nhả nút nhảy sớm thì nhảy thấp (điều khiển độ cao)
    // Độ cao nhảy theo thời gian giữ nút: nhả sớm thì trọng lực tăng (hãm dần, không khựng),
    // gần đỉnh nhảy thì trọng lực giảm để lơ lửng một nhịp, rơi xuống nhanh hơn một chút cho dứt khoát
    let g = P.gravity;
    if (p.vy > 0 && !input.jump) g *= P.releaseGravity;
    else if (input.jump && Math.abs(p.vy) < P.apexBand) g *= P.apexGravity;
    else if (p.vy < 0) g *= P.fallGravity;

    // Lướt trên mặt đất mà rơi khỏi mép: thôi lướt nhưng giữ đà. Lướt trên không: bay ngang
    if (p.dashTime > 0 && !p.onGround && !p.airDashUsed) {
      p.dashTime = 0;
      p.dashCarry = true;
    }
    if (p.dashTime > 0 && !p.onGround) p.vy = 0;
    else p.vy -= g * dt;
    p.vy = Math.max(p.wall !== 0 ? -P.wallSlide : -P.maxFall, p.vy);

    const wasGround = p.onGround;
    const m = this.move(p, dt);
    p.onGround = m.ground || this.standing(p.x, p.y, p.w);
    if (p.onGround && p.vy <= 0) p.dashCarry = false;
    p.wallNear = 0;
    if (!p.onGround) {
      const toward = (dir !== 0 ? dir : p.facing) as -1 | 1;
      if (this.touchingWall(p.x, p.y, p.w, p.h, toward, P.wallGrace)) p.wallNear = toward;
      else if (this.touchingWall(p.x, p.y, p.w, p.h, -toward as -1 | 1, 0.12)) p.wallNear = -toward as -1 | 1;
    }
    if (!wasGround && p.onGround) this.fx.push({ kind: "land", x: p.x, y: p.y, at: this.time });

    // Bắn: nhấn bắn đạn thường, giữ để nạp, thả ra bắn đạn nạp
    p.shootTimer -= dt;
    if (pressed("shoot")) this.fire(0);
    if (input.shoot) {
      p.charge += dt;
      if (p.charge > T.shot.chargeMid && p.charge - dt <= T.shot.chargeMid) this.fx.push({ kind: "charge", x: p.x, y: p.y, at: this.time });
    } else if (this.prev.shoot) {
      if (p.charge >= T.shot.chargeFull) this.fire(2);
      else if (p.charge >= T.shot.chargeMid) this.fire(1);
      p.charge = 0;
    }

    p.invuln -= dt;

    // Gai và rơi xuống vực
    if (p.y < -3) this.kill();
    else if (this.touchesSpike(p.x, p.y, p.w)) this.hurt(T.player.spikeDamage, -p.facing as 1 | -1);

    // Checkpoint
    this.def.checkpoints.forEach(([cx, cy], i) => {
      if (i > this.checkpointIndex && Math.abs(p.x - cx) < 1 && Math.abs(p.y - cy) < 2.5) {
        this.checkpointIndex = i;
        this.checkpoint = [cx, cy];
        this.fx.push({ kind: "checkpoint", x: cx, y: cy, at: this.time });
        this.onEvent?.("checkpoint");
      }
    });

    // Vào phòng trùm
    const [ax, bx] = this.def.bossArena;
    if (!this.bossActive && p.x > ax + 1 && p.x < bx && p.y >= (this.def.bossFloor ?? -99)) {
      this.bossActive = true;
      const boss = this.enemies.find((e) => e.kind === "boss");
      if (boss) {
        boss.awake = true;
        boss.timer = 1.5;
      }
    }
  }

  /** Leo tháp: sương dâng đều, tụt quá xa thì dâng nhanh hơn để giữ nhịp; vào phòng trùm thì dừng */
  private updateFog(dt: number) {
    const C = T.climb;
    if (this.bossActive || this.time < this.fogFrom) return;
    const gap = this.player.y - this.fogY;
    this.fogY += C.speed * (gap > C.catchUpGap ? C.catchUpMul : 1) * dt;
    if (this.player.y + 0.2 < this.fogY) this.kill();
  }

  /** Bay: màn hình tự cuộn, bay tự do trong khung hình, chạm địa hình bị thương (không bị kẹt) */
  private updateFlyer(dt: number, input: Input, pressed: (k: keyof Input) => boolean) {
    const p = this.player;
    const S = T.shmup;
    const [ax, bx] = this.def.bossArena;
    const stopAt = (ax + bx + 1) / 2;
    const scrolling = this.scrollX < stopAt;
    if (scrolling) this.scrollX = Math.min(stopAt, this.scrollX + S.scrollSpeed * dt);
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.up || input.jump ? 1 : 0) - (input.down ? 1 : 0);
    const boost = input.dash ? S.boost : 1;
    p.facing = 1;
    p.vx = dx * S.speed * boost + (scrolling ? S.scrollSpeed : 0);
    p.vy = dy * S.speed * boost;
    p.x = Math.min(this.scrollX + S.viewHalf - 1.5, Math.max(this.scrollX - S.viewHalf + 1, p.x + p.vx * dt));
    p.y = Math.min(this.height - 2.5, Math.max(0.5, p.y + p.vy * dt));
    p.onGround = false;
    p.wall = 0;
    p.wallNear = 0;
    p.dashTime = 0;
    p.knock -= dt;
    p.invuln -= dt;
    if (this.hits(p.x, p.y + 0.3, p.w, p.h - 0.6)) this.hurt(S.crashDamage, -1);
    // Bắn giống chế độ đi bộ: nhấn bắn thường, giữ để nạp
    p.shootTimer -= dt;
    if (pressed("shoot")) this.fire(0);
    if (input.shoot) p.charge += dt;
    else if (this.prev.shoot) {
      if (p.charge >= T.shot.chargeFull) this.fire(2);
      else if (p.charge >= T.shot.chargeMid) this.fire(1);
      p.charge = 0;
    }
    this.def.checkpoints.forEach(([cx, cy], i) => {
      if (i > this.checkpointIndex && p.x > cx) {
        this.checkpointIndex = i;
        this.checkpoint = [cx, Math.max(cy, p.y)];
        this.fx.push({ kind: "checkpoint", x: cx, y: cy, at: this.time });
        this.onEvent?.("checkpoint");
      }
    });
    if (!this.bossActive && p.x > ax + 1 && p.x < bx) {
      this.bossActive = true;
      const boss = this.enemies.find((e) => e.kind === "boss");
      if (boss) {
        boss.awake = true;
        boss.timer = 1.5;
      }
    }
  }

  private touchesSpike(x: number, y: number, w: number) {
    for (let c = Math.floor(x - w / 2 + 0.1); c <= Math.floor(x + w / 2 - 0.1); c++) {
      if (this.tile(c, Math.floor(y + 0.05)) === "^") return true;
    }
    return false;
  }

  private fire(level: 0 | 1 | 2) {
    const p = this.player;
    const S = T.shot;
    if (level === 0 && this.shots.filter((s) => !s.enemy && s.level === 0).length >= S.maxSmall) return;
    const spec = level === 0 ? S.small : level === 1 ? S.mid : S.full;
    // Bám tường thì bắn ra phía ngược tường
    const dir = p.wall !== 0 ? (-p.wall as 1 | -1) : p.facing;
    this.shots.push({
      x: p.x + dir * 0.7,
      y: p.y + 1.15,
      vx: dir * spec.speed,
      vy: 0,
      r: spec.r,
      dmg: spec.dmg,
      pierce: level === 2,
      life: S.life,
      enemy: false,
      level,
    });
    p.shootTimer = 0.3;
    this.fx.push({ kind: "shot", x: p.x + dir * 0.7, y: p.y + 1.15, at: this.time });
  }

  hurt(amount: number, from: 1 | -1) {
    const p = this.player;
    if (p.invuln > 0 || this.status !== "playing") return;
    p.hp = Math.max(0, p.hp - amount);
    p.invuln = T.player.invuln;
    p.knock = T.player.knockTime;
    p.vx = from * T.player.knockSpeed;
    p.vy = Math.max(p.vy, 4);
    p.dashTime = 0;
    this.fx.push({ kind: "hurt", x: p.x, y: p.y + 1, at: this.time });
    if (p.hp <= 0) this.kill();
  }

  private kill() {
    if (this.status !== "playing") return;
    this.player.hp = 0;
    this.status = "dead";
    this.deadAt = this.time;
    this.fx.push({ kind: "boom", x: this.player.x, y: this.player.y + 1, at: this.time });
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    const E = T.enemy;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.kind !== "boss") e.awake = Math.abs(e.x - p.x) < E.wakeRange;
      if (!e.awake) continue;
      e.timer -= dt;
      const dx = p.x - e.x;
      if (e.kind === "trooper") {
        // Tuần tra quanh điểm gốc; thấy người chơi thì quay mặt lại và bắn
        const sees = Math.abs(dx) < E.trooper.sight && (this.mode === "shmup" || Math.abs(p.y - e.y) < 3);
        if (sees) {
          e.facing = dx > 0 ? 1 : -1;
          e.vx = 0;
          if (e.timer <= 0) {
            e.timer = E.trooper.fireEvery;
            e.firedAt = this.time;
            this.shots.push({ x: e.x + e.facing * 0.7, y: e.y + 1.2, ...this.aim(e.x, e.y + 1.2, e.facing, E.trooper.shotSpeed), r: 0.18, dmg: E.trooper.shotDamage, pierce: false, life: 3, enemy: true, level: 0 });
          }
        } else {
          if (Math.abs(e.x - e.homeX) > E.trooper.patrol) e.facing = e.x > e.homeX ? -1 : 1;
          e.vx = e.facing * E.trooper.walk;
          // Không bước ra khỏi mép
          const ahead = Math.floor(e.x + e.facing * 0.7);
          if (!this.solid(ahead, Math.floor(e.y) - 1) && this.tile(ahead, Math.floor(e.y) - 1) !== "=") e.facing = (-e.facing) as 1 | -1;
        }
        this.fall(e, dt);
      } else if (e.kind === "zombie") {
        // Lừ đừ tiến về phía người chơi
        const near = Math.abs(dx) < E.zombie.sight;
        e.facing = near ? (dx > 0 ? 1 : -1) : e.facing;
        e.vx = near ? e.facing * E.zombie.chase : e.facing * E.zombie.walk;
        const ahead = Math.floor(e.x + e.facing * 0.6);
        if (!this.solid(ahead, Math.floor(e.y) - 1) || this.solid(ahead, Math.floor(e.y))) {
          e.facing = (-e.facing) as 1 | -1;
          e.vx = 0;
        }
        this.fall(e, dt);
      } else if (e.kind === "drone") {
        // Bay lượn sóng quanh điểm gốc, thỉnh thoảng bắn chéo về phía người chơi
        const t = this.time + e.id;
        e.x = e.homeX + Math.sin(t * 0.8) * E.drone.sway;
        e.y = e.homeY + Math.sin(t * 2.1) * 0.6;
        e.facing = dx > 0 ? 1 : -1;
        if (e.timer <= 0 && Math.abs(dx) < E.drone.sight) {
          e.timer = E.drone.fireEvery;
          e.firedAt = this.time;
          const ty = p.y + 1 - (e.y + 0.4);
          const len = Math.hypot(dx, ty) || 1;
          this.shots.push({ x: e.x, y: e.y + 0.4, vx: (dx / len) * E.drone.shotSpeed, vy: (ty / len) * E.drone.shotSpeed, r: 0.2, dmg: E.drone.shotDamage, pierce: false, life: 4, enemy: true, level: 0 });
        }
      } else if (e.kind === "boss") {
        this.updateBoss(e, dt);
      }
      // Chạm thân địch
      if (overlap(p, e)) this.hurt(e.kind === "boss" ? E.boss.contactDamage : E.contactDamage, p.x < e.x ? -1 : 1);
    }
  }

  /** Hướng đạn địch: chế độ bay thì nhắm vào người chơi (người chơi bay trên cao), còn lại bắn ngang */
  private aim(x: number, y: number, facing: 1 | -1, speed: number) {
    if (this.mode !== "shmup") return { vx: facing * speed, vy: 0 };
    const dx = this.player.x - x;
    const dy = this.player.y + this.player.h / 2 - y;
    const len = Math.hypot(dx, dy) || 1;
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }

  private fall(e: Enemy, dt: number) {
    e.vy = Math.max(-T.player.maxFall, e.vy - T.player.gravity * dt);
    const r = this.move(e, dt);
    e.onGround = r.ground;
    if (r.wall !== 0) e.facing = (-r.wall) as 1 | -1;
    if (e.y < -3) {
      e.alive = false;
      e.deadAt = this.time;
    }
  }

  private updateBoss(e: Enemy, dt: number) {
    const p = this.player;
    const B = T.enemy.boss;
    const rage = e.hp < e.maxHp / 2 ? B.rageSpeedup : 1;
    const dx = p.x - e.x;
    if (e.onGround) e.facing = dx > 0 ? 1 : -1;
    if (e.timer <= 0) {
      // Chọn đòn tiếp theo: đi tới, nhảy đè, hoặc bắn loạt đạn
      const r = (Math.sin(this.time * 12.9898 + e.id) + 1) / 2;
      e.move = r < 0.35 ? "walk" : r < 0.65 ? "jump" : "volley";
      e.timer = (e.move === "walk" ? 1.6 : e.move === "jump" ? 1.4 : 1.8) / rage;
      if (e.move === "jump" && e.onGround) {
        e.vy = B.jumpVel;
        e.vx = THREE_clamp(dx * 0.9, -B.jumpSpeed, B.jumpSpeed);
      }
      if (e.move === "volley") e.vx = 0;
    }
    if (e.move === "walk") e.vx = e.facing * B.walk * rage;
    if (e.move === "volley") {
      // Ba phát liên tiếp, phát giữa bắn thấp
      const k = Math.floor((1.8 / rage - e.timer) / (0.45 / rage));
      if (k >= 0 && k < 3 && this.time - e.firedAt > 0.4 / rage) {
        e.firedAt = this.time;
        const y = e.y + (k === 1 ? 0.6 : 1.9);
        this.shots.push({ x: e.x + e.facing * 1.4, y, ...this.aim(e.x, y, e.facing, B.shotSpeed), r: 0.3, dmg: B.shotDamage, pierce: false, life: 3, enemy: true, level: 1 });
      }
    }
    const wasAir = !e.onGround;
    this.fall(e, dt);
    // Đáp đất sau cú nhảy: sóng chấn động chạy hai bên sát đất
    if (wasAir && e.onGround && e.move === "jump") {
      e.vx = 0;
      this.fx.push({ kind: "land", x: e.x, y: e.y, at: this.time });
      for (const s of [1, -1]) this.shots.push({ x: e.x + s * 1.5, y: e.y + 0.3, vx: s * B.waveSpeed, vy: 0, r: 0.35, dmg: B.waveDamage, pierce: false, life: 2.2, enemy: true, level: 2 });
    }
    // Giữ trùm trong phòng
    const [ax, bx] = this.def.bossArena;
    e.x = Math.max(ax + e.w / 2, Math.min(bx - e.w / 2 + 1, e.x));
  }

  private updateShots(dt: number) {
    const p = this.player;
    for (const s of this.shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      // Đạn thường vỡ khi chạm tường; sóng chấn động đi sát đất
      if (this.solid(Math.floor(s.x), Math.floor(s.y)) && s.level !== 2) s.life = 0;
      if (s.life <= 0) continue;
      if (s.enemy) {
        if (Math.abs(s.x - p.x) < p.w / 2 + s.r && s.y > p.y - s.r && s.y < p.y + p.h + s.r) {
          this.hurt(s.dmg, s.vx > 0 ? 1 : -1);
          s.life = 0;
        }
        continue;
      }
      for (const e of this.enemies) {
        if (!e.alive || !e.awake) continue;
        if (Math.abs(s.x - e.x) < e.w / 2 + s.r && s.y > e.y - s.r && s.y < e.y + e.h + s.r) {
          e.hp -= s.dmg;
          e.hurtAt = this.time;
          this.fx.push({ kind: "hit", x: s.x, y: s.y, at: this.time });
          if (e.hp <= 0) {
            e.alive = false;
            e.deadAt = this.time;
            this.kills++;
            this.onEvent?.("kill", { enemy: e });
            this.spawnDrops(e.x, e.y + e.h * 0.5, rollEnemyDrops(e.kind, this.loot));
            this.fx.push({ kind: "boom", x: e.x, y: e.y + e.h / 2, at: this.time });
            if (e.kind === "boss") this.clear();
            // Thỉnh thoảng rơi viên máu
            else if (this.kills % 3 === 0) this.spawnDrops(e.x, e.y + 0.6, [{ kind: "health" }]);
          }
          if (!s.pierce) {
            s.life = 0;
            break;
          }
        }
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0 && s.x > -2 && s.x < this.width + 2);
  }

  /** Đồ bật ra từ địch / rương, toả hai bên rồi rơi xuống đất */
  private spawnDrops(x: number, y: number, drops: LootDrop[]) {
    drops.forEach((drop, i) => {
      const spread = drops.length > 1 ? (i / (drops.length - 1) - 0.5) * 2 : 0;
      this.pickups.push({ x, y, vx: spread * 2.2, vy: 6 + (i % 2) * 1.5, drop, taken: false, bornAt: this.time });
    });
  }

  private updatePickups(dt: number) {
    const p = this.player;
    const L = T.loot;
    for (const k of this.pickups) {
      if (k.taken) continue;
      // Gần người chơi thì bị hút về (đỡ phải nhảy nhặt từng món)
      const dx = p.x - k.x;
      const dy = p.y + p.h / 2 - k.y;
      const d = Math.hypot(dx, dy);
      const age = this.time - k.bornAt;
      const flying = this.mode === "shmup";
      if (age > L.pickupDelay && d < L.magnetRange * (flying ? 2 : 1) && (k.drop.kind !== "health" || flying)) {
        k.x += (dx / d) * L.magnetSpeed * dt;
        k.y += (dy / d) * L.magnetSpeed * dt;
      } else if (flying) {
        // Bay: đồ lơ lửng tại chỗ, chỉ tản ra một chút rồi dừng
        k.x += k.vx * dt;
        k.y += k.vy * dt * 0.3;
        k.vx *= 0.9;
        k.vy *= 0.9;
      } else if (k.vx !== 0 || k.vy !== 0 || !this.hits(k.x, k.y - 0.05, 0.3, 0.05)) {
        k.vy = Math.max(-T.player.maxFall, k.vy - T.player.gravity * dt);
        const box = { x: k.x, y: k.y, vx: k.vx, vy: k.vy, w: 0.3, h: 0.3 };
        const m = this.move(box, dt);
        k.x = box.x;
        k.y = box.y;
        k.vx = m.ground ? 0 : box.vx * 0.99;
        k.vy = box.vy;
        if (k.y < -3) k.taken = true;
      }
      if (age > L.pickupDelay && Math.abs(k.x - p.x) < 0.8 && k.y > p.y - 0.5 && k.y < p.y + p.h) this.take(k);
    }
    // Rương: chạm vào khi có chìa thì mở, không có chìa thì nhắc
    for (const c of this.chests) {
      if (c.opened || Math.abs(c.x - p.x) > 0.9 || Math.abs(c.y - p.y) > 1) continue;
      if (this.chestKeys > 0) {
        this.chestKeys--;
        c.opened = true;
        this.fx.push({ kind: "pickup", x: c.x, y: c.y + 0.6, at: this.time });
        this.onEvent?.("chest", { chest: c });
        this.spawnDrops(c.x, c.y + 0.8, chestContents(c.tier, this.loot));
      } else if (this.time - c.lockedHintAt > 2) {
        c.lockedHintAt = this.time;
        this.onEvent?.("chestLocked", { chest: c });
      }
    }
  }

  private take(k: Pickup) {
    const p = this.player;
    k.taken = true;
    this.fx.push({ kind: "pickup", x: k.x, y: k.y, at: this.time });
    if (k.drop.kind === "health") {
      p.hp = Math.min(T.player.maxHp, p.hp + T.player.healthPickup);
      return;
    }
    if (k.drop.kind === "chestKey") this.chestKeys++;
    this.collected.push(k.drop);
    this.onEvent?.("loot", { drop: k.drop });
  }

  private clear() {
    // Qua màn: gom luôn đồ còn nằm trên đất (đồ trùm rơi)
    for (const k of this.pickups) if (!k.taken && k.drop.kind !== "health") this.take(k);
    this.status = "cleared";
    this.clearedAt = this.time;
    this.shots = [];
    this.onEvent?.("cleared");
  }

  get boss() {
    return this.enemies.find((e) => e.kind === "boss") ?? null;
  }
}

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y < b.y + b.h && b.y < a.y + a.h;
}

function THREE_clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function makeEnemy(id: number, kind: EnemyKind, x: number, y: number): Enemy {
  const E = T.enemy;
  const spec = kind === "trooper" ? E.trooper : kind === "drone" ? E.drone : kind === "zombie" ? E.zombie : E.boss;
  return {
    id,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    w: spec.w,
    h: spec.h,
    hp: spec.hp,
    maxHp: spec.hp,
    facing: -1,
    homeX: x,
    homeY: y,
    alive: true,
    awake: false,
    timer: 1 + (id % 3) * 0.4,
    firedAt: -9,
    hurtAt: -9,
    deadAt: 0,
    onGround: false,
    move: "idle",
  };
}
