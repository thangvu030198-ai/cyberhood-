// Ba map tiếp theo theo kế hoạch mùa trong GDD (mục 2): Hollow Hotel (Chìa Ngọc Bích, ×1.2),
// Warzone (Chìa Pha Lê, ×1.5), Citadel Raid (cần đủ 3 Chìa, ×2.0, trùm Director Vane).
// Mỗi map một kiểu chơi chính: Hotel leo dọc (giếng thang máy), Warzone hố rộng + lướt nhảy, Citadel cầu bậc trên hố gai.

import type { EnemyKind, LevelDef } from "./platformer";
import { LEVEL_HEIGHT, LevelBuilder } from "./level1";

const e = (kind: EnemyKind, x: number, y: number) => ({ kind, x: x + 0.5, y });

/** Hollow Hotel: tháp khách sạn 30 ô ngang, cao 100 ô. Leo ngược lên trước khi sương ma nuốt; trùm trên sân thượng */
function hollowHotel(): LevelDef {
  const W = 30;
  const H = 100;
  const b = new LevelBuilder(W, H);
  b.ground(0, 1, H).ground(W - 2, W - 1, H);
  b.ground(2, W - 3, 2);
  const L = (x0: number, x1: number, stand: number) => b.ledge(x0, x1, stand);
  // Tầng 1–3: hành lang so le (bậc một chiều cách nhau 2 ô), lệch trái / phải
  for (let i = 0; i < 6; i++) {
    const y = 4 + i * 2;
    if (i % 2 === 0) L(2, 17, y);
    else L(12, W - 3, y);
  }
  // Sàn đặc tầng 4 có lỗ thủng bên phải, bên trên gai kính vỡ
  b.block(2, 22, 17, 1);
  b.spikes(6, 9, 17);
  L(23, W - 3, 16);
  for (let i = 0; i < 4; i++) L(i % 2 === 0 ? 14 : 3, i % 2 === 0 ? W - 3 : 15, 19 + i * 2);
  // Giếng thang máy: sàn đặc chừa lỗ 14–16, hai vách cao 16 ô — leo tường lên
  b.block(2, 13, 28, 2).block(17, W - 3, 28, 2);
  L(14, 16, 26);
  L(14, 16, 28);
  b.block(12, 13, 44, 16).block(17, 18, 44, 16);
  b.block(2, 11, 44, 2).block(19, W - 3, 44, 2);
  // Tầng 6–8: so le có gai, drone canh
  for (let i = 0; i < 8; i++) {
    const y = 46 + i * 2;
    if (i % 2 === 0) L(2, 16, y);
    else L(13, W - 3, y);
  }
  b.spikes(4, 6, 50).spikes(22, 24, 52);
  // Sàn đặc, lỗ bên phải
  b.block(2, 21, 63, 1);
  L(22, W - 3, 62);
  for (let i = 0; i < 8; i++) L(i % 2 === 0 ? 13 : 2, i % 2 === 0 ? W - 3 : 16, 64 + i * 2);
  L(10, 18, 80);
  // Sân thượng: sàn đặc, cửa một chiều ở giữa (vào là không rơi xuống lại được)
  b.block(2, 12, 82, 2).block(17, W - 3, 82, 2);
  L(13, 16, 82);
  // Trần phòng trùm
  b.block(2, W - 3, H, 3);

  return {
    id: "hollow_hotel",
    name: "HOLLOW HOTEL",
    mode: "climb",
    rows: b.rows(),
    start: [4.5, 2],
    checkpoints: [
      [24.5, 16],
      [5.5, 44],
      [4.5, 63],
    ],
    enemies: [
      e("zombie", 10, 8),
      e("drone", 20, 13),
      e("zombie", 6, 17),
      e("zombie", 20, 24),
      e("drone", 6, 34),
      e("drone", 24, 38),
      e("zombie", 8, 50),
      e("drone", 20, 56),
      e("zombie", 15, 63),
      e("drone", 8, 72),
      e("zombie", 20, 75),
      e("boss", 22, 82),
    ],
    pickups: [
      [26, 16.5],
      [5, 44.5],
      [4, 63.5],
    ],
    chests: [
      { x: 3.5, y: 17, tier: "bronze" },
      { x: 25.5, y: 44, tier: "silver" },
      { x: 20.5, y: 63, tier: "gold" },
    ],
    bossArena: [2, W - 3],
    bossFloor: 82,
    theme: "hotel",
  };
}

