// Lõi màn chơi đi ngang kiểu Rockman X: thuần TypeScript, bước cố định 1/60s, test được.
// Đơn vị: 1 ô = 1 mét. Trục x sang phải, trục y lên trên. Hiển thị 3D nằm ở LevelScene.tsx.

import { LEVEL_TUNING as T } from "./levelTuning";
import type { ThemeId } from "./themes";
import { chestContents, rollEnemyDrops, type ChestTier, type LootContext, type LootDrop } from "./loot";
import { freshPity, type PityState } from "../sim/loot";
import { createRng } from "../sim/rng";
import { ARMORS, GEAR, NO_STATS, WEAPONS, type ArmorId, type Stats, type WeaponId } from "./gear";

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; jump: boolean; shoot: boolean; dash: boolean; melee?: boolean };
export const NO_INPUT: Input = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dash: false, melee: false };

/**
 * Kiểu chơi của map:
 * - platform: chạy, nhảy, bắn ngang (Mega Man X)
 * - climb: leo ngược lên tháp, sương ma dâng từ dưới, chạm sương là mất mạng (Ice Climber / Kid Icarus)
 * - shmup: cưỡi xe bay, màn hình tự cuộn sang phải, bay tự do bốn hướng, chạm địa hình bị thương (Gradius / Metal Slug)
 * - topdown: đi 8 hướng trên mặt đất (y là chiều sâu), bắn theo hướng nhìn (Zelda / Final Fantasy Tactics nhìn chéo)
 */
export type PlayMode = "platform" | "climb" | "shmup" | "topdown";

export type Box = { x: number; y: number; w: number; h: number };

export type EnemyKind = "trooper" | "drone" | "zombie" | "boss";

/**
 * Biến thể quái (mỗi loại có vài kiểu đánh riêng, xen kẽ trong màn):
 * - trooper: basic (bắn thường, nhảy né), shield (khiên chặn đạn phía trước, phải chém vỡ, đập khiên),
 *   sniper (tia ngắm đỏ 1 giây rồi bắn một phát rất mạnh), grenadier (ném lựu đạn vòng cung, vòng nổ báo trước)
 * - zombie: basic (vồ), exploder (chạy tới, nháy đỏ rồi tự nổ, nổ cả quái khác), spitter (phun axit thành vũng độc)
 * - drone: basic (bổ nhào), bomber (bay trên đầu thả bom, cột cảnh báo), laser (nạp rồi quét tia laser ngang)
 */
export type Trait = "basic" | "shield" | "sniper" | "grenadier" | "exploder" | "spitter" | "bomber" | "laser" | "blink" | "pulse" | "mortar" | "charger" | "summoner" | "chain" | "curse";

/** Vùng nguy hiểm có báo trước: hiện viền đỏ từ `warnAt`, gây sát thương từ `liveAt` tới `endAt` */
export type HazardKind = "blast" | "fire" | "laser" | "hands" | "rock" | "elec" | "acid" | "crystal" | "tentacle" | "shock" | "void" | "pulse" | "curse";
export type Hazard = {
  id: number;
  kind: HazardKind;
  shape: "rect" | "circle" | "line";
  /** rect: góc dưới trái (x0, y0) → góc trên phải (x1, y1); circle: tâm (x0, y0) bán kính r; line: đoạn (x0, y0)–(x1, y1) dày r */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  r: number;
  warnAt: number;
  liveAt: number;
  endAt: number;
  dmg: number;
  /** Đã trúng người chơi (mỗi vùng chỉ trúng một lần) */
  hit: boolean;
  /** Vùng do người chơi gây ra (lựu đạn tự nổ của quái thì làm hại cả quái khác) */
  hurtsEnemies?: boolean;
};

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
  move: "walk" | "jump" | "volley" | "idle" | "windup" | "charge" | "vanish" | "appear" | "breath" | "rest" | "slam";
  /** Trúng lưỡi băng: chậm lại tới thời điểm này */
  slowUntil: number;
  /** Trùm: đang có khiên / vảy / mắt nhắm (đạn bật ra, không mất máu) */
  guard: boolean;
  /** Trùm bị choáng tới lúc này (hết khiên, nhận sát thương tăng) */
  stunUntil: number;
  /** Hệ số sát thương nhận vào lúc lộ điểm yếu */
  weakMul: number;
  /** Gợi ý mẹo đánh trùm hiện trên HUD */
  cue: string;
  /** Độ hiện hình 0–1 (La Madre ẩn hình) */
  fade: number;
  /** Số tên lửa của trùm bị bắn hạ (Director Vane: đủ 3 thì vỡ khiên) */
  broken: number;
  /** Kỹ năng riêng của quái: lần vồ / né / bổ nhào gần nhất */
  skillAt: number;
  /** Lính do trùm gọi ra: không rơi đồ */
  minion: boolean;
  /** Bị chém bật lùi: khựng lại, không ra đòn tới lúc này */
  staggerUntil: number;
  trait: Trait;
  /** Đang báo trước đòn (ngắm, nạp, nháy) từ lúc này; -9 là không */
  tele: number;
  /** Điểm ngắm đã khoá khi báo trước (tia ngắm của lính bắn tỉa, laser của drone, tia mắt của trùm) */
  aimX: number;
  aimY: number;
  /** Lính khiên: khiên còn chịu được bao nhiêu nhát chém */
  shieldHp: number;
  /** Trùm: giai đoạn 2 khi máu dưới một nửa (thêm chiêu, nhanh hơn) */
  phase: 1 | 2;
  /** Trùm: chiêu đặc biệt kế tiếp ra lúc này */
  atkAt: number;
  atkN: number;
};

/**
 * Kiểu trùm (mỗi trùm một mẹo):
 * - brute: đi, nhảy đè tạo sóng chấn động, bắn loạt (mặc định)
 * - charger: có khiên; gồng rồi lao thẳng — né để nó đâm vào tường thì choáng, hết khiên
 * - phantom: ẩn hình (miễn sát thương) rồi hiện ra chỗ khác, chỉ đánh được lúc vừa hiện; gọi hồn ma
 * - dragon: bay; vảy cứng, chỉ trúng khi há miệng phun lửa
 * - overlord: khiên năng lượng; bắn tên lửa đuổi — bắn hạ 3 quả thì khiên quá tải
 * - armored: giáp trước mặt; đập chuỳ xuống đất (sóng toả) rồi bị kẹt chuỳ — lúc đó mới đánh được
 * - watcher: mắt nhắm thì miễn sát thương, gọi lính; mắt mở mới trúng (×2)
 */
export type BossStyle = "brute" | "charger" | "phantom" | "dragon" | "overlord" | "armored" | "watcher";

export type Difficulty = "easy" | "normal" | "hard" | "nightmare";

/** Hình đạn để vẽ: viên thường, đạn chùm, tia ngắm, mũi tên, nhát chém, sóng kiếm */
export type ShotKind = "bullet" | "pellet" | "rail" | "arrow" | "slash" | "wave" | "grenade" | "acid" | "bomb" | "orb" | "snipe" | "shard" | "chuong";

export type Shot = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  pierce: boolean;
  life: number;
  enemy: boolean;
  level: 0 | 1 | 2;
  /** Vũ khí trang bị: hình đạn, hướng (cho nhát chém đứng yên), đóng băng, địch đã trúng (đạn xuyên chỉ trúng mỗi địch một lần) */
  kind?: ShotKind;
  dx?: number;
  dy?: number;
  freeze?: boolean;
  hitIds?: number[];
  maxLife?: number;
  /** Tên lửa trùm: bắn hạ được, đuổi theo người chơi */
  missile?: boolean;
  /** Nhát cận chiến: thứ tự trong chuỗi combo (0, 1, 2 = nhát kết liễu) */
  melee?: 0 | 1 | 2;
  /** Lực đánh bật địch khi trúng */
  knock?: number;
  /** Đạn rơi theo trọng lực (lựu đạn, axit, bom) */
  grav?: number;
  /** Chạm đất thì: lựu đạn nằm chờ nổ, axit thành vũng độc, bom nổ ngay */
  lands?: "grenade" | "acid" | "bomb";
  /** Đạn đuổi theo người chơi (độ bẻ lái mỗi giây) */
  home?: number;
};

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
  /** Vũ khí và giáp đang trang bị (gear.ts) */
  weapon?: WeaponId;
  armor?: ArmorId;
  /** Độ khó: máu / sát thương địch, phần thưởng */
  difficulty?: Difficulty;
  /** Chỉ số cộng từ tủ đồ (mũ, găng, giày, chip, cấp cường hoá) */
  stats?: Stats;
};

export type SimEvent = "kill" | "checkpoint" | "cleared" | "loot" | "chest" | "chestLocked";

export type FxKind = "hit" | "boom" | "shot" | "charge" | "hurt" | "pickup" | "checkpoint" | "land" | "dash" | "dust" | "block" | "slam" | "swing" | "crit" | "text" | "coin" | "bigboom" | "warn" | "swap";
/** Sự kiện hình ảnh / âm thanh cho LevelScene. `n`: tham số phụ (nhát combo, cỡ nổ…), `text`/`color`: chữ bay lên */
export type FxEvent = { kind: FxKind; x: number; y: number; at: number; n?: number; text?: string; color?: string };

export type LevelDef = {
  id: string;
  name: string;
  /** Hàng trên cùng trước. '#' đặc, '=' bậc nhảy xuyên lên được, '^' gai, 'o' chân đạo cụ (đặc, không vẽ), '.' trống */
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
  /** Kiểu trùm và mẹo hạ trùm */
  bossStyle?: BossStyle;
  /** Biến thể quái xuất hiện trong màn, xoay vòng theo thứ tự từng loại (mặc định: DEFAULT_TRAITS) */
  traits?: Partial<Record<Exclude<EnemyKind, "boss">, Trait[]>>;
};

