// Màn 1 "Vùng cách ly": đi ngang từ cổng thành phố tới phòng trùm Redbot.
// Bản đồ được dựng bằng các lệnh nhỏ (đất, vực, bậc, gai) thay vì gõ tay 200 cột.

import type { EnemyKind, LevelDef } from "./platformer";

export const LEVEL_HEIGHT = 18;

export class LevelBuilder {
  readonly w: number;
  readonly h: number;
  private cells: string[][];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => "."));
  }

  set(c: number, r: number, ch: string) {
    if (c >= 0 && c < this.w && r >= 0 && r < this.h) this.cells[r][c] = ch;
  }

  /** Khối đặc từ đáy lên: cột x0..x1 (gồm cả hai đầu), mặt đứng ở độ cao `top` */
  ground(x0: number, x1: number, top: number) {
    for (let c = x0; c <= x1; c++) for (let r = 0; r < top; r++) this.set(c, r, "#");
    return this;
  }

  /** Khối đặc lơ lửng, mặt đứng ở `top`, dày `thick` ô */
  block(x0: number, x1: number, top: number, thick = 1) {
    for (let c = x0; c <= x1; c++) for (let r = top - thick; r < top; r++) this.set(c, r, "#");
    return this;
  }

  /** Bậc một chiều: nhảy xuyên từ dưới lên, đứng được ở `top` */
  ledge(x0: number, x1: number, top: number) {
    for (let c = x0; c <= x1; c++) this.set(c, top - 1, "=");
    return this;
  }

  /** Chỗ đứng của đạo cụ lớn (nhà thờ, dinh thự) khi nhìn từ trên: chặn đường nhưng không vẽ khối */
  footprint(x0: number, x1: number, y0: number, y1: number) {
    for (let c = x0; c <= x1; c++) for (let r = y0; r <= y1; r++) this.set(c, r, "o");
    return this;
  }

  /** Gai nằm trên mặt đất cao `top` */
  spikes(x0: number, x1: number, top: number) {
    for (let c = x0; c <= x1; c++) this.set(c, top, "^");
    return this;
  }

  /** Hàng trên cùng trước, đúng định dạng LevelDef.rows */
  rows() {
    return this.cells.map((r) => r.join("")).reverse();
  }
}

function e(kind: EnemyKind, x: number, y: number) {
  return { kind, x: x + 0.5, y };
}

function build(): LevelDef {
  const b = new LevelBuilder(196, LEVEL_HEIGHT);
  // Tường chắn hai đầu
  b.ground(0, 1, LEVEL_HEIGHT);
  b.ground(194, 195, LEVEL_HEIGHT);

  // A. Cổng vào: đất bằng, một bậc lên, vực nhỏ
  b.ground(2, 19, 2).ground(20, 30, 4).ground(34, 51, 3);
  b.block(12, 14, 5); // mái che nhỏ để đứng bắn drone

  // B. Leo lên tường thành bằng bậc một chiều (hoặc nhảy tường), rồi xuống bãi gai
  b.ground(52, 69, 2);
  b.ledge(61, 64, 4).ledge(65, 68, 6);
  b.ground(70, 84, 8);
  b.ground(85, 101, 2);
  b.spikes(88, 91, 2);
  b.ledge(87, 92, 5);

  // C. Bãi hoang: vực xen cột trụ, zombie và drone
  b.ground(102, 109, 2);
  b.ground(114, 117, 3);
  b.ground(122, 140, 2);
  b.block(129, 132, 5);
  b.ground(144, 158, 2);

  // D. Hành lang và phòng trùm (cửa đóng ở cột 165 và 190)
  b.ground(159, 193, 2);
  b.block(163, 164, LEVEL_HEIGHT, LEVEL_HEIGHT - 5); // trần thấp trước phòng trùm

  return {
    id: "quarantine",
    name: "VÙNG CÁCH LY",
    rows: b.rows(),
    start: [4.5, 2],
    checkpoints: [
      [53.5, 2],
      [103.5, 2],
      [156.5, 2],
    ],
    enemies: [
      e("trooper", 17, 2),
      e("drone", 27, 7.5),
      e("trooper", 28, 4),
      e("zombie", 44, 3),
      e("trooper", 49, 3),
      e("drone", 66, 9.5),
      e("trooper", 80, 8),
      e("zombie", 95, 2),
      e("zombie", 99, 2),
      e("drone", 112, 6.5),
      e("zombie", 127, 2),
      e("trooper", 131, 5),
      e("zombie", 137, 2),
      e("drone", 142, 6),
      e("trooper", 152, 2),
      e("boss", 186, 2),
    ],
    pickups: [
      [58.5, 2.5],
      [116, 3.5],
      [158.5, 2.5],
    ],
    // Rương giấu: trên mái che đầu màn, trên bậc leo tường thành, trên khối giữa bãi hoang
    chests: [
      { x: 13.5, y: 5, tier: "bronze" },
      { x: 66.5, y: 6, tier: "silver" },
      { x: 130.5, y: 5, tier: "gold" },
    ],
    bossArena: [166, 189],
    theme: "quarantine",
  };
}

export const LEVEL_1 = build();