/** Warzone: cưỡi xe bay qua hẻm núi chiến trường. Màn hình tự cuộn; né vách đá, trụ pha lê, bắn drone và pháo */
function warzone(): LevelDef {
  const W = 240;
  const H = 18;
  const b = new LevelBuilder(W, H);
  b.ground(0, 1, H);
  b.ground(W - 2, W - 1, H);
  // Nền hẻm núi lượn sóng và trần đá
  for (let x = 2; x < W - 2; x++) {
    const floor = 2 + Math.round(1.2 + Math.sin(x * 0.11) * 1.2 + (x > 60 && x < 100 ? 1 : 0));
    const ceil = H - 2 - Math.round(1 + Math.sin(x * 0.07 + 1) * 1.2);
    b.ground(x, x, x >= 206 ? 2 : floor);
    if (x < 206) b.block(x, x, H, H - ceil);
  }
  // Trụ chắn: đi vòng trên hoặc dưới
  const pillar = (x: number, fromTop: boolean, len: number) => (fromTop ? b.block(x, x + 1, H, len) : b.ground(x, x + 1, len + 3));
  pillar(40, false, 4);
  pillar(55, true, 6);
  pillar(72, false, 4);
  pillar(80, true, 5);
  pillar(96, false, 4);
  pillar(112, true, 6);
  pillar(126, false, 5);
  pillar(134, true, 5);
  pillar(150, false, 5);
  pillar(166, true, 6);
  pillar(180, false, 5);
  pillar(190, true, 6);

  return {
    id: "warzone",
    name: "WARZONE",
    mode: "shmup",
    rows: b.rows(),
    start: [6.5, 8],
    checkpoints: [
      [70, 9],
      [140, 9],
      [200, 9],
    ],
    enemies: [
      e("drone", 30, 10),
      e("drone", 36, 6),
      e("trooper", 48, 5),
      e("drone", 62, 12),
      e("drone", 68, 7),
      e("drone", 88, 10),
      e("trooper", 104, 4),
      e("drone", 118, 6),
      e("drone", 122, 12),
      e("trooper", 140, 4),
      e("drone", 158, 9),
      e("drone", 172, 5),
      e("drone", 176, 12),
      e("trooper", 196, 4),
      e("boss", 228, 2),
    ],
    pickups: [
      [72, 9],
      [142, 9],
      [202, 9],
    ],
    // Rương lơ lửng giữa hẻm (bay sát vào là mở)
    chests: [
      { x: 88.5, y: 9, tier: "silver" },
      { x: 158.5, y: 8, tier: "gold" },
    ],
    bossArena: [210, 236],
    theme: "warzone",
  };
}

function citadel(): LevelDef {
  const b = new LevelBuilder(208, LEVEL_HEIGHT);
  b.ground(0, 1, LEVEL_HEIGHT).ground(206, 207, LEVEL_HEIGHT);
  // A. Cổng pháo đài: bậc thềm đi lên
  b.ground(2, 12, 2).ground(13, 16, 4).ground(17, 20, 6).ground(21, 34, 8);
  // B. Cầu bậc treo trên hố gai dài
  b.ground(35, 64, 1);
  b.spikes(35, 64, 1);
  for (const [x0, top] of [
    [37, 6],
    [42, 7],
    [47, 6],
    [52, 8],
    [57, 7],
  ] as const)
    b.ledge(x0, x0 + 2, top);
  b.ground(65, 74, 6);
  // C. Tháp đôi: leo tường hai lần
  b.ground(75, 82, 2);
  b.ground(83, 84, 10);
  b.ground(85, 92, 10);
  b.ground(93, 100, 4);
  b.ground(101, 102, 13);
  b.ledge(98, 100, 8);
  b.ground(103, 116, 13);
  b.spikes(108, 110, 13);
  b.ledge(107, 111, 15);
  // D. Hành lang ngai vàng: đi xuống, cột lửa (gai) xen kẽ
  for (let i = 0; i < 5; i++) b.ground(117 + i * 3, 119 + i * 3, 11 - i * 2);
  b.ground(132, 170, 2);
  b.spikes(140, 141, 2).spikes(150, 151, 2).spikes(160, 161, 2);
  b.block(139, 142, 5, 1).block(149, 152, 5, 1).block(159, 162, 5, 1);
  // E. Điện ngai vàng: trùm Director Vane
  b.ground(171, 205, 2);
  b.block(174, 175, LEVEL_HEIGHT, LEVEL_HEIGHT - 5);

  return {
    id: "citadel_raid",
    name: "CITADEL",
    rows: b.rows(),
    start: [4.5, 2],
    checkpoints: [
      [66.5, 6],
      [104.5, 13],
      [133.5, 2],
    ],
    enemies: [
      e("trooper", 10, 2),
      e("trooper", 28, 8),
      e("drone", 44, 11),
      e("drone", 55, 12),
      e("trooper", 72, 6),
      e("zombie", 78, 2),
      e("trooper", 90, 10),
      e("drone", 97, 9),
      e("trooper", 113, 13),
      e("zombie", 135, 2),
      e("trooper", 145, 2),
      e("drone", 155, 8),
      e("trooper", 166, 2),
      e("boss", 198, 2),
    ],
    pickups: [
      [67, 6.5],
      [105, 13.5],
      [134, 2.5],
    ],
    chests: [
      { x: 53.5, y: 8, tier: "silver" },
      { x: 109.5, y: 15, tier: "gold" },
      { x: 150.5, y: 5, tier: "gold" },
    ],
    bossArena: [177, 201],
    theme: "skyline",
  };
}

export const LEVEL_HOTEL = hollowHotel();
export const LEVEL_WARZONE = warzone();
export const LEVEL_CITADEL = citadel();