export const DEFAULT_TRAITS: Record<Exclude<EnemyKind, "boss">, Trait[]> = {
  trooper: ["basic", "shield", "sniper", "grenadier"],
  zombie: ["basic", "exploder", "basic", "spitter"],
  drone: ["basic", "bomber", "laser"],
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
    /** Nhảy kép trên không còn lại */
    airJumps: 1,
    /** Đang đập đất (rơi thẳng xuống) */
    slam: false,
    /** Đang ở sát tường bên nào khi trên không (cho động tác leo/trượt tường) */
    wallNear: 0 as -1 | 0 | 1,
    /** Hướng ngắm khi đi 8 hướng (chế độ topdown) */
    aimX: 1,
    aimY: 0,
    /** Hướng đi gần nhất (nhìn từ trên): thân nhân vật quay theo hướng này */
    moveX: 1,
    moveY: 0,
    /** Vũ khí trang bị: còn bao lâu mới bắn / chém tiếp được */
    cooldown: 0,
    /** Cận chiến: nhát thứ mấy trong combo, lúc ra đòn gần nhất, còn bao lâu mới chém tiếp */
    meleeStep: 0 as 0 | 1 | 2,
    meleeAt: -9,
    meleeCd: 0,
    /** Chế độ vũ khí: súng cầm tay (kiếm đeo sau lưng) hoặc kiếm trên tay; nút L đổi qua lại */
    weaponMode: "gun" as "gun" | "sword",
    swapAt: -9,
    /** Dính lời nguyền (vũng tím ở Giáo Xứ): đi chậm tới lúc này */
    slowUntil: -9,
    /** Lúc phóng sóng kiếm gần nhất (để vẽ đúng động tác chém nạp) */
    waveAt: -9,
    /** Ngắm khi đi ngang (giữ W / ↑): 0 thẳng ngang, 1 chéo lên, 2 thẳng lên */
    aimUp: 0 as 0 | 1 | 2,
  };
  readonly weapon: WeaponId;
  readonly armor: ArmorId;
  readonly difficulty: Difficulty;
  readonly stats: Stats;
  /** Máu tối đa (cơ bản + giáp) */
  readonly maxHp: number;
  enemies: Enemy[] = [];
  shots: Shot[] = [];
  pickups: Pickup[] = [];
  fx: FxEvent[] = [];
  hazards: Hazard[] = [];
  private hazardId = 0;
  /** Lời hô to giữa màn hình khi trùm ra chiêu lớn / nổi điên */
  callout: { text: string; at: number; color: string } | null = null;
  checkpoint: [number, number];
  checkpointIndex = -1;
  bossActive = false;
  kills = 0;
  deaths = 0;
  /** Chuỗi hạ địch liên tiếp (mỗi lần hạ trong vòng vài giây thì tăng), điểm số */
  combo = 0;
  comboAt = -99;
  bestCombo = 0;
  score = 0;
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
  /** Ngẫu nhiên riêng cho hiệu ứng (hướng văng đồ…), không làm lệch bảng rơi đồ */
  private fxRng: () => number;
  /** Trùm vừa gục: chờ mưa đồ rơi xong mới qua màn */
  clearAt = 0;
  private nextId = 0;
  private acc = 0;

  constructor(def: LevelDef, opts: SimOptions = {}) {
    this.loot = { rng: createRng(opts.seed ?? (Date.now() & 0xffffff)), pity: opts.pity ?? freshPity(), mapMultiplier: opts.mapMultiplier ?? 1 };
    this.fxRng = createRng((opts.seed ?? 7) * 31 + 5);
    this.chestKeys = opts.chestKeys ?? 0;
    this.weapon = opts.weapon ?? "buster";
    this.armor = opts.armor ?? "none";
    this.stats = opts.stats ?? NO_STATS;
    this.maxHp = T.player.maxHp + ARMORS[this.armor].hp + Math.round(this.stats.hp);
    this.difficulty = opts.difficulty ?? "normal";
    this.mode = def.mode ?? "platform";
    // Nhìn từ trên: thân người chơi là ô vuông nhỏ trên mặt đất
    if (this.mode === "topdown") this.player.h = T.topdown.body;
    this.chests = (def.chests ?? []).map((c) => ({ ...c, opened: false, lockedHintAt: -99 }));
    this.def = def;
    this.grid = def.rows;
    this.height = def.rows.length;
    this.width = Math.max(...def.rows.map((r) => r.length));
    this.checkpoint = def.start;
    this.reset(def.start);
    // Trang bị kiếm thì vào màn đã cầm kiếm sẵn
    if (this.bladeGear) this.player.weaponMode = "sword";
    this.scrollX = def.start[0] + T.shmup.viewHalf - 3;
    let id = 0;
    const D = T.difficulty[opts.difficulty ?? "normal"];
    this.loot.mapMultiplier *= D.reward * (1 + this.stats.luck);
    const seen: Record<string, number> = {};
    this.enemies = def.enemies.map((e) => {
      const en = makeEnemy(id++, e.kind, e.x, e.y);
      if (e.kind !== "boss") {
        // Biến thể xoay vòng theo thứ tự xuất hiện; màn bay chỉ có drone laser bay được ngang
        const list = def.traits?.[e.kind] ?? DEFAULT_TRAITS[e.kind];
        const i = (seen[e.kind] = (seen[e.kind] ?? -1) + 1);
        en.trait = list[i % list.length];
        if (this.mode === "shmup" && en.trait !== "laser" && en.trait !== "mortar") en.trait = "basic";
        const S = T.traits;
        if (en.trait === "shield") en.shieldHp = S.shield.hits;
        if (en.trait === "exploder") en.maxHp = S.exploder.hp;
        if (en.trait === "sniper") en.maxHp = S.sniper.hp;
        en.hp = en.maxHp;
        // Drone đi ngang: không bay cao quá tầm bắn chéo của người chơi
        if (e.kind === "drone" && (this.mode === "platform" || this.mode === "climb")) {
          const gy = this.groundBelow(e.x, e.y);
          en.y = en.homeY = Math.min(en.y, gy + T.enemy.drone.maxAlt);
        }
      }
      en.hp = en.maxHp = Math.round(en.maxHp * D.hp * 10) / 10;
      // Nhìn từ trên: thân địch là ô vuông trên mặt đất (chiều cao đứng không còn là chiều sâu)
      if (this.mode === "topdown") en.h = Math.min(en.h, en.w);
      return en;
    });
    this.nextId = id;
    this.pickups = def.pickups.map(([x, y]) => ({ x, y, vx: 0, vy: 0, drop: { kind: "health" as const }, taken: false, bornAt: -99 }));
  }

  private reset([x, y]: [number, number]) {
    const p = this.player;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.hp = this.maxHp;
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
    // "o": chân đạo cụ lớn, đặc nhưng không vẽ khối
    if (t === "#" || t === "o") return true;
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

  /** Lệch tối đa `max` theo hướng (sx, sy) thì đi tiếp được theo hướng đang bị chặn không: trả về độ lệch cần */
  private freeShift(e: { x: number; y: number; vx: number; vy: number; w: number; h: number }, sx: number, sy: number, max: number, dirX = Math.sign(e.vx), dirY = Math.sign(e.vy)) {
    const step = 0.02;
    for (let d = step; d <= max + 1e-9; d += step) {
      const x = e.x + sx * d;
      const y = e.y + sy * d;
      if (this.hits(x, y, e.w, e.h)) continue;
      if (!this.hits(x + dirX * 0.05, y + dirY * 0.05, e.w, e.h)) return sx !== 0 ? sx * d : sy * d;
    }
    return null;
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
    const pressed = (k: keyof Input) => !!input[k] && !this.prev[k];
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
            boss.broken = 0;
            boss.stunUntil = -1;
          }
          // Lính trùm gọi ra biến mất theo, vào lại phòng là trận đấu mới
          this.enemies = this.enemies.filter((e) => !e.minion);
        }
        this.shots = this.shots.filter((s) => !s.enemy);
        this.hazards = [];
      }
      this.prev = input;
      return;
    }

    if (this.clearAt && this.time >= this.clearAt) {
      this.clear();
      this.prev = input;
      return;
    }
    if (this.mode === "shmup") this.updateFlyer(dt, input, pressed);
    else if (this.mode === "topdown") this.updateWalker(dt, input, pressed);
    else this.updatePlayer(dt, input, pressed);
    if (this.mode === "climb") this.updateFog(dt);
    if (this.mode === "topdown") this.updateEnemiesTop(dt);
    else this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateHazards();
    this.updatePickups(dt);
    this.prev = input;
  }

  private gravityOnly(dt: number) {
    const p = this.player;
    // Bay và đi 8 hướng không có trọng lực: đứng yên chờ READY
    if (this.mode === "shmup" || this.mode === "topdown") return;
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
      const run = P.runSpeed * (1 + this.stats.speed);
      const speed = p.onGround ? run : Math.max(run, Math.abs(p.vx) * (p.dashCarry ? 1 : 0));
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
        p.vy = P.jumpVel * (1 + this.stats.jump);
        p.coyote = 0;
        p.jumpBuffer = 0;
        p.dashCarry = dashing || input.dash;
        p.dashTime = 0;
      } else if (input.down && pressed("jump") && !p.slam) {
        // Đập đất: rơi thẳng xuống, chạm đất tạo sóng chấn động hạ quái quanh mình
        p.slam = true;
        p.vy = -P.slamSpeed;
        p.vx = 0;
        p.jumpBuffer = 0;
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
      } else if (p.airJumps > 0 && pressed("jump")) {
        // Nhảy kép giữa không trung
        p.airJumps--;
        p.vy = P.jumpVel * P.airJumpMul;
        p.jumpBuffer = 0;
        this.fx.push({ kind: "dust", x: p.x, y: p.y, at: this.time });
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
    else if (p.slam) p.vy = -P.slamSpeed;
    else p.vy -= g * dt;
    p.vy = Math.max(p.slam ? -P.slamSpeed : p.wall !== 0 ? -P.wallSlide : -P.maxFall, p.vy);

    const wasGround = p.onGround;
    const rising = p.vy;
    const m = this.move(p, dt);
    // Sửa góc trần (kiểu Celeste): nhảy lên cụng mép trần mà chỉ lệch chút xíu thì tự lách qua, giữ đà nhảy
    if (rising > 0 && p.vy === 0 && !m.ground)
      for (const sx of p.vx >= 0 ? [1, -1] : [-1, 1]) {
        const off = this.freeShift(p, sx, 0, P.cornerCorrect, 0, 1);
        if (off !== null) {
          p.x += off;
          p.vy = rising;
          break;
        }
      }
    p.onGround = m.ground || this.standing(p.x, p.y, p.w);
    if (p.onGround && p.vy <= 0) p.dashCarry = false;
    p.wallNear = 0;
    if (!p.onGround) {
      const toward = (dir !== 0 ? dir : p.facing) as -1 | 1;
      if (this.touchingWall(p.x, p.y, p.w, p.h, toward, P.wallGrace)) p.wallNear = toward;
      else if (this.touchingWall(p.x, p.y, p.w, p.h, -toward as -1 | 1, 0.12)) p.wallNear = -toward as -1 | 1;
    }
    if (!wasGround && p.onGround) this.fx.push({ kind: "land", x: p.x, y: p.y, at: this.time });
    if (p.onGround || p.wall !== 0) p.airJumps = 1;
    if (p.slam && p.onGround) {
      p.slam = false;
      this.fx.push({ kind: "slam", x: p.x, y: p.y, at: this.time });
      for (const e of this.enemies)
        if (e.alive && e.awake && Math.abs(e.x - p.x) < P.slamRadius && Math.abs(e.y - p.y) < 1.6) this.damageEnemy(e, P.slamDamage, e.x, e.y + 0.5);
    }

    p.aimUp = input.up ? (dir !== 0 ? 1 : 2) : 0;
    this.handleShoot(input, pressed, dt);

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
        boss.atkAt = this.time + 3.5;
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
    this.handleShoot(input, pressed, dt);
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
        boss.atkAt = this.time + 3.5;
      }
    }
  }

  /** Đi 8 hướng trên mặt đất: không trọng lực, va tường, lướt nhanh, bắn theo hướng nhìn */
  private updateWalker(dt: number, input: Input, pressed: (k: keyof Input) => boolean) {
    const p = this.player;
    const W = T.topdown;
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      // Nhân vật luôn quay mặt theo hướng đi (không đi lùi)
      p.moveX = dx;
      p.moveY = dy;
      if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
    }
    // Ngắm hỗ trợ: có quái trong hình nón trước mặt thì nòng súng tự bẻ về phía nó
    const AA = W.autoAim;
    let best: { x: number; y: number; d: number } | null = null;
    for (const e of this.enemies) {
      if (!e.alive || !e.awake) continue;
      const ex = e.x - p.x;
      const ey = e.y + e.h / 2 - (p.y + p.h / 2);
      const d = Math.hypot(ex, ey);
      if (d > AA.range || d < 0.01) continue;
      const cos = (ex * p.moveX + ey * p.moveY) / d;
      // Đứng yên: tự quay về quái gần nhất mọi hướng; đang chạy: chỉ ngắm trong hình nón trước mặt
      if (len > 0 && cos < Math.cos(AA.cone)) continue;
      // Ưu tiên quái gần và nằm giữa tầm ngắm
      const score = d * (2 - cos);
      if (!best || score < best.d) best = { x: ex / d, y: ey / d, d: score };
    }
    p.aimX = best ? best.x : p.moveX;
    p.aimY = best ? best.y : p.moveY;
    if (pressed("dash") && p.dashTime <= 0) {
      p.dashTime = W.dashTime;
      this.fx.push({ kind: "dash", x: p.x, y: p.y, at: this.time });
    }
    p.dashTime -= dt;
    p.knock -= dt;
    const speed = W.speed * (1 + this.stats.speed) * (p.dashTime > 0 ? W.dashMul : 1) * (this.time < p.slowUntil ? T.traits.curse.slow : 1);
    if (p.knock <= 0) {
      p.vx = dx * speed;
      p.vy = dy * speed;
    } else {
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
    const want = { vx: p.vx, vy: p.vy };
    this.move(p, dt);
    // Trượt góc (kiểu Zelda): bị góc tường chặn mà chỉ lệch chút xíu thì tự lách vào lối đi
    const A = T.topdown.cornerAssist;
    if (want.vx !== 0 && p.vx === 0 && want.vy === 0)
      for (const s of [1, -1]) {
        const off = this.freeShift(p, 0, s, A);
        if (off !== null) {
          p.y += Math.sign(off) * Math.min(Math.abs(off), W.speed * dt);
          break;
        }
      }
    if (want.vy !== 0 && p.vy === 0 && want.vx === 0)
      for (const s of [1, -1]) {
        const off = this.freeShift(p, s, 0, A);
        if (off !== null) {
          p.x += Math.sign(off) * Math.min(Math.abs(off), W.speed * dt);
          break;
        }
      }
    p.vx = want.vx;
    p.vy = want.vy;
    p.onGround = true;
    p.invuln -= dt;
    this.handleShoot(input, pressed, dt);
    if (this.touchesSpike(p.x, p.y, p.w)) this.hurt(T.player.spikeDamage, -p.facing as 1 | -1);
    this.def.checkpoints.forEach(([cx, cy], i) => {
      if (i > this.checkpointIndex && Math.hypot(p.x - cx, p.y - cy) < 1.6) {
        this.checkpointIndex = i;
        this.checkpoint = [cx, cy];
        this.fx.push({ kind: "checkpoint", x: cx, y: cy, at: this.time });
        this.onEvent?.("checkpoint");
      }
    });
    const [ax, bx] = this.def.bossArena;
    if (!this.bossActive && p.x > ax + 1 && p.x < bx) {
      this.bossActive = true;
      const boss = this.enemies.find((e) => e.kind === "boss");
      if (boss) {
        boss.awake = true;
        boss.timer = 1.5;
        boss.atkAt = this.time + 3.5;
      }
    }
  }

  /** Địch khi nhìn từ trên: zombie đuổi, lính và drone bắn nhắm, trùm đuổi + loạt đạn quạt + vòng đạn toả */
  private updateEnemiesTop(frameDt: number) {
    const p = this.player;
    const E = T.enemy;
    const W = T.topdown;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      // Trúng lưỡi băng: mọi cử động chậm lại
      const dt = e.slowUntil > this.time ? frameDt * T.gear.frostSlow : frameDt;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind !== "boss") e.awake = d < E.wakeRange;
      if (!e.awake) continue;
      if (this.time < e.staggerUntil) {
        e.vx *= 0.88;
        e.vy *= 0.88;
        this.move(e, dt);
        continue;
      }
      e.timer -= dt;
      e.facing = dx > 0 ? 1 : -1;
      if (e.trait !== "basic" && e.kind !== "boss" && this.updateTraitTop(e, dt, dx, dy, d)) {
        if (overlap(p, e) && e.tele < 0) this.hurt(E.contactDamage, p.x < e.x ? -1 : 1);
        continue;
      }
      const shoot = (speed: number, dmg: number, spread = 0, r = 0.2, level: 0 | 1 | 2 = 0) => {
        const a = Math.atan2(dy, dx) + spread;
        this.shots.push({ x: e.x, y: e.y + e.h / 2, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, pierce: false, life: 3, enemy: true, level });
      };
      if (e.kind === "zombie") {
        if (d < E.skill.lungeRange && this.time - e.skillAt > E.skill.lungeEvery) e.skillAt = this.time;
        const sp = d < E.zombie.sight ? E.zombie.chase * (this.time - e.skillAt < E.skill.lungeTime ? 2.6 : 1) : 0;
        e.vx = (dx / d) * sp;
        e.vy = (dy / d) * sp;
        this.move(e, dt);
      } else if (e.kind === "trooper") {
        // Giữ khoảng cách vừa tầm bắn, đi vòng quanh người chơi
        const want = d > W.trooperRange ? 1 : d < W.trooperRange - 2 ? -1 : 0;
        e.vx = (dx / d) * want * E.trooper.walk + (-dy / d) * 0.6;
        e.vy = (dy / d) * want * E.trooper.walk + (dx / d) * 0.6;
        this.move(e, dt);
        if (e.timer <= 0 && d < E.trooper.sight) {
          e.timer = E.trooper.fireEvery;
          e.firedAt = this.time;
          shoot(E.trooper.shotSpeed, E.trooper.shotDamage);
        }
      } else if (e.kind === "drone") {
        const t = this.time + e.id;
        e.x = e.homeX + Math.sin(t * 0.8) * E.drone.sway;
        e.y = e.homeY + Math.cos(t * 1.1) * E.drone.sway * 0.6;
        if (e.timer <= 0 && d < E.drone.sight) {
          e.timer = E.drone.fireEvery;
          e.firedAt = this.time;
          shoot(E.drone.shotSpeed, E.drone.shotDamage);
        }
      } else if (e.kind === "boss" && this.def.bossStyle && this.def.bossStyle !== "brute") {
        this.bossTop(e, dt, dx, dy, d, shoot);
        if (e.alive) this.bossSpecials(e);
      } else if (e.kind === "boss") {
        const B = E.boss;
        const rage = e.hp < e.maxHp / 2 ? B.rageSpeedup : 1;
        e.vx = (dx / d) * B.walk * 0.7 * rage;
        e.vy = (dy / d) * B.walk * 0.7 * rage;
        this.move(e, dt);
        if (e.timer <= 0) {
          e.firedAt = this.time;
          // Xen kẽ: loạt 3 viên hình quạt, rồi vòng 10 viên toả đều
          if (Math.floor(this.time / 3) % 2 === 0) for (const sp of [-0.25, 0, 0.25]) shoot(B.shotSpeed, B.shotDamage, sp, 0.3, 1);
          else for (let k = 0; k < 10; k++) shoot(B.waveSpeed * 0.8, B.waveDamage, (k / 10) * Math.PI * 2, 0.3, 2);
          e.timer = 1.6 / rage;
        }
      }
      if (overlap(p, e)) this.hurt(e.kind === "boss" ? E.boss.contactDamage : E.contactDamage, p.x < e.x ? -1 : 1);
    }
  }

  private touchesSpike(x: number, y: number, w: number) {
    for (let c = Math.floor(x - w / 2 + 0.1); c <= Math.floor(x + w / 2 - 0.1); c++) {
      if (this.tile(c, Math.floor(y + 0.05)) === "^") return true;
    }
    return false;
  }

  /**
   * Nút bắn theo vũ khí: súng tay / shotgun / súng ngắm / kiếm: nhấn là bắn-chém, giữ để nạp, thả ra bắn đòn nạp.
   * Súng trường: giữ là xả liên thanh. Cung: giữ để kéo dây, thả ra mới bắn.
   */
  private handleShoot(input: Input, pressed: (k: keyof Input) => boolean, dt: number) {
    const p = this.player;
    const W = WEAPONS[this.gunWeapon];
    p.shootTimer -= dt;
    p.cooldown -= dt;
    p.meleeCd -= dt;
    // L: rút kiếm sau lưng ra / cất kiếm cầm súng lại
    if (pressed("melee")) {
      p.weaponMode = p.weaponMode === "gun" ? "sword" : "gun";
      p.swapAt = this.time;
      p.charge = 0;
      this.fx.push({ kind: "swap", x: p.x, y: p.y + 1, at: this.time, n: p.weaponMode === "sword" ? 1 : 0 });
    }
    if (p.weaponMode === "sword") {
      // Kiếm: bấm J chém combo 3 nhát; giữ J tụ lực, thả ra phóng sóng kiếm.
      // Kiếm trang bị (katana, lưỡi hái, băng kiếm…) chém theo kiểu riêng của nó
      const B = this.bladeGear;
      if (B) {
        if (pressed("shoot") && p.cooldown <= 0) this.fireWeapon(0, 0);
      } else if (pressed("shoot") && p.meleeCd <= 0) this.meleeStrike();
      if (input.shoot) {
        p.charge += dt * (1 + this.stats.charge);
        if (p.charge > T.shot.chargeMid && p.charge - dt <= T.shot.chargeMid) this.fx.push({ kind: "charge", x: p.x, y: p.y, at: this.time });
      } else if (this.prev.shoot) {
        const lv = p.charge >= T.shot.chargeFull ? 2 : 1;
        if (p.charge >= T.shot.chargeMid) B ? this.fireWeapon(lv, 1) : this.swordWave(lv);
        p.charge = 0;
      }
      return;
    }
    if (W.style === "auto") {
      p.charge = 0;
      if (input.shoot && p.cooldown <= 0) this.fireWeapon(0, 0);
      return;
    }
    if (pressed("shoot") && W.style !== "bow" && p.cooldown <= 0) this.fireWeapon(0, 0);
    if (input.shoot) {
      p.charge += dt * (1 + this.stats.charge);
      if (p.charge > T.shot.chargeMid && p.charge - dt <= T.shot.chargeMid) this.fx.push({ kind: "charge", x: p.x, y: p.y, at: this.time });
    } else if (this.prev.shoot) {
      const level = p.charge >= T.shot.chargeFull ? 2 : p.charge >= T.shot.chargeMid ? 1 : 0;
      if (W.style === "bow") this.fireWeapon(level, Math.min(1, p.charge / T.shot.chargeFull));
      else if (level > 0) this.fireWeapon(level, 1);
      p.charge = 0;
    }
  }

  /**
   * Cận chiến (nút riêng, dùng được với mọi vũ khí): chuỗi 3 nhát, bấm tiếp trong nhịp combo thì ra nhát sau.
   * Nhát 3 là đòn kết liễu: vùng chém to, đánh bật địch ra xa, rung màn hình. Chém gần mạnh hơn bắn,
   * chặt rơi đạn địch, cầm kiếm thì chém đau hơn nữa.
   */
  private meleeStrike() {
    const p = this.player;
    const M = T.melee;
    const step = (this.time - p.meleeAt < M.window ? (p.meleeStep + 1) % 3 : 0) as 0 | 1 | 2;
    p.meleeStep = step;
    p.meleeAt = this.time;
    p.meleeCd = M.cd[step];
    const m = this.muzzle();
    const top = this.mode === "topdown";
    const blade = !!this.bladeGear;
    const finisher = step === 2;
    // Lao nhẹ tới trước khi chém (đòn kết liễu lao xa hơn)
    if (!top && this.mode !== "shmup" && p.knock <= 0) p.vx = m.dx * M.lunge[step];
    const reach = finisher ? M.reach * 1.3 : M.reach;
    this.shots.push({
      x: p.x + m.dx * reach,
      y: (top ? p.y + p.h / 2 : p.y + 1) + m.dy * reach,
      vx: top ? p.vx : p.vx * 0.5,
      vy: top ? p.vy : 0,
      r: finisher ? M.finR : M.r,
      dmg: M.dmg[step] * (blade ? M.bladeMul : 1),
      pierce: true,
      life: M.life,
      enemy: false,
      level: finisher ? 2 : 0,
      kind: "slash",
      dx: m.dx,
      dy: m.dy,
      hitIds: [],
      maxLife: M.life,
      melee: step,
      knock: M.knock[step],
      freeze: this.bladeGear?.freeze,
    });
    this.fx.push({ kind: "swing", x: p.x + m.dx * reach, y: top ? p.y + p.h / 2 : p.y + 1, at: this.time, n: step });
  }

  /** Sóng kiếm khi thả tụ lực ở chế độ kiếm: kiếm trang bị dùng sóng của nó, kiếm mặc định có sóng nhẹ hơn */
  private swordWave(level: 1 | 2) {
    const p = this.player;
    const m = this.muzzle();
    const B = this.bladeGear;
    const wave = B?.wave ?? T.melee.wave;
    const k = level === 2 ? 1 : 0.6;
    this.shots.push({ x: m.x, y: m.y, vx: m.dx * wave.speed, vy: m.dy * wave.speed, r: wave.r * (level === 2 ? 1.25 : 1), dmg: wave.dmg * k, pierce: true, life: T.gear.blade.waveLife, enemy: false, level, kind: "wave", freeze: B?.freeze, dx: m.dx, dy: m.dy, hitIds: [], maxLife: T.gear.blade.waveLife });
    p.meleeAt = p.waveAt = this.time;
    p.meleeStep = 2;
    this.fx.push({ kind: "swing", x: m.x, y: m.y, at: this.time, n: 2 });
  }

  /** Điểm ra đạn và hướng bắn: đi ngang bắn theo hướng mặt (bám tường thì bắn ra ngoài), đi 8 hướng bắn theo hướng nhìn */
  private muzzle() {
    const p = this.player;
    if (this.mode === "topdown") return { x: p.x + p.aimX * 0.6, y: p.y + p.h / 2 + p.aimY * 0.6, dx: p.aimX, dy: p.aimY };
    const dir = p.wall !== 0 ? (-p.wall as 1 | -1) : p.facing;
    // Giữ W / ↑: bắn chéo lên (đang chạy) hoặc thẳng lên (đứng yên) — hạ quái bay trên cao
    if (this.mode !== "shmup" && p.aimUp === 2) return { x: p.x + dir * 0.15, y: p.y + 1.95, dx: 0, dy: 1 };
    if (this.mode !== "shmup" && p.aimUp === 1) return { x: p.x + dir * 0.6, y: p.y + 1.6, dx: dir * Math.SQRT1_2, dy: Math.SQRT1_2 };
    return { x: p.x + dir * 0.7, y: p.y + 1.15, dx: dir as number, dy: 0 };
  }

  /** Bắn theo vũ khí đang trang bị. `power` (0–1) là độ kéo dây cung */
  private fireWeapon(level: 0 | 1 | 2, power: number) {
    const p = this.player;
    const W = WEAPONS[p.weaponMode === "sword" && this.bladeGear ? this.weapon : this.gunWeapon];
    if (W.style === "buster") return this.fire(level);
    const m = this.muzzle();
    const S = T.gear;
    const push = (o: Omit<Shot, "x" | "y" | "enemy" | "dx" | "dy" | "hitIds" | "maxLife"> & { x?: number; y?: number; dx?: number; dy?: number }) =>
      this.shots.push({ x: m.x, y: m.y, dx: m.dx, dy: m.dy, enemy: false, hitIds: [], maxLife: o.life, ...o });
    const at = (dx: number, dy: number, speed: number) => ({ vx: dx * speed, vy: dy * speed });
    const rot = (a: number) => ({ dx: m.dx * Math.cos(a) - m.dy * Math.sin(a), dy: m.dx * Math.sin(a) + m.dy * Math.cos(a) });
    if (W.style === "auto") {
      // Rung nòng nhẹ cho loạt đạn trông tự nhiên
      const d = rot(((this.time * 37) % 1 - 0.5) * 0.06);
      push({ ...at(d.dx, d.dy, S.auto.speed), r: S.auto.r, dmg: W.dmg, pierce: false, life: S.auto.life, level: 0, kind: "bullet", ...d });
    } else if (W.style === "spread") {
      const n = level === 2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const d = rot((i / (n - 1) - 0.5) * S.spread.arc);
        push({ ...at(d.dx, d.dy, S.spread.speed), r: S.spread.r, dmg: W.dmg * (level === 2 ? 1.6 : 1), pierce: level === 2, life: S.spread.life, level, kind: "pellet", ...d });
      }
    } else if (W.style === "rail") {
      const mul = level === 2 ? 3 : level === 1 ? 1.6 : 1;
      push({ ...at(m.dx, m.dy, S.rail.speed), r: S.rail.r, dmg: W.dmg * mul, pierce: true, life: S.rail.life, level, kind: "rail" });
    } else if (W.style === "bow") {
      const k = Math.max(S.bow.minPower, power);
      push({ ...at(m.dx, m.dy, S.bow.speed[0] + (S.bow.speed[1] - S.bow.speed[0]) * k), r: 0.2, dmg: W.dmg + S.bow.bonus * k, pierce: k >= 1, life: 1.4, level: k >= 1 ? 2 : k > 0.4 ? 1 : 0, kind: "arrow" });
    } else if (W.style === "blade") {
      // Hoạt ảnh: nhát thường xoay vòng phải → trái → kết liễu, nhát nạp là động tác chém nạp
      p.meleeStep = level === 0 ? (this.time - p.meleeAt < T.melee.window ? (p.meleeStep + 1) % 3 : 0) as 0 | 1 | 2 : 2;
      p.meleeAt = this.time;
      if (level > 0) p.waveAt = this.time;
      if (level === 0) {
        // Nhát chém vòng cung trước mặt (lưỡi hái: cả sau lưng), đi theo người chơi trong chốc lát
        const r = W.sweep ? S.blade.sweepR : S.blade.r;
        for (const side of W.sweep ? [1, -1] : [1])
          push({
            x: p.x + m.dx * side * S.blade.reach,
            y: (this.mode === "topdown" ? p.y + p.h / 2 : p.y + 1) + m.dy * side * S.blade.reach,
            vx: p.vx,
            vy: this.mode === "topdown" ? p.vy : 0,
            r,
            dmg: W.dmg,
            pierce: true,
            life: S.blade.life,
            level: 0,
            kind: "slash",
            freeze: W.freeze,
            dx: m.dx * side,
            dy: m.dy * side,
          });
        // Cưỡi xe bay: mỗi nhát chém kèm một tia kiếm nhỏ bay thẳng, để kiếm vẫn với tới mục tiêu xa
        if (this.mode === "shmup" && W.wave)
          push({ ...at(m.dx, m.dy, W.wave.speed), r: W.wave.r * 0.6, dmg: W.wave.dmg * S.blade.beamMul, pierce: false, life: S.blade.beamLife, level: 0, kind: "wave", freeze: W.freeze });
      } else if (W.wave) {
        // Nạp: phóng sóng kiếm; nạp đầy thì sóng to và đi xuyên tường
        push({ ...at(m.dx, m.dy, W.wave.speed), r: W.wave.r * (level === 2 ? 1.25 : 1), dmg: W.wave.dmg * (level === 2 ? 1 : 0.6), pierce: true, life: S.blade.waveLife, level, kind: "wave", freeze: W.freeze });
      }
    }
    p.cooldown = W.cooldown;
    p.shootTimer = 0.3;
    this.fx.push({ kind: "shot", x: m.x, y: m.y, at: this.time });
  }

  private fire(level: 0 | 1 | 2) {
    const p = this.player;
    const S = T.shot;
    if (level === 0 && this.shots.filter((s) => !s.enemy && s.level === 0).length >= S.maxSmall) return;
    const spec = level === 0 ? S.small : level === 1 ? S.mid : S.full;
    if (this.mode === "topdown") {
      // Đi 8 hướng: bắn theo hướng đang nhìn, xuất phát từ tâm thân
      const ox = p.x + p.aimX * 0.6;
      const oy = p.y + p.h / 2 + p.aimY * 0.6;
      const C = T.shot.chuong;
      const ch = level === 2;
      this.shots.push({ x: ox, y: oy, vx: p.aimX * (ch ? C.speed : spec.speed), vy: p.aimY * (ch ? C.speed : spec.speed), r: ch ? C.r : spec.r, dmg: spec.dmg, pierce: ch, life: ch ? C.life : S.life, enemy: false, level, hitIds: [], kind: ch ? "chuong" : undefined, home: ch ? C.home : undefined });
      p.shootTimer = 0.3;
      this.fx.push({ kind: "shot", x: ox, y: oy, at: this.time });
      return;
    }
    // Bám tường thì bắn ra phía ngược tường; giữ W thì bắn chéo / thẳng lên
    const m = this.muzzle();
    const chuong = level === 2;
    const C = T.shot.chuong;
    this.shots.push({
      x: m.x,
      y: m.y,
      vx: m.dx * (chuong ? C.speed : spec.speed),
      vy: m.dy * (chuong ? C.speed : spec.speed),
      r: chuong ? C.r : spec.r,
      dmg: spec.dmg,
      pierce: level === 2,
      life: chuong ? C.life : S.life,
      enemy: false,
      level,
      // Đạn xuyên chỉ trúng mỗi địch một lần (không cộng dồn mỗi khung hình khi đi qua thân)
      hitIds: [],
      // Tụ đầy: chưởng năng lượng tự đuổi quái gần nhất (kể cả quái bay trên cao)
      kind: chuong ? "chuong" : undefined,
      home: chuong ? C.home : undefined,
      dx: m.dx,
      dy: m.dy,
    });
    p.shootTimer = 0.3;
    this.fx.push({ kind: "shot", x: m.x, y: m.y, at: this.time });
  }

  /** Đẩy người chơi ra khỏi thân trùm đang choáng, về phía còn chỗ trống (kẹt sát tường thì sang phía bên kia) */
  private slipOut(e: Enemy) {
    const p = this.player;
    const free = (x: number) => {
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + p.h - 0.01); y++)
        if (this.solid(Math.floor(x - p.w / 2), y) || this.solid(Math.floor(x + p.w / 2), y)) return false;
      return true;
    };
    const first = p.x < e.x ? -1 : 1;
    for (const side of [first, -first]) {
      const x = e.x + side * (e.w / 2 + p.w / 2 + 0.05);
      if (free(x)) {
        p.x += (x - p.x) * 0.35;
        return;
      }
    }
  }

  hurt(amount: number, from: 1 | -1) {
    const p = this.player;
    if (p.invuln > 0 || this.status !== "playing") return;
    // Giáp giảm sát thương theo tỉ lệ, mỗi đòn vẫn mất ít nhất 1 máu
    amount = Math.max(1, Math.round(amount * T.difficulty[this.difficulty].dmg));
    const reduce = Math.max(-0.3, Math.min(0.6, ARMORS[this.armor].reduce + this.stats.def));
    if (reduce !== 0) amount = Math.max(1, Math.round(amount * (1 - reduce)));
    p.hp = Math.max(0, p.hp - amount);
    p.invuln = T.player.invuln;
    p.knock = T.player.knockTime;
    p.vx = from * T.player.knockSpeed;
    // Đi ngang: bị hất lên một chút; đi 8 hướng (y là chiều sâu mặt đất) thì chỉ lùi theo hướng ngang
    if (this.mode === "topdown") p.vy = 0;
    else p.vy = Math.max(p.vy, 4);
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

  private updateEnemies(frameDt: number) {
    const p = this.player;
    const E = T.enemy;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dt = e.slowUntil > this.time ? frameDt * T.gear.frostSlow : frameDt;
      if (e.kind !== "boss") e.awake = Math.abs(e.x - p.x) < E.wakeRange;
      if (!e.awake) continue;
      if (this.time < e.staggerUntil) {
        // Bị chém khựng: trôi theo lực đánh bật, không ra đòn, không gây sát thương chạm
        e.vx *= 0.9;
        if (e.kind === "drone" || this.mode === "shmup") {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.vy *= 0.9;
        } else this.fall(e, dt);
        continue;
      }
      e.timer -= dt;
      const dx = p.x - e.x;
      if (e.trait !== "basic" && e.kind !== "boss" && this.updateTrait(e, dt)) {
        if (overlap(p, e) && e.tele < 0) this.hurt(E.contactDamage, p.x < e.x ? -1 : 1);
        continue;
      }
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
        // Né: thấy đạn người chơi bay tới gần thì nhảy lên tránh
        if (e.onGround && this.time - e.skillAt > E.skill.dodgeEvery && this.shots.some((s) => !s.enemy && Math.abs(s.y - (e.y + 1)) < 1.2 && Math.sign(e.x - s.x) === Math.sign(s.vx) && Math.abs(e.x - s.x) < E.skill.dodgeRange)) {
          e.skillAt = this.time;
          e.vy = E.skill.dodgeVy;
        }
        this.fall(e, dt);
      } else if (e.kind === "zombie") {
        // Lừ đừ tiến về phía người chơi
        const near = Math.abs(dx) < E.zombie.sight;
        const lunging = this.time - e.skillAt < E.skill.lungeTime;
        e.facing = near && !lunging ? (dx > 0 ? 1 : -1) : e.facing;
        // Vồ: tới gần thì bật nhảy chồm về phía người chơi
        if (near && !lunging && e.onGround && Math.abs(dx) < E.skill.lungeRange && Math.abs(p.y - e.y) < 1.5 && this.time - e.skillAt > E.skill.lungeEvery) {
          e.skillAt = this.time;
          e.vy = E.skill.lungeVy;
        }
        e.vx = this.time - e.skillAt < E.skill.lungeTime ? e.facing * E.skill.lungeSpeed : near ? e.facing * E.zombie.chase : e.facing * E.zombie.walk;
        const ahead = Math.floor(e.x + e.facing * 0.6);
        if (!this.solid(ahead, Math.floor(e.y) - 1) || this.solid(ahead, Math.floor(e.y))) {
          e.facing = (-e.facing) as 1 | -1;
          e.vx = 0;
        }
        this.fall(e, dt);
      } else if (e.kind === "drone") {
        // Bay lượn sóng quanh điểm gốc, thỉnh thoảng bắn chéo về phía người chơi
        const t = this.time + e.id;
        // Bổ nhào: lao về phía người chơi rồi bay về chỗ cũ
        const since = this.time - e.skillAt;
        if (since > E.skill.diveEvery && Math.abs(dx) < E.skill.diveRange) {
          e.skillAt = this.time;
          e.homeX = e.x;
        }
        if (since < E.skill.diveTime) {
          const k = Math.sin((since / E.skill.diveTime) * Math.PI);
          e.x = e.homeX + (p.x - e.homeX) * k * 0.8;
          e.y = e.homeY + (p.y + 1 - e.homeY) * k * 0.8;
        } else {
          e.x = e.homeX + Math.sin(t * 0.8) * E.drone.sway;
          e.y = e.homeY + Math.sin(t * 2.1) * 0.6;
        }
        e.facing = dx > 0 ? 1 : -1;
        if (e.timer <= 0 && Math.abs(dx) < E.drone.sight) {
          e.timer = E.drone.fireEvery;
          e.firedAt = this.time;
          const ty = p.y + 1 - (e.y + 0.4);
          const len = Math.hypot(dx, ty) || 1;
          this.shots.push({ x: e.x, y: e.y + 0.4, vx: (dx / len) * E.drone.shotSpeed, vy: (ty / len) * E.drone.shotSpeed, r: 0.2, dmg: E.drone.shotDamage, pierce: false, life: 4, enemy: true, level: 0 });
        }
      } else if (e.kind === "boss") {
        this.bossByStyle(e, dt);
        if (e.alive) this.bossSpecials(e);
      }
      // Chạm thân địch. Trùm đang choáng thì vô hại: nó đổ sập lên chỗ mình đứng (vd. lao vào tường) thì đẩy mình ra
      if (overlap(p, e)) {
        if (e.kind === "boss" && this.time < e.stunUntil) this.slipOut(e);
        else this.hurt(e.kind === "boss" ? E.boss.contactDamage : E.contactDamage, p.x < e.x ? -1 : 1);
      }
    }
  }

  /** Ném vòng cung (lựu đạn, axit) từ (x, y) rơi trúng (tx, ty) sau `t` giây với trọng lực `g`; nhìn từ trên thì bay thẳng */
  private lob(e: Enemy, x: number, y: number, tx: number, ty: number, t: number, g: number, kind: "grenade" | "acid", dmg: number) {
    const top = this.mode === "topdown";
    this.shots.push({
      x,
      y,
      vx: (tx - x) / t,
      vy: top ? (ty - y) / t : (ty - y + 0.5 * g * t * t) / t,
      r: 0.22,
      dmg,
      pierce: false,
      life: top ? t : 5,
      maxLife: top ? t : 5,
      enemy: true,
      level: 1,
      kind,
      grav: top ? 0 : g,
      lands: kind,
    });
    e.firedAt = this.time;
  }

  /** Biến thể quái khi đi ngang / bay. Trả về true nếu đã xử lý xong con quái này trong khung hình */
  private updateTrait(e: Enemy, dt: number): boolean {
    const p = this.player;
    const R = T.traits;
    const dx = p.x - e.x;
    const adx = Math.abs(dx);
    const level = this.mode === "shmup" || Math.abs(p.y - e.y) < 3;
    const face = () => (e.facing = dx > 0 ? 1 : -1);
    const walk = (speed: number, dir: 1 | -1) => {
      e.facing = dir;
      e.vx = dir * speed;
      // Không bước ra khỏi mép, không đâm đầu vào tường
      const ahead = Math.floor(e.x + dir * 0.7);
      if ((!this.solid(ahead, Math.floor(e.y) - 1) && this.tile(ahead, Math.floor(e.y) - 1) !== "=") || this.solid(ahead, Math.floor(e.y))) e.vx = 0;
    };
    switch (e.trait) {
      case "blink": {
        // Hồn ma Hollow Hotel: đánh dấu chỗ người chơi đứng (vòng tím), biến mất rồi hiện ra đúng chỗ đó chém xuống
        const S = R.blink;
        if (e.tele > 0) {
          e.vx = 0;
          if (this.time - e.tele >= S.warn) {
            e.x = e.aimX;
            e.y = this.groundBelow(e.aimX, e.aimY + 0.5);
            e.vy = 0;
            e.tele = -9;
            e.skillAt = this.time;
            this.fx.push({ kind: "dash", x: e.x, y: e.y + 1, at: this.time });
          }
        } else if (adx < S.range && Math.abs(p.y - e.y) < 5 && p.onGround && this.time - e.skillAt > S.every) {
          e.tele = this.time;
          e.aimX = p.x;
          e.aimY = p.y;
          this.fx.push({ kind: "dash", x: e.x, y: e.y + 1, at: this.time });
          this.warnCircle("void", p.x, p.y + 0.9, S.r, S.warn, 0.2, S.dmg);
        } else if (level && adx < 12) walk(T.enemy.trooper.walk, dx > 0 ? 1 : -1);
        else e.vx = 0;
        this.fall(e, dt);
        return true;
      }
      case "pulse": {
        // Xác sống Hollow Hotel: áp sát rồi gồng, phát sóng xung quanh thân (vòng đỏ quanh nó)
        const S = R.pulse;
        if (e.tele > 0) {
          e.vx = 0;
          if (this.time - e.tele > S.warn + 0.3) (e.tele = -9), (e.skillAt = this.time);
        } else if (adx < S.r - 0.4 && level && this.time - e.skillAt > S.every) {
          e.tele = this.time;
          face();
          this.warnCircle("pulse", e.x, e.y + 0.9, S.r, S.warn, 0.2, S.dmg);
        } else if (level && adx < 10) walk(T.enemy.zombie.chase, dx > 0 ? 1 : -1);
        else e.vx = 0;
        this.fall(e, dt);
        return true;
      }
      case "mortar": {
        // Tàu pháo Warzone: bắn loạt 3 quả pháo rơi xuống quanh chỗ người chơi (vòng cam lần lượt bùng)
        const S = R.mortar;
        const t = this.time + e.id;
        e.y = e.homeY + Math.sin(t * 1.3) * 1.2;
        face();
        if (adx < S.range && this.time - e.skillAt > S.every) {
          e.skillAt = this.time;
          e.firedAt = this.time;
          for (let i = 0; i < S.n; i++) {
            const ox = (i - (S.n - 1) / 2) * S.spread + p.vx * 0.4;
            const oy = Math.sin(i * 2.4 + t) * S.spread * 0.6;
            this.warnCircle("blast", p.x + ox, p.y + p.h / 2 + oy, S.r, S.warn + i * S.stagger, 0.25, S.dmg);
          }
        }
        return true;
      }
      case "shield": {
        if (e.shieldHp <= 0) return false;
        const S = R.shield;
        if (e.tele > 0) {
          e.vx = 0;
          if (this.time - e.tele > S.bashTele + 0.2) {
            e.tele = -9;
            e.skillAt = this.time;
          }
        } else if (adx < S.bashRange && level && this.time - e.skillAt > 1.3) {
          face();
          e.tele = this.time;
          e.vx = 0;
          // Gồng khiên rồi đập: vùng trước mặt báo đỏ
          this.warnRect("shock", e.x + e.facing * 0.3, e.y, e.x + e.facing * (0.3 + S.bashRange + 0.4), e.y + 1.9, S.bashTele, 0.15, S.bashDmg);
        } else {
          if (level && adx < 14) walk(S.walk, dx > 0 ? 1 : -1);
          else e.vx = 0;
          if (level && adx < 11 && e.timer <= 0) {
            e.timer = S.fireEvery;
            e.firedAt = this.time;
            this.shots.push({ x: e.x + e.facing * 0.7, y: e.y + 1.2, ...this.aim(e.x, e.y + 1.2, e.facing, T.enemy.trooper.shotSpeed), r: 0.18, dmg: T.enemy.trooper.shotDamage, pierce: false, life: 3, enemy: true, level: 0 });
          }
        }
        this.fall(e, dt);
        return true;
      }
      case "sniper": {
        const S = R.sniper;
        e.vx = 0;
        const sees = adx < S.sight && (this.mode === "shmup" || Math.abs(p.y - e.y) < 6);
        if (e.tele > 0) {
          const k = this.time - e.tele;
          if (k < S.lock) {
            face();
            e.aimX = p.x;
            e.aimY = p.y + 1.1;
          }
          if (k >= S.aim) {
            const ox = e.x + e.facing * 0.8;
            const oy = e.y + 1.35;
            const l = Math.hypot(e.aimX - ox, e.aimY - oy) || 1;
            this.shots.push({ x: ox, y: oy, vx: ((e.aimX - ox) / l) * S.speed, vy: ((e.aimY - oy) / l) * S.speed, r: 0.16, dmg: S.dmg, pierce: false, life: 1.2, enemy: true, level: 2, kind: "snipe" });
            e.firedAt = this.time;
            e.tele = -9;
            e.skillAt = this.time;
            this.fx.push({ kind: "shot", x: ox, y: oy, at: this.time });
          }
        } else if (sees && this.time - e.skillAt > S.rest) {
          face();
          e.tele = this.time;
          e.aimX = p.x;
          e.aimY = p.y + 1.1;
        }
        if (this.mode !== "shmup") this.fall(e, dt);
        return true;
      }
      case "grenadier": {
        const S = R.grenadier;
        if (level && adx < S.range) {
          face();
          e.vx = 0;
          if (this.time - e.skillAt > S.every) {
            e.skillAt = this.time;
            const tx = p.x + p.vx * 0.35;
            this.lob(e, e.x + e.facing * 0.5, e.y + 1.6, tx, this.groundBelow(tx, p.y + 0.5) + 0.2, S.flight, S.grav, "grenade", 3);
          }
        } else {
          if (Math.abs(e.x - e.homeX) > T.enemy.trooper.patrol) e.facing = e.x > e.homeX ? -1 : 1;
          walk(T.enemy.trooper.walk, e.facing);
        }
        this.fall(e, dt);
        return true;
      }
      case "exploder": {
        const S = R.exploder;
        if (e.tele > 0) {
          e.vx = 0;
          if (this.time - e.tele >= S.fuse) {
            // Tự nổ: vùng nổ đã báo trước lúc bắt đầu nháy
            e.alive = false;
            e.deadAt = this.time;
            this.fx.push({ kind: "boom", x: e.x, y: e.y + 0.9, at: this.time, n: 2 });
          }
        } else if (adx < S.trigger && Math.abs(p.y - e.y) < 2) {
          e.tele = this.time;
          this.warnCircle("blast", e.x, e.y + 0.9, S.r, S.fuse, 0.25, S.dmg, true);
        } else if (adx < T.enemy.zombie.sight + 3 && level) walk(S.run, dx > 0 ? 1 : -1);
        else walk(T.enemy.zombie.walk, e.facing);
        this.fall(e, dt);
        return true;
      }
      case "spitter": {
        const S = R.spitter;
        if (e.tele > 0) {
          e.vx = 0;
          if (this.time - e.tele >= S.tele) {
            e.tele = -9;
            e.skillAt = this.time;
            const tx = p.x + p.vx * 0.3;
            this.lob(e, e.x + e.facing * 0.5, e.y + 1.5, tx, this.groundBelow(tx, p.y + 0.5) + 0.1, S.flight, S.grav, "acid", 2);
          }
        } else if (level && adx < 13) {
          if (adx < S.keep - 1) walk(T.enemy.zombie.chase, dx > 0 ? -1 : 1);
          else if (adx > S.keep + 2) walk(T.enemy.zombie.chase, dx > 0 ? 1 : -1);
          else e.vx = 0;
          if (this.time - e.skillAt > S.every) {
            face();
            e.tele = this.time;
          }
        } else walk(T.enemy.zombie.walk, e.facing);
        this.fall(e, dt);
        return true;
      }
      case "bomber": {
        const S = R.bomber;
        const t = this.time + e.id;
        const tx = p.x + Math.sin(t * 0.9) * 1.5;
        const ty = Math.min(this.height - 2, p.y + S.above);
        if (adx < 16) {
          e.x += THREE_clamp(tx - e.x, -S.follow * dt, S.follow * dt);
          e.y += THREE_clamp(ty - e.y, -S.follow * dt, S.follow * dt);
          // Không bay xuyên tường
          if (this.solid(Math.floor(e.x), Math.floor(e.y))) e.y += S.follow * dt * 2;
        }
        face();
        if (adx < 3.5 && this.time - e.skillAt > S.every) {
          e.skillAt = this.time;
          e.firedAt = this.time;
          const gy = this.groundBelow(e.x, e.y);
          const fallT = Math.sqrt((2 * Math.max(0.5, e.y - gy)) / S.grav);
          this.shots.push({ x: e.x, y: e.y - 0.3, vx: 0, vy: 0, r: 0.25, dmg: 0, pierce: false, life: fallT, enemy: true, level: 1, kind: "bomb", grav: S.grav });
          this.warnCircle("blast", e.x, gy + 0.6, S.r, fallT, 0.25, S.dmg, true);
        }
        return true;
      }
      case "laser": {
        const S = R.laser;
        if (e.tele > 0) {
          if (this.time - e.tele > S.tele + S.dur) {
            e.tele = -9;
            e.skillAt = this.time;
          }
          return true;
        }
        if (this.mode !== "shmup" && adx < 18) {
          // Bay ngang tầm ngực người chơi, giữ khoảng cách ở phía đang đứng
          const side = e.x > p.x ? 1 : -1;
          e.x += THREE_clamp(p.x + side * S.keep - e.x, -3 * dt, 3 * dt);
          e.y += THREE_clamp(p.y + 0.8 - e.y, -3 * dt, 3 * dt);
        } else if (this.mode === "shmup") {
          const t = this.time + e.id;
          e.x = e.homeX + Math.sin(t * 0.8) * T.enemy.drone.sway;
          e.y = e.homeY + Math.sin(t * 2.1) * 0.6;
        }
        face();
        if (adx < S.keep + 5 && this.time - e.skillAt > S.rest) {
          e.tele = this.time;
          const y = e.y + 0.4;
          e.aimX = e.x + e.facing * S.length;
          e.aimY = y;
          this.warnLine("laser", e.x + e.facing * 0.6, y, e.aimX, y, S.width, S.tele, S.dur, S.dmg);
        }
        return true;
      }
    }
    return false;
  }

  /** Biến thể quái khi nhìn từ trên */
  private updateTraitTop(e: Enemy, dt: number, dx: number, dy: number, d: number): boolean {
    const p = this.player;
    const R = T.traits;
    const ux = dx / d;
    const uy = dy / d;
    const px = p.x;
    const py = p.y + p.h / 2;
    const ex = e.x;
    const ey = e.y + e.h / 2;
    const go = (speed: number, sx = ux, sy = uy) => {
      e.vx = sx * speed;
      e.vy = sy * speed;
      this.move(e, dt);
    };
    switch (e.trait) {
      case "charger": {
        // Lính xung kích Khu Săn: khoá hướng (vệt đỏ dài), khựng một nhịp rồi lao thẳng húc người
        const S = R.charger;
        if (e.tele > 0) {
          const k = this.time - e.tele;
          if (k >= S.warn && k < S.warn + S.dash) go(S.length / S.dash, e.aimX, e.aimY);
          else if (k >= S.warn + S.dash + 0.4) (e.tele = -9), (e.skillAt = this.time);
          return true;
        }
        if (d < S.length + 1 && this.time - e.skillAt > S.every) {
          e.tele = this.time;
          e.aimX = ux;
          e.aimY = uy;
          this.warnLine("shock", ex, ey, ex + ux * (S.length + 0.8), ey + uy * (S.length + 0.8), S.width, S.warn, S.dash, S.dmg);
        } else if (d < 12) go(T.enemy.trooper.walk);
        return true;
      }
      case "summoner": {
        // Ổ bọ Khu Săn: giữ khoảng cách, cứ vài giây đẻ thêm bọ con quanh mình
        const S = R.summoner;
        if (d < 4) go(T.enemy.zombie.walk * 1.4, -ux, -uy);
        else if (d > 9) go(T.enemy.zombie.walk);
        if (d < 13 && this.time - e.skillAt > S.every) {
          e.skillAt = this.time;
          e.firedAt = this.time;
          this.summon(e, S.n);
          this.fx.push({ kind: "warn", x: ex, y: ey, at: this.time });
        }
        return true;
      }
      case "chain": {
        // Thầy tế Giáo Xứ: gọi sét (vệt xanh) nối từ nó tới người chơi rồi lan tiếp sang một hướng
        const S = R.chain;
        if (e.tele > 0) {
          if (this.time - e.tele > S.warn + 0.4) (e.tele = -9), (e.skillAt = this.time);
          return true;
        }
        if (d < S.range && this.time - e.skillAt > S.every) {
          e.tele = this.time;
          e.firedAt = this.time;
          const a = Math.atan2(uy, ux) + (e.id % 2 ? 1 : -1) * 0.9;
          this.warnLine("elec", ex, ey, px, py, S.width, S.warn, 0.25, S.dmg);
          this.warnLine("elec", px, py, px + Math.cos(a) * S.jump, py + Math.sin(a) * S.jump, S.width, S.warn + 0.15, 0.25, S.dmg);
        } else if (d > S.range - 2) go(T.enemy.zombie.walk);
        else if (d < 4) go(T.enemy.zombie.walk, -ux, -uy);
        return true;
      }
      case "curse": {
        // Hồn ma Giáo Xứ: lượn quanh, thả vũng nguyền tím dưới chân người chơi (dẫm vào bị chậm)
        const S = R.curse;
        const t = this.time + e.id;
        go(2.2, ux * 0.6 - uy * 0.8 * Math.sign(Math.sin(t * 0.5)), uy * 0.6 + ux * 0.8 * Math.sign(Math.sin(t * 0.5)));
        if (d < S.range && this.time - e.skillAt > S.every) {
          e.skillAt = this.time;
          e.firedAt = this.time;
          this.warnCircle("curse", px + p.vx * 0.3, py + p.vy * 0.3, S.r, S.warn, S.dur, S.dmg);
        }
        return true;
      }
      case "shield": {
        if (e.shieldHp <= 0) return false;
        const S = R.shield;
        e.aimX = ux;
        e.aimY = uy;
        if (e.tele > 0) {
          if (this.time - e.tele > S.bashTele + 0.2) (e.tele = -9), (e.skillAt = this.time);
        } else if (d < S.bashRange + 0.6 && this.time - e.skillAt > 1.3) {
          e.tele = this.time;
          this.warnCircle("shock", ex + ux * 1.3, ey + uy * 1.3, 1.2, S.bashTele, 0.15, S.bashDmg);
        } else if (d < 12) go(S.walk);
        return true;
      }
      case "sniper": {
        const S = R.sniper;
        if (e.tele > 0) {
          const k = this.time - e.tele;
          if (k < S.lock) {
            e.aimX = px;
            e.aimY = py;
          }
          if (k >= S.aim) {
            const l = Math.hypot(e.aimX - ex, e.aimY - ey) || 1;
            this.shots.push({ x: ex, y: ey, vx: ((e.aimX - ex) / l) * S.speed, vy: ((e.aimY - ey) / l) * S.speed, r: 0.16, dmg: S.dmg, pierce: false, life: 1.2, enemy: true, level: 2, kind: "snipe" });
            e.firedAt = this.time;
            e.tele = -9;
            e.skillAt = this.time;
          }
        } else if (d < S.sight && this.time - e.skillAt > S.rest) {
          e.tele = this.time;
          e.aimX = px;
          e.aimY = py;
        } else if (d < 6) go(T.enemy.trooper.walk, -ux, -uy);
        return true;
      }
      case "grenadier": {
        const S = R.grenadier;
        if (d < S.range && this.time - e.skillAt > S.every) {
          e.skillAt = this.time;
          this.lob(e, ex, ey, px + p.vx * 0.35, py + p.vy * 0.35, S.flight, 0, "grenade", 3);
        } else if (d > S.range - 3) go(T.enemy.trooper.walk);
        else if (d < 5) go(T.enemy.trooper.walk, -ux, -uy);
        return true;
      }
      case "exploder": {
        const S = R.exploder;
        if (e.tele > 0) {
          if (this.time - e.tele >= S.fuse) {
            e.alive = false;
            e.deadAt = this.time;
            this.fx.push({ kind: "boom", x: e.x, y: ey, at: this.time, n: 2 });
          }
        } else if (d < S.trigger) {
          e.tele = this.time;
          this.warnCircle("blast", ex, ey, S.r, S.fuse, 0.25, S.dmg, true);
        } else if (d < T.enemy.zombie.sight + 3) go(S.run * 0.85);
        return true;
      }
      case "spitter": {
        const S = R.spitter;
        if (e.tele > 0) {
          if (this.time - e.tele >= S.tele) {
            e.tele = -9;
            e.skillAt = this.time;
            this.lob(e, ex, ey, px + p.vx * 0.3, py + p.vy * 0.3, S.flight, 0, "acid", 2);
          }
        } else if (d < 12) {
          if (d < S.keep - 1) go(T.enemy.zombie.chase, -ux, -uy);
          else if (d > S.keep + 2) go(T.enemy.zombie.chase);
          if (this.time - e.skillAt > S.every) e.tele = this.time;
        }
        return true;
      }
      case "bomber": {
        const S = R.bomber;
        if (d < 16) go(S.follow * 0.9);
        if (d < 2.5 && this.time - e.skillAt > S.every) {
          e.skillAt = this.time;
          e.firedAt = this.time;
          this.shots.push({ x: ex, y: ey, vx: 0, vy: 0, r: 0.25, dmg: 0, pierce: false, life: 0.9, enemy: true, level: 1, kind: "bomb" });
          this.warnCircle("blast", ex, ey, S.r, 0.9, 0.25, S.dmg, true);
        }
        return true;
      }
      case "laser": {
        const S = R.laser;
        if (e.tele > 0) {
          if (this.time - e.tele > S.tele + S.dur) (e.tele = -9), (e.skillAt = this.time);
          return true;
        }
        if (d > S.keep + 1) go(2.2);
        else if (d < S.keep - 1.5) go(2.2, -ux, -uy);
        if (d < S.keep + 5 && this.time - e.skillAt > S.rest) {
          e.tele = this.time;
          e.aimX = ex + ux * S.length;
          e.aimY = ey + uy * S.length;
          this.warnLine("laser", ex + ux * 0.6, ey + uy * 0.6, e.aimX, e.aimY, S.width, S.tele, S.dur, S.dmg);
        }
        return true;
      }
    }
    return false;
  }

  /** Hướng đạn địch: chế độ bay thì nhắm vào người chơi (người chơi bay trên cao), còn lại bắn ngang */
  private aim(x: number, y: number, facing: 1 | -1, speed: number) {
    if (this.mode !== "shmup" && this.mode !== "topdown") return { vx: facing * speed, vy: 0 };
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

  private updateBoss(e: Enemy, dt: number, noVolley = false) {
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
    if (e.move === "volley" && !noVolley) {
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

  // ---------------------------------------------------------------------------
  // Vùng nguy hiểm báo trước (vòng / cột / tia đỏ hiện lên rồi mới gây sát thương)

  private addHazard(h: Omit<Hazard, "id" | "hit" | "warnAt">) {
    const hz: Hazard = { ...h, id: this.hazardId++, hit: false, warnAt: this.time };
    this.hazards.push(hz);
    return hz;
  }

  /** Vùng chữ nhật (cột tên lửa, tia laser sát sàn, sàn điện) */
  warnRect(kind: HazardKind, x0: number, y0: number, x1: number, y1: number, warn: number, dur: number, dmg: number, hurtsEnemies = false) {
    return this.addHazard({ kind, shape: "rect", x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), r: 0, liveAt: this.time + warn, endAt: this.time + warn + dur, dmg, hurtsEnemies });
  }

  /** Vùng tròn (vụ nổ, đá rơi, xúc tu) */
  warnCircle(kind: HazardKind, x: number, y: number, r: number, warn: number, dur: number, dmg: number, hurtsEnemies = false) {
    return this.addHazard({ kind, shape: "circle", x0: x, y0: y, x1: x, y1: y, r, liveAt: this.time + warn, endAt: this.time + warn + dur, dmg, hurtsEnemies });
  }

  /** Tia thẳng (laser, tia mắt) dày `w` */
  warnLine(kind: HazardKind, x0: number, y0: number, x1: number, y1: number, w: number, warn: number, dur: number, dmg: number) {
    return this.addHazard({ kind, shape: "line", x0, y0, x1, y1, r: w / 2, liveAt: this.time + warn, endAt: this.time + warn + dur, dmg });
  }

  /** Mặt đất ngay dưới (x, y): hàng trên cùng của ô đặc gần nhất bên dưới */
  groundBelow(x: number, y: number) {
    for (let r = Math.floor(y); r >= 0; r--) if (this.solid(Math.floor(x), r - 1) || this.tile(Math.floor(x), r - 1) === "=") return r;
    return 0;
  }

  private hazardTouches(h: Hazard, b: { x: number; y: number; w: number; h: number }) {
    // Người chơi / địch: hộp chân tại (x, y); nhìn từ trên thì lấy tâm thân
    const cx = b.x;
    const cy = this.mode === "topdown" ? b.y + b.h / 2 : b.y + b.h / 2;
    const hw = b.w / 2;
    const hh = this.mode === "topdown" ? b.w / 2 : b.h / 2;
    if (h.shape === "rect") return cx + hw > h.x0 && cx - hw < h.x1 && cy + hh > h.y0 && cy - hh < h.y1;
    if (h.shape === "circle") {
      const nx = Math.max(cx - hw, Math.min(h.x0, cx + hw));
      const ny = Math.max(cy - hh, Math.min(h.y0, cy + hh));
      return Math.hypot(nx - h.x0, ny - h.y0) < h.r;
    }
    return segDist(cx, cy, h.x0, h.y0, h.x1, h.y1) < h.r + Math.min(hw, hh);
  }

  private updateHazards() {
    const p = this.player;
    for (const h of this.hazards) {
      if (this.time < h.liveAt || this.time > h.endAt) continue;
      if (h.kind === "curse" && this.hazardTouches(h, p)) p.slowUntil = this.time + T.traits.curse.slowTime;
      if (!h.hit && this.hazardTouches(h, p)) {
        h.hit = true;
        this.hurt(h.dmg, p.x < (h.x0 + h.x1) / 2 ? -1 : 1);
      }
      if (h.hurtsEnemies)
        for (const e of this.enemies)
          if (e.alive && e.awake && e.kind !== "boss" && this.hazardTouches(h, e) && this.time - e.hurtAt > 0.4) this.damageEnemy(e, h.dmg, e.x, e.y + e.h / 2);
    }
    this.hazards = this.hazards.filter((h) => this.time < h.endAt + 0.4);
  }

  /** Lựu đạn / axit / bom chạm đất */
  private landShot(s: Shot) {
    const R = T.traits;
    const gy = this.mode === "topdown" ? s.y : Math.floor(s.y) + 1;
    if (s.lands === "grenade") {
      s.vx = 0;
      s.vy = 0;
      s.grav = 0;
      s.lands = undefined;
      s.y = this.mode === "topdown" ? s.y : gy + 0.2;
      s.life = R.grenadier.fuse;
      s.dmg = 0;
      this.warnCircle("blast", s.x, this.mode === "topdown" ? s.y : gy + 0.4, R.grenadier.r, R.grenadier.fuse, 0.25, R.grenadier.dmg, true);
      return;
    }
    s.life = 0;
    if (s.lands === "acid") {
      const w = R.spitter.puddle / 2;
      if (this.mode === "topdown") this.warnCircle("acid", s.x, s.y, w, 0.15, R.spitter.puddleTime, R.spitter.dmg);
      else this.warnRect("acid", s.x - w, gy, s.x + w, gy + 0.45, 0.15, R.spitter.puddleTime, R.spitter.dmg);
    } else if (s.lands === "bomb") {
      this.warnCircle("blast", s.x, this.mode === "topdown" ? s.y : gy + 0.5, R.bomber.r, 0, 0.25, R.bomber.dmg, true);
      this.fx.push({ kind: "boom", x: s.x, y: gy + 0.5, at: this.time, n: 0.8 });
    }
  }

  /** Tên lửa trùm bị bắn/chém nổ: đủ số lần thì khiên vỡ, trùm choáng */
  private popMissile(m: Shot) {
    m.life = 0;
    this.fx.push({ kind: "boom", x: m.x, y: m.y, at: this.time });
    const boss = this.boss;
    if (!boss || !boss.alive) return;
    boss.broken++;
    if (boss.broken >= T.boss.overlordBreak) {
      boss.broken = 0;
      boss.stunUntil = this.time + T.boss.stunTime + 1;
    }
  }

  private updateShots(dt: number) {
    const p = this.player;
    // Tên lửa trùm: đuổi theo người chơi; đạn người chơi bắn trúng là nổ (đếm để vỡ khiên)
    for (const m of this.shots) {
      if (!m.missile || m.life <= 0) continue;
      // Hạ dần xuống ngang tầm nòng súng của người chơi rồi bay ngang tới: đứng yên bắn là hạ được (không cần ngắm chéo)
      const dir = p.x < m.x ? -1 : 1;
      const ty = this.mode === "platform" || this.mode === "climb" ? p.y + 1.15 : p.y + 1;
      m.vx += (dir * T.boss.missileSpeed - m.vx) * Math.min(1, dt * 1.6);
      m.vy = Math.max(-4, Math.min(4, (ty - m.y) * 2.4));
      // Đo theo cả đoạn đạn sắp bay trong khung này, để đạn nhanh (súng ngắm, tên) không bay lọt qua tên lửa
      for (const b of this.shots)
        if (!b.enemy && b.life > 0 && segDist(m.x, m.y, b.x, b.y, b.x + b.vx * dt, b.y + b.vy * dt) < m.r + b.r + T.boss.missileSlack) {
          if (!b.pierce && b.kind !== "slash") b.life = 0;
          this.popMissile(m);
          break;
        }
    }
    // Nhát chém chặt rơi đạn địch bay vào nó (chém rơi tên lửa cũng tính để vỡ khiên)
    for (const s of this.shots) {
      if (s.kind !== "slash" || s.life <= 0) continue;
      for (const b of this.shots)
        if (b.enemy && b.life > 0 && Math.hypot(b.x - s.x, b.y - s.y) < s.r + b.r) {
          if (b.missile) this.popMissile(b);
          else b.life = 0;
        }
    }
    for (const s of this.shots) {
      if (s.home && s.life > 0) {
        // Đạn đuổi: của địch (cầu lệ) bẻ lái về người chơi; chưởng của người chơi đuổi quái gần nhất
        const sp = Math.hypot(s.vx, s.vy) || 1;
        let tx = p.x - s.x;
        let ty = p.y + (this.mode === "topdown" ? p.h / 2 : 1) - s.y;
        if (!s.enemy) {
          let best = T.shot.chuong.seek;
          tx = s.vx;
          ty = s.vy;
          for (const e of this.enemies) {
            if (!e.alive || !e.awake || s.hitIds?.includes(e.id)) continue;
            const ex = e.x - s.x;
            const ey = e.y + e.h / 2 - s.y;
            const d = Math.hypot(ex, ey);
            if (d < best) (best = d), (tx = ex), (ty = ey);
          }
        }
        const l = Math.hypot(tx, ty) || 1;
        s.vx += ((tx / l) * sp - s.vx) * Math.min(1, dt * s.home);
        s.vy += ((ty / l) * sp - s.vy) * Math.min(1, dt * s.home);
      }
      if (s.grav) s.vy -= s.grav * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.lands) {
        // Rơi chạm đất (nhìn từ trên: hết thời gian bay là chạm đất)
        const down = this.mode === "topdown" ? s.life <= 0.02 : s.vy < 0 && (this.solid(Math.floor(s.x), Math.floor(s.y)) || this.tile(Math.floor(s.x), Math.floor(s.y)) === "=");
        if (down || (this.mode !== "topdown" && s.y < 0)) {
          if (this.mode !== "topdown") s.y = Math.max(0, s.y);
          this.landShot(s);
          continue;
        }
      }
      // Đạn thường vỡ khi chạm tường; sóng chấn động đi sát đất
      if (this.solid(Math.floor(s.x), Math.floor(s.y)) && s.level !== 2 && s.kind !== "slash") s.life = 0;
      if (s.life <= 0) continue;
      if (s.enemy) {
        // Lựu đạn nằm chờ nổ (dmg 0) không tính va chạm, vụ nổ là vùng nguy hiểm riêng
        if (s.dmg <= 0) continue;
        const hitP = this.mode === "topdown" ? Math.hypot(s.x - p.x, s.y - (p.y + p.h / 2)) < p.w / 2 + s.r : Math.abs(s.x - p.x) < p.w / 2 + s.r && s.y > p.y - s.r && s.y < p.y + p.h + s.r;
        if (hitP) {
          this.hurt(s.dmg, s.vx > 0 ? 1 : -1);
          s.life = 0;
        }
        continue;
      }
      for (const e of this.enemies) {
        if (!e.alive || !e.awake) continue;
        if (s.hitIds?.includes(e.id)) continue;
        if (Math.abs(s.x - e.x) < e.w / 2 + s.r && s.y > e.y - s.r && s.y < e.y + e.h + s.r) {
          s.hitIds?.push(e.id);
          // Lính khiên: đạn bay vào mặt khiên bật ra; nhát chém (hoặc đạn nạp đầy) làm nứt rồi vỡ khiên
          if (e.trait === "shield" && e.shieldHp > 0) {
            const front = this.mode === "topdown" ? (s.x - e.x) * e.aimX + (s.y - (e.y + e.h / 2)) * e.aimY > 0 : Math.sign(s.x - e.x) === e.facing || Math.abs(s.x - e.x) < 0.2;
            if (front) {
              if (s.melee !== undefined || s.level === 2) {
                e.shieldHp--;
                e.hurtAt = this.time;
                this.fx.push({ kind: e.shieldHp <= 0 ? "crit" : "block", x: s.x, y: s.y, at: this.time, text: e.shieldHp <= 0 ? "VỠ KHIÊN!" : undefined, color: "#7ff3ff" });
                if (s.melee !== undefined) this.meleeImpact(e, s);
              } else this.fx.push({ kind: "block", x: s.x, y: s.y, at: this.time });
              if (!s.pierce || s.kind !== "slash") s.life = 0;
              if (s.life <= 0) break;
              continue;
            }
          }
          // Trùm đang có khiên / vảy / mắt nhắm: đạn bật ra
          if (e.guard) {
            this.fx.push({ kind: "block", x: s.x, y: s.y, at: this.time });
            s.life = 0;
            break;
          }
          if (s.freeze) e.slowUntil = this.time + T.gear.frostTime;
          this.damageEnemy(e, s.dmg, s.x, s.y);
          if (s.melee !== undefined) this.meleeImpact(e, s);
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
  private spawnDrops(x: number, y: number, drops: LootDrop[], burst = 1) {
    const L = T.loot;
    const r = this.fxRng;
    // CRED vỡ thành nhiều đồng xu văng tung toé (trùm: cả trận mưa xu)
    const out: LootDrop[] = [];
    for (const d of drops) {
      if (d.kind !== "cred") {
        out.push(d);
        continue;
      }
      const n = Math.max(1, Math.min(burst > 1 ? L.bossCoins : L.coins[1], Math.max(L.coins[0], Math.ceil(d.amount / 2))));
      let left = d.amount;
      for (let i = 0; i < n; i++) {
        const v = i === n - 1 ? left : Math.max(1, Math.floor(d.amount / n));
        left -= v;
        if (v > 0) out.push({ kind: "cred", amount: v });
      }
    }
    const top = this.mode === "topdown";
    out.forEach((drop) => {
      const a = r() * Math.PI * 2;
      const sp = (2 + r() * 3.5) * burst;
      this.pickups.push(
        top || this.mode === "shmup"
          ? { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drop, taken: false, bornAt: this.time }
          : { x, y, vx: (r() - 0.5) * 7 * burst, vy: (5.5 + r() * 5) * Math.sqrt(burst), drop, taken: false, bornAt: this.time },
      );
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
      const flying = this.mode === "shmup" || this.mode === "topdown";
      // Nằm lâu không nhặt (hoặc đang mưa đồ cuối trận) thì tự bay về người chơi; viên máu thì để dành
      const homing = k.drop.kind !== "health" && (age > L.autoCollect || (this.clearAt > 0 && age > L.pickupDelay));
      const range = (k.drop.kind === "cred" ? L.coinMagnet : L.magnetRange) * (flying ? 2 : 1);
      // Đồng xu nảy tung toé một nhịp cho đã mắt rồi mới bị hút về
      const delay = k.drop.kind === "cred" ? L.coinDelay : L.pickupDelay;
      if (age > delay && (homing || (d < range && (k.drop.kind !== "health" || flying)))) {
        const sp = L.magnetSpeed * (homing ? 2.2 : 1) * (1 + Math.max(0, 2 - d) * 0.5);
        k.x += (dx / d) * Math.min(d, sp * dt);
        k.y += (dy / d) * Math.min(d, sp * dt);
        k.vx = 0;
        k.vy = 0;
      } else if (flying) {
        // Bay: đồ lơ lửng tại chỗ, chỉ tản ra một chút rồi dừng
        k.x += k.vx * dt;
        k.y += k.vy * dt * 0.3;
        k.vx *= 0.9;
        k.vy *= 0.9;
      } else if (k.vx !== 0 || k.vy !== 0 || !this.hits(k.x, k.y - 0.05, 0.3, 0.05)) {
        k.vy = Math.max(-T.player.maxFall, k.vy - T.player.gravity * dt);
        const box = { x: k.x, y: k.y, vx: k.vx, vy: k.vy, w: 0.3, h: 0.3 };
        const fallV = k.vy;
        const m = this.move(box, dt);
        k.x = box.x;
        k.y = box.y;
        // Chạm đất thì nảy lên vài lần (đồng xu leng keng) rồi nằm yên
        if (m.ground && fallV < -L.bounceMin) {
          k.vy = -fallV * L.bounce;
          k.vx = box.vx * 0.6;
        } else {
          k.vx = m.ground ? 0 : box.vx * 0.99;
          k.vy = box.vy;
        }
        if (m.wall !== 0) k.vx = -k.vx * 0.4;
        if (k.y < -3) k.taken = true;
      }
      const reach = flying ? Math.hypot(k.x - p.x, k.y - (p.y + p.h / 2)) < 0.8 : Math.abs(k.x - p.x) < 0.8 && k.y > p.y - 0.5 && k.y < p.y + p.h;
      if (age > delay && reach) this.take(k);
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
    const d = k.drop;
    const [text, color] = dropLabel(d);
    this.fx.push({ kind: d.kind === "cred" ? "coin" : "pickup", x: k.x, y: k.y, at: this.time, text, color });
    if (d.kind === "health") {
      p.hp = Math.min(this.maxHp, p.hp + T.player.healthPickup);
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

  /** Gây sát thương cho một địch (đạn, nhát chém, đập đất); hạ thì rơi đồ, trùm thì qua màn */
  private damageEnemy(e: Enemy, dmg: number, x: number, y: number) {
    if (e.guard) {
      this.fx.push({ kind: "block", x, y, at: this.time });
      return;
    }
    e.hp -= dmg * e.weakMul * (1 + this.stats.atk);
    e.hurtAt = this.time;
    this.fx.push({ kind: "hit", x, y, at: this.time });
    if (e.hp > 0) return;
    e.alive = false;
    e.deadAt = this.time;
    this.kills++;
    this.combo = this.time - this.comboAt < T.score.comboWindow ? this.combo + 1 : 1;
    this.comboAt = this.time;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.score += Math.round((e.kind === "boss" ? T.score.boss : T.score.kill) * Math.min(this.combo, T.score.comboCap) * T.difficulty[this.difficulty].reward);
    this.onEvent?.("kill", { enemy: e });
    const boss = e.kind === "boss";
    if (!e.minion) this.spawnDrops(e.x, e.y + e.h * 0.5, rollEnemyDrops(e.kind, this.loot), boss ? 1.8 : 1);
    this.fx.push({ kind: boss ? "bigboom" : "boom", x: e.x, y: e.y + e.h / 2, at: this.time, n: e.kind === "drone" ? 0.7 : boss ? 3 : 1 });
    if (boss) {
      // Trùm gục: lính tan biến, mưa đồ rơi vài giây (tự bay về người chơi) rồi mới qua màn
      for (const m of this.enemies) if (m.alive && m.minion) (m.alive = false, (m.deadAt = this.time));
      this.shots = this.shots.filter((x) => !x.enemy);
      this.player.invuln = 99;
      this.clearAt = this.time + T.loot.bossOutro;
      return;
    }
    // Viên máu: thỉnh thoảng rơi, máu càng thấp càng hay rơi
    const low = this.player.hp < this.maxHp * 0.4;
    if (this.fxRng() < T.loot.healthChance + (low ? T.loot.healthLowBonus : 0)) this.spawnDrops(e.x, e.y + 0.6, [{ kind: "health" }]);
  }

  /** Nhát chém trúng: địch thường khựng lại và bị đánh bật (nhát kết liễu bật xa), đòn kết liễu rung màn hình */
  private meleeImpact(e: Enemy, s: Shot) {
    const M = T.melee;
    const k = s.knock ?? 0;
    if (s.melee === 2) this.fx.push({ kind: "crit", x: e.x, y: e.y + e.h / 2, at: this.time });
    if (!e.alive || e.kind === "boss") return;
    e.staggerUntil = this.time + (s.melee === 2 ? M.stagger * 2 : M.stagger);
    const dx = s.dx ?? Math.sign(e.x - this.player.x);
    const dy = s.dy ?? 0;
    e.vx = dx * k;
    if (this.mode === "topdown") e.vy = dy * k;
    else if (s.melee === 2 && e.kind !== "drone") e.vy = Math.max(e.vy, 6);
  }

  /** Trùm gọi lính (zombie / hồn ma) ra quanh mình */
  private summon(e: Enemy, n: number, kind: "zombie" | "drone" = "zombie") {
    const alive = this.enemies.filter((x) => x.minion && x.alive).length;
    for (let i = 0; i < Math.min(n, T.boss.maxMinions - alive); i++) {
      const air = kind === "drone" && this.mode !== "topdown";
      const m = makeEnemy(this.nextId++, kind, e.x + (i % 2 ? 2.5 : -2.5), e.y + (this.mode === "topdown" ? (i % 2 ? 1.5 : -1.5) : air ? 3 + i : 0.5));
      if (this.mode === "topdown") m.h = m.w;
      if (air) m.trait = this.mode === "shmup" ? "basic" : "laser";
      m.minion = true;
      m.awake = true;
      m.hp = m.maxHp = 3;
      this.enemies.push(m);
    }
  }

  /** Trùm nhìn ngang / bay: chọn hành vi theo kiểu trùm */
  private bossByStyle(e: Enemy, dt: number) {
    const style = this.def.bossStyle ?? "brute";
    const B = T.boss;
    const p = this.player;
    const stunned = this.time < e.stunUntil;
    const rage = e.hp < e.maxHp / 2 ? T.enemy.boss.rageSpeedup : 1;
    e.weakMul = stunned ? B.stunMul : 1;
    if (style === "brute") {
      e.guard = false;
      e.cue = "";
      return this.updateBoss(e, dt);
    }
    const dx = p.x - e.x;
    if (style === "charger") {
      e.guard = !stunned;
      if (stunned) {
        e.cue = "CHOÁNG! ĐÁNH NGAY";
        e.vx = 0;
        e.move = "idle";
        this.fall(e, dt);
        return;
      }
      if (e.timer <= 0) {
        if (e.move === "windup") {
          e.move = "charge";
          e.timer = 3;
          e.vx = e.facing * B.chargeSpeed * rage;
        } else if (e.move === "charge") {
          // Nổi điên: lao tiếp một lần nữa ngay sau cú lao hụt
          if (e.phase === 2 && e.broken === 0) {
            e.broken = 1;
            e.move = "windup";
            e.timer = (B.windup * 0.6) / rage;
            e.facing = dx > 0 ? 1 : -1;
          } else {
            e.broken = 0;
            e.move = "walk";
            e.timer = 2;
          }
        } else {
          e.move = "windup";
          e.timer = B.windup / rage;
          e.facing = dx > 0 ? 1 : -1;
        }
      }
      e.cue = e.move === "windup" ? "SẮP LAO TỚI · NHẢY NÉ!" : "KHIÊN · dụ nó lao vào tường";
      if (e.move === "walk") {
        e.facing = dx > 0 ? 1 : -1;
        e.vx = e.facing * T.enemy.boss.walk * 0.6;
        if (this.time - e.firedAt > 1.4) {
          e.firedAt = this.time;
          this.shots.push({ x: e.x + e.facing * 1.4, y: e.y + 1.6, ...this.aim(e.x, e.y + 1.6, e.facing, T.enemy.boss.shotSpeed), r: 0.3, dmg: T.enemy.boss.shotDamage, pierce: false, life: 3, enemy: true, level: 1 });
        }
      } else if (e.move === "windup") e.vx = 0;
      const want = e.vx;
      this.fall(e, dt);
      if (e.move === "charge") {
        e.facing = want > 0 ? 1 : -1;
        e.vx = want;
        if (Math.abs(e.vx) > 1 && this.hits(e.x + Math.sign(want) * 0.15, e.y + 0.2, e.w, e.h - 0.4)) {
          // Đâm sầm vào tường: choáng, rơi khiên
          e.stunUntil = this.time + B.stunTime;
          e.vx = 0;
          e.move = "walk";
          e.timer = B.stunTime + 1.2;
          this.fx.push({ kind: "slam", x: e.x + e.facing * 1.2, y: e.y + 1, at: this.time });
          e.broken = 0;
          // Nổi điên: đâm tường bắn văng mảnh vỡ thành vòng cung
          if (e.phase === 2)
            for (let k = 0; k < 6; k++)
              this.shots.push({ x: e.x, y: e.y + 2.6, vx: -e.facing * (1.5 + k * 1.1), vy: 9 + (k % 2) * 2, r: 0.26, dmg: 2, pierce: false, life: 3, enemy: true, level: 1, kind: "shard", grav: 22 });
        }
      }
      this.keepInArena(e);
      return;
    }
    if (style === "phantom") {
      // Ẩn hình → hiện ra (lộ điểm yếu, gào gọi hồn ma) → ẩn hình …
      if (e.timer <= 0) {
        if (e.move === "vanish") {
          const [ax, bx] = this.def.bossArena;
          // Hiện ra gần người chơi nhưng không chồng lên
          const side = p.x - ax > bx - p.x ? -1 : 1;
          e.x = Math.max(ax + 2, Math.min(bx - 1, p.x + side * (3 + ((this.time * 7) % 3))));
          e.move = "appear";
          e.timer = B.appearTime;
          e.firedAt = this.time;
          if (Math.floor(this.time) % 2 === 0) this.summon(e, 2);
          const H = T.bossKit.hands;
          for (let k = 0; k < 5; k++) {
            const a = (k / 4 - 0.5) * 1.2 + (dx > 0 ? 0 : Math.PI);
            // Nổi điên: cầu lệ chậm mà đuổi theo người chơi
            const orb = e.phase === 2 && k % 2 === 0;
            const sp = orb ? H.orbSpeed : 8;
            this.shots.push({ x: e.x, y: e.y + 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: orb ? 0.38 : 0.3, dmg: T.enemy.boss.shotDamage, pierce: false, life: orb ? 4.5 : 2.5, enemy: true, level: 2, kind: "orb", home: orb ? H.orbHome : undefined });
          }
        } else {
          e.move = "vanish";
          e.timer = B.vanishTime / rage;
        }
      }
      e.guard = e.move === "vanish";
      e.weakMul = e.move === "appear" ? B.stunMul : 1;
      e.fade = THREE_clamp(e.fade + (e.move === "vanish" ? -dt * 3 : dt * 4), 0.08, 1);
      e.cue = e.move === "vanish" ? "Bà ẩn hình · chờ bà hiện ra" : "BÀ HIỆN HÌNH · ĐÁNH NGAY!";
      e.facing = dx > 0 ? 1 : -1;
      e.vx = 0;
      this.fall(e, dt);
      return;
    }
    if (style === "dragon") {
      // Bay lơ lửng ở cuối hẻm, nhấp nhô theo người chơi
      const ty = THREE_clamp(p.y, 3, this.height - 4) + Math.sin(this.time * 1.3) * 2;
      e.y += (ty - e.y) * Math.min(1, dt * 1.2);
      e.facing = dx > 0 ? 1 : -1;
      if (e.timer <= 0) {
        e.move = e.move === "rest" ? "windup" : e.move === "windup" ? "breath" : "rest";
        e.timer = e.move === "rest" ? B.dragonRest / rage : e.move === "windup" ? B.windup : B.breathTime;
      }
      e.guard = e.move === "rest";
      e.weakMul = e.move === "breath" ? B.stunMul : 1;
      e.cue = e.move === "rest" ? "Vảy rồng cứng · chờ rồng há miệng" : e.move === "windup" ? "RỒNG HÁ MIỆNG!" : "PHUN LỬA · BẮN VÀO MIỆNG!";
      if (e.move === "rest" && this.time - e.firedAt > 1) {
        e.firedAt = this.time;
        this.shots.push({ x: e.x - 1.5, y: e.y + 1, ...this.aim(e.x - 1.5, e.y + 1, -1, 9), r: 0.35, dmg: T.enemy.boss.shotDamage, pierce: false, life: 3, enemy: true, level: 1 });
      }
      if (e.move === "breath" && this.time - e.firedAt > 0.09) {
        e.firedAt = this.time;
        const a = Math.atan2(p.y + 1 - (e.y + 1), p.x - e.x) + Math.sin(this.time * (e.phase === 2 ? 5 : 9)) * (e.phase === 2 ? 0.5 : 0.25);
        this.shots.push({ x: e.x - 1.5, y: e.y + 1, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, r: 0.32, dmg: 2, pierce: false, life: 1.6, enemy: true, level: 2 });
      }
      return;
    }
    if (style === "overlord") {
      e.guard = !stunned;
      e.cue = stunned ? "KHIÊN QUÁ TẢI · ĐÁNH NGAY!" : `Khiên năng lượng · bắn hạ tên lửa (${e.broken}/${B.overlordBreak})`;
      if (!stunned && e.timer <= 0 && e.move !== "jump") {
        e.timer = B.missileEvery / rage;
        e.firedAt = this.time;
        for (const vy of [5, 2])
          this.shots.push({ x: e.x + e.facing * 1.2, y: e.y + 2.6, vx: e.facing * 4, vy, r: 0.35, dmg: 3, pierce: false, life: 6, enemy: true, level: 1, missile: true });
        return this.updateBoss(e, dt, true);
      }
      return this.updateBoss(e, dt, true);
    }
    // armored / watcher dùng chung khuôn trùm thường khi nhìn ngang
    e.guard = false;
    e.cue = "";
    this.updateBoss(e, dt);
  }

  /** Trùm khi nhìn từ trên (Khu Săn, Giáo Xứ) */
  private bossTop(e: Enemy, dt: number, dx: number, dy: number, d: number, shoot: (speed: number, dmg: number, spread?: number, r?: number, level?: 0 | 1 | 2) => void) {
    const style = this.def.bossStyle;
    const B = T.boss;
    const rage = e.hp < e.maxHp / 2 ? T.enemy.boss.rageSpeedup : 1;
    const stunned = this.time < e.stunUntil;
    if (style === "armored") {
      // Giáp trước mặt; tới gần thì giơ chuỳ (gồng) rồi đập đất: sóng đạn toả vòng, chuỳ kẹt dưới đất → lộ điểm yếu
      e.guard = !stunned;
      e.weakMul = stunned ? B.stunMul : 1;
      if (stunned) {
        e.cue = e.move === "idle" ? "ĐÂM TƯỜNG CHOÁNG · ĐÁNH NGAY!" : "CHUỲ KẸT DƯỚI ĐẤT · ĐÁNH NGAY!";
        return;
      }
      if (e.move === "charge") {
        // Lốc xoáy: gồng rồi lao theo đường đã báo; đâm vào tường thì choáng (dụ nó lao vào tường)
        const S = T.bossKit.spin;
        const k = this.time - e.tele;
        e.cue = "LỐC XOÁY · LƯỚT SANG BÊN!";
        if (k > S.tele && k < S.tele + S.time) {
          e.vx = e.aimX * S.speed;
          e.vy = e.aimY * S.speed;
          this.move(e, dt);
          if (e.vx === 0 && e.vy === 0) {
            e.move = "idle";
            e.tele = -9;
            e.stunUntil = this.time + B.stunTime;
            e.timer = B.stunTime + 1;
            this.fx.push({ kind: "slam", x: e.x, y: e.y, at: this.time });
          }
        } else if (k >= S.tele + S.time) {
          e.move = "walk";
          e.tele = -9;
          e.timer = 1.2;
        }
        return;
      }
      if (e.move === "windup") {
        e.cue = "GIƠ CHUỲ · LƯỚT RA XA!";
        if (e.timer <= 0) {
          e.move = "walk";
          e.timer = 2.5;
          e.stunUntil = this.time + B.stunTime + 0.8;
          this.fx.push({ kind: "slam", x: e.x, y: e.y, at: this.time });
          for (let k = 0; k < 14; k++) shoot(T.enemy.boss.waveSpeed, T.enemy.boss.waveDamage, (k / 14) * Math.PI * 2, 0.35, 2);
          // Nổi điên: cú đập để lại vòng lửa quanh mình
          if (e.phase === 2) {
            const F = T.bossKit.fire;
            for (let k = 0; k < F.n; k++) {
              const a = (k / F.n) * Math.PI * 2 + this.time;
              this.warnCircle("fire", e.x + Math.cos(a) * 3, e.y + e.h / 2 + Math.sin(a) * 3, F.r, 0.5, F.dur, F.dmg);
            }
          }
        }
        return;
      }
      e.cue = "Giáp dày · dụ nó đập chuỳ";
      e.vx = (dx / d) * T.enemy.boss.walk * 0.8 * rage;
      e.vy = (dy / d) * T.enemy.boss.walk * 0.8 * rage;
      this.move(e, dt);
      if (e.timer <= 0 && d < T.boss.slamRange) {
        e.move = "windup";
        e.timer = B.windup;
      } else if (e.timer <= 0) {
        e.timer = 1.2;
        e.firedAt = this.time;
        for (const sp of [-0.2, 0, 0.2]) shoot(T.enemy.boss.shotSpeed, T.enemy.boss.shotDamage, sp, 0.3, 1);
      }
      return;
    }
    // watcher: trôi chậm, nhắm mắt (miễn sát thương, gọi lính, vòng đạn) ↔ mở mắt (trúng ×2)
    e.vx = (dx / d) * 0.8;
    e.vy = (dy / d) * 0.8;
    this.move(e, dt);
    const K = T.bossKit;
    const cx = e.x;
    const cy = e.y + e.h / 2;
    if (e.timer <= 0) {
      if (e.move === "appear") {
        e.move = "rest";
        e.timer = B.eyeClosed / rage;
        this.summon(e, 2);
      } else {
        // Mở mắt: tia mắt khoá về phía người chơi, báo trước bằng vạch đỏ
        e.move = "appear";
        e.timer = B.eyeOpen;
        const E = K.eyeBeam;
        e.aimX = dx / d;
        e.aimY = dy / d;
        e.tele = this.time;
        this.warnLine("laser", cx + e.aimX, cy + e.aimY, cx + e.aimX * E.length, cy + e.aimY * E.length, E.width, E.tele, E.dur, E.dmg);
      }
    }
    e.guard = e.move !== "appear";
    e.weakMul = e.move === "appear" ? B.eyeMul : 1;
    e.cue = e.guard ? "Mắt nhắm · xoắn ốc đạn, né khe hở" : "MẮT MỞ · NÉ TIA MẮT RỒI BẮN (×2)!";
    if (e.guard && this.time - e.firedAt > K.spiral.every) {
      // Mắt nhắm: xoắn ốc đạn quay đều (nổi điên thì thêm một nhánh)
      e.firedAt = this.time;
      const S = K.spiral;
      const arms = S.arms + (e.phase === 2 ? 1 : 0);
      for (let k = 0; k < arms; k++) {
        const a = this.time * S.turn + (k / arms) * Math.PI * 2;
        this.shots.push({ x: cx, y: cy, vx: Math.cos(a) * S.speed, vy: Math.sin(a) * S.speed, r: 0.28, dmg: S.dmg, pierce: false, life: 3.5, enemy: true, level: 2, kind: "orb" });
      }
    }
  }

  private call(text: string, color = "#ff4a64") {
    this.callout = { text, at: this.time, color };
  }

  /**
   * Chiêu đặc trưng của từng trùm, ra xen giữa vòng đánh chính (khi trùm đang thủ, không phải lúc bị choáng):
   * mọi chiêu đều báo trước bằng vùng đỏ để người chơi học cách né. Máu dưới nửa: nổi điên (giai đoạn 2).
   */
  private bossSpecials(e: Enemy) {
    const K = T.bossKit;
    const p = this.player;
    const style = this.def.bossStyle ?? "brute";
    const [ax, bx] = this.def.bossArena;
    const r = this.fxRng;
    if (e.phase === 1 && e.hp < e.maxHp / 2) {
      e.phase = 2;
      e.atkAt = this.time + 1.2;
      this.call(`${this.bossTitle} NỔI ĐIÊN!`);
      this.fx.push({ kind: "bigboom", x: e.x, y: e.y + e.h / 2, at: this.time, n: 0.6 });
      if (style === "dragon" || style === "overlord") this.summon(e, 2, "drone");
      return;
    }
    if (this.time < e.stunUntil || this.time < e.atkAt || e.atkAt === 0) return;
    const mul = e.phase === 2 ? K.phase2Mul : 1;
    const n = e.atkN++;
    switch (style) {
      case "brute":
      case "charger": {
        if (e.move === "windup" || e.move === "charge") {
          e.atkAt = this.time + 0.4;
          e.atkN--;
          return;
        }
        // Mưa tên lửa: các cột đỏ quanh người chơi, đứng vào khe giữa hai cột
        const R = K.rain;
        const cols = R.cols + (e.phase === 2 ? 2 : 0);
        const span = (cols - 1) * R.gap;
        const x0 = THREE_clamp(p.x - span / 2 + (r() - 0.5) * R.gap, ax + 1, Math.max(ax + 1, bx - span));
        for (let i = 0; i < cols; i++) {
          const x = x0 + i * R.gap;
          const gy = this.groundBelow(x, e.y + 4);
          this.warnRect("rock", x - 0.6, gy, x + 0.6, gy + R.height, R.warn + i * 0.07, R.dur, R.dmg);
        }
        this.call("MƯA TÊN LỬA · ĐỨNG VÀO KHE HỞ!", "#ffb03d");
        e.atkAt = this.time + R.every * mul;
        return;
      }
      case "phantom": {
        // Bàn tay ma trồi lên đúng chỗ người chơi đang đứng, từng nhịp một (phải chạy liên tục)
        const H = K.hands;
        const burst = H.n + (e.phase === 2 ? 2 : 0);
        const k = n % (burst + 1);
        if (k === burst) {
          e.atkAt = this.time + 3.6 * mul;
          return;
        }
        if (k === 0) this.call("BÀN TAY MA · CHẠY LIÊN TỤC!", "#c27dff");
        const x = THREE_clamp(p.x + p.vx * 0.25, ax + 1, bx);
        const gy = this.groundBelow(x, p.y + 1);
        this.warnRect("hands", x - H.w / 2, gy, x + H.w / 2, gy + H.h, H.warn, H.dur, H.dmg);
        e.atkAt = this.time + H.every;
        return;
      }
      case "dragon": {
        const half = T.shmup.viewHalf;
        if (n % 2 === 0) {
          // Mưa pha lê: cột từ trời xuống khắp khung hình, bay vào khe
          const C = K.crystal;
          const cols = C.cols + (e.phase === 2 ? 1 : 0);
          const left = this.scrollX - half + 1.5;
          const step = (half * 2 - 6) / cols;
          const off = r() * step;
          for (let i = 0; i < cols; i++) {
            const x = left + off + i * step;
            this.warnRect("crystal", x - C.w / 2, 0, x + C.w / 2, this.height, C.warn + i * 0.06, C.dur, C.dmg);
          }
          this.call("MƯA PHA LÊ · BAY VÀO KHE!", "#7ff3ff");
          e.atkAt = this.time + C.every * mul;
        } else {
          // Tường đạn từ phía rồng: chừa một khe hở
          const W = K.wall;
          const gap0 = 1 + r() * Math.max(1, this.height - W.gap - 3);
          for (let y = 0.8; y < this.height - 1.5; y += W.step) {
            if (y > gap0 && y < gap0 + W.gap) continue;
            this.shots.push({ x: e.x - 1.6, y, vx: -W.speed, vy: 0, r: 0.3, dmg: W.dmg, pierce: false, life: 5, enemy: true, level: 2, kind: "shard" });
          }
          this.call("TƯỜNG VẢY · TÌM KHE HỞ!", "#ffd23d");
          e.atkAt = this.time + W.every * mul;
        }
        return;
      }
      case "overlord": {
        const gy = this.groundBelow((ax + bx) / 2, e.y + 1);
        if (e.phase === 2 && n % 2 === 1) {
          // Sàn điện: nửa số ô sàn xen kẽ bị điện giật, đứng vào ô an toàn
          const F = K.floor;
          const w = (bx + 1 - ax) / F.segs;
          const odd = Math.floor(r() * 2);
          for (let i = 0; i < F.segs; i++) if (i % 2 === odd) this.warnRect("elec", ax + i * w, gy, ax + (i + 1) * w, gy + 0.8, F.warn, F.dur, F.dmg);
          this.call("SÀN ĐIỆN · ĐỨNG VÀO Ô TỐI!", "#5ab4ff");
          e.atkAt = this.time + F.every * mul;
          if (n % 4 === 3) this.summon(e, 2, "drone");
        } else {
          // Tia laser quét sát sàn khắp phòng: nhảy qua đúng lúc
          const B = K.beam;
          this.warnRect("laser", ax, gy, bx + 1, gy + B.h, B.warn, B.dur, B.dmg);
          this.call("LASER QUÉT SÀN · NHẢY!", "#ff2fd0");
          e.atkAt = this.time + B.every * mul;
        }
        return;
      }
      case "armored": {
        if (e.move === "windup" || e.move === "charge") {
          e.atkAt = this.time + 0.4;
          e.atkN--;
          return;
        }
        if (n % 2 === 0) {
          // Đá rơi: vòng đỏ quanh người chơi
          const R = K.rocks;
          const cnt = R.n + (e.phase === 2 ? 2 : 0);
          for (let i = 0; i < cnt; i++) {
            const a = r() * Math.PI * 2;
            const d = i === 0 ? 0 : 1 + r() * R.spread;
            this.warnCircle("rock", p.x + Math.cos(a) * d, p.y + p.h / 2 + Math.sin(a) * d, R.r, R.warn + i * 0.08, R.dur, R.dmg);
          }
          this.call("ĐÁ RƠI · NÉ VÒNG ĐỎ!", "#ffb03d");
          e.atkAt = this.time + R.every * mul;
        } else {
          // Lốc xoáy: gồng rồi lao thẳng tới chỗ người chơi (giáp xoay, đạn bật ra)
          e.move = "charge";
          e.tele = this.time;
          e.aimX = p.x - e.x;
          e.aimY = p.y - e.y;
          const l = Math.hypot(e.aimX, e.aimY) || 1;
          e.aimX /= l;
          e.aimY /= l;
          const S = K.spin;
          this.warnLine("shock", e.x, e.y + e.h / 2, e.x + e.aimX * S.speed * S.time, e.y + e.h / 2 + e.aimY * S.speed * S.time, 1.6, S.tele, S.time, S.dmg);
          this.call("LỐC XOÁY · LƯỚT SANG BÊN!", "#ff6a2a");
          e.atkAt = this.time + 4.5 * mul;
        }
        return;
      }
      case "watcher": {
        if (e.phase === 1) {
          e.atkAt = this.time + 999;
          return;
        }
        // Giai đoạn 2: xúc tu trồi lên đuổi theo người chơi
        const X = K.tentacle;
        const burst = X.n + 1;
        const k = n % (burst + 1);
        if (k === burst) {
          e.atkAt = this.time + 3.4;
          return;
        }
        if (k === 0) this.call("XÚC TU · ĐỪNG ĐỨNG YÊN!", "#7dff5a");
        this.warnCircle("tentacle", p.x + p.vx * 0.3, p.y + p.h / 2 + p.vy * 0.3, X.r, X.warn, X.dur, X.dmg);
        e.atkAt = this.time + X.every;
        return;
      }
    }
  }

  /** Tên trùm ngắn cho lời hô (HUD có tên đầy đủ) */
  private get bossTitle() {
    return { brute: "TRÙM", charger: "ROBOT REAPER", phantom: "LA MADRE", dragon: "RỒNG VÀNG", overlord: "DIRECTOR VANE", armored: "GOBLIN HÀM SẮT", watcher: "KẺ CANH GIỮ" }[this.def.bossStyle ?? "brute"];
  }

  private keepInArena(e: Enemy) {
    const [ax, bx] = this.def.bossArena;
    e.x = Math.max(ax + e.w / 2, Math.min(bx - e.w / 2 + 1, e.x));
  }

  /** Thời gian chuẩn của màn (giây) để xếp hạng */
  get parTime() {
    return Math.max(60, (this.mode === "topdown" ? this.width + this.height : this.width) * 0.75);
  }

  /** Xếp hạng khi qua màn: chết ít, nhanh, combo dài thì hạng cao */
  get rank(): "S" | "A" | "B" | "C" {
    const t = this.clearedAt || this.time;
    if (this.deaths === 0 && t < this.parTime && this.bestCombo >= 4) return "S";
    if (this.deaths <= 1 && t < this.parTime * 1.4) return "A";
    if (this.deaths <= 3) return "B";
    return "C";
  }

  /** Súng dùng ở chế độ súng: trang bị là kiếm thì cầm súng tay mặc định */
  get gunWeapon(): WeaponId {
    return WEAPONS[this.weapon].style === "blade" ? "buster" : this.weapon;
  }

  /** Trang bị là kiếm thì chế độ kiếm dùng chính thanh đó (mạnh hơn, có sóng kiếm / băng) */
  get bladeGear() {
    const W = WEAPONS[this.weapon];
    return W.style === "blade" ? W : null;
  }

  get boss() {
    return this.enemies.find((e) => e.kind === "boss") ?? null;
  }
}

/** Khoảng cách từ điểm (px, py) tới đoạn thẳng (ax, ay)–(bx, by) */
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const l = vx * vx + vy * vy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l)) : 0;
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
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
    slowUntil: -9,
    guard: false,
    stunUntil: -9,
    weakMul: 1,
    cue: "",
    fade: 1,
    broken: 0,
    skillAt: -9 + (id % 4),
    minion: false,
    staggerUntil: -9,
    trait: "basic",
    tele: -9,
    aimX: 0,
    aimY: 0,
    shieldHp: 0,
    phase: 1,
    atkAt: 0,
    atkN: 0,
  };
}

/** Chữ bay lên khi nhặt đồ */
function dropLabel(d: LootDrop): [string, string] {
  if (d.kind === "cred") return [`+${d.amount}`, "#ffd23d"];
  if (d.kind === "health") return [`+${T.player.healthPickup} HP`, "#7dff9a"];
  if (d.kind === "chestKey") return ["+1 CHÌA RƯƠNG", "#7dffb0"];
  if (d.kind === "keyShard") return ["+1 MẢNH CHÌA", "#e0a060"];
  if (d.kind === "part") return [d.part.name.toUpperCase(), RARITY_COLOR[d.part.rarity]];
  return [GEAR[d.gear].name.toUpperCase(), RARITY_COLOR[GEAR[d.gear].rarity]];
}

const RARITY_COLOR: Record<string, string> = { common: "#c9d0d8", rare: "#5ab4ff", epic: "#c27dff", legendary: "#ffc23d", mythic: "#ff4a64" };
