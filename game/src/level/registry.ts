// Danh sách map sau cổng nhiệm vụ: thứ tự mở khoá, hệ số rơi đồ (GDD mục 2), Chìa mùa nhận mảnh,
// ngoại hình địch và đạo cụ nền của từng map. Map sau mở khi đã qua map trước một lần.

import type { ExtraModel } from "../game/assets";
import type { MapId } from "../sim/config";
import type { KeyId } from "../sim/season";
import { LEVEL_1 } from "./level1";
import { LEVEL_CITADEL, LEVEL_HOTEL, LEVEL_HUNT, LEVEL_WARZONE } from "./maps";
import type { LevelDef } from "./platformer";
import type { ViewId } from "./views";

/** Model địch có xương: tên gốc + clip (tên clip → hậu tố file) + chiều cao */
export type RigLook = { base: string; clips: Record<string, string>; height: number };

export type Prop = { name: ExtraModel; height: number; at: [number, number, number]; rot?: number; selfLit?: number };

export type LevelEntry = {
  def: LevelDef;
  mapId: MapId;
  /** Mảnh chìa nhặt trong map này ghép vào Chìa nào */
  key: KeyId | null;
  keyLabel: string;
  mapMultiplier: number;
  blurb: string;
  /** Dạng 2D cố định của map (mỗi map một kiểu, người chơi không đổi) */
  view: ViewId;
  /** Kiểu chơi một dòng, hiện ở bảng chọn map và lúc vào màn */
  howTo: string;
  /** Model cho lính / zombie / trùm (drone dùng chung) */
  looks: { trooper: RigLook; zombie: RigLook; boss: RigLook };
  bossName: string;
  /** Map phụ (chế độ chơi khác): mở khi đã qua map đầu tiên, không chặn map chính */
  side?: boolean;
  /** Toà nhà xa phía sau */
  backBuildings: ExtraModel[];
  /** Đạo cụ lớp giữa và sát làn chơi */
  props: Prop[];
};

const TROOPER: RigLook = { base: "mx_legion_android", clips: { walk: "walk", idle: "idle", shoot: "walkshoot", death: "death" }, height: 1.9 };
const zombieLook = (base: string, height = 1.85): RigLook => ({ base, clips: { walk: "walk", run: "run", attack: "attack", death: "death", hit: "stagger" }, height });
const monster = (base: string, height: number): RigLook => ({ base, clips: { walk: "walk", run: "run", attack: "attack", death: "death", scream: "scream", hit: "stagger" }, height });

export const LEVELS: LevelEntry[] = [
  {
    def: LEVEL_1,
    mapId: "neon_city",
    key: "copper",
    keyLabel: "Chìa Đồng",
    mapMultiplier: 1,
    blurb: "Vùng cách ly ven Neon City. Zombie cyber và lính Legion canh giữ.",
    view: "classic",
    howTo: "Chạy · nhảy · bắn ngang kiểu Mega Man X. Leo tường, lướt qua hố.",
    looks: { trooper: TROOPER, zombie: zombieLook("mx_zmb_walker"), boss: monster("mx_mon_robot_reaper", 3.6) },
    bossName: "Robot Reaper",
    backBuildings: ["mx_bld_factory", "mx_bld_apartment", "mx_bld_clinic", "mx_bld_tower_round", "mx_bld_police_station", "mx_bld_skyscraper", "mx_bld_hotel", "mx_bld_capsule_hotel"],
    props: [
      { name: "mx_map_watchtower", height: 10, at: [24, 0, -34], rot: 0.3 },
      { name: "mx_map_crashed_mech", height: 6, at: [46, 0, -28], rot: -0.6 },
      { name: "mx_map_radio_tower", height: 22, at: [125, 0, -44] },
      { name: "mx_veh_tank", height: 3.2, at: [136, 0, -22], rot: 1.2 },
      { name: "mx_car_armored", height: 2.4, at: [150, 0, -20], rot: -0.4 },
      { name: "mx_map_watchtower", height: 10, at: [160, 0, -34], rot: -0.3 },
      { name: "mx_map_shield_gen", height: 14, at: [178, 0, -34], selfLit: 0.6 },
      { name: "mx_prop_trash_pile", height: 1.6, at: [9, 2, -1.5], rot: 0.4 },
      { name: "mx_prop_trash_pile", height: 1.6, at: [56, 2, -1.5], rot: 2 },
      { name: "mx_prop_trash_pile", height: 1.6, at: [105, 2, -1.5], rot: 1 },
      { name: "mx_supply_crate", height: 1.1, at: [38, 3, -1.5], rot: 0.3 },
      { name: "mx_supply_crate", height: 1.1, at: [147, 2, -1.5], rot: -0.2 },
      { name: "mx_map_citadel", height: 90, at: [210, -4, -150], selfLit: 0.4 },
    ],
  },
  {
    def: LEVEL_HOTEL,
    mapId: "hollow_hotel",
    key: "jade",
    keyLabel: "Chìa Ngọc Bích",
    mapMultiplier: 1.2,
    blurb: "Tháp khách sạn ma. Sương ma dâng từ dưới lên: leo thật nhanh lên sân thượng.",
    view: "ps2",
    howTo: "Leo ngược lên tháp kiểu Ice Climber. Nhảy xuyên bậc từ dưới lên, chậm là bị sương nuốt.",
    looks: { trooper: TROOPER, zombie: zombieLook("mx_hh_ghost", 1.75), boss: monster("mx_mon_mutant", 3.4) },
    bossName: "Quái Đột Biến",
    backBuildings: ["mx_bld_hotel", "mx_bld_nightclub", "mx_bld_capsule_hotel"],
    props: [
      { name: "mx_hh_reception", height: 2, at: [8, 2, -2.2] },
      { name: "mx_hh_planter", height: 3, at: [3.5, 2, -1.8] },
      { name: "mx_hh_planter", height: 3, at: [26.5, 2, -1.8] },
      { name: "mx_hh_luggage_cart", height: 1.8, at: [21, 2, -2] },
      { name: "mx_hh_chandelier", height: 3, at: [15, 13, -3], selfLit: 0.6 },
      { name: "mx_hh_armchair", height: 1.4, at: [12, 17, -2], rot: 0.3 },
      { name: "mx_hh_piano", height: 1.6, at: [17, 17, -2.6], rot: 0.4 },
      { name: "mx_hh_elevator", height: 4, at: [15, 28, -2.6] },
      { name: "mx_hh_elevator", height: 4, at: [15, 36, -2.6] },
      { name: "mx_hh_armchair", height: 1.4, at: [6, 44, -2], rot: -0.3 },
      { name: "mx_hh_planter", height: 3, at: [24, 44, -1.8] },
      { name: "mx_hh_chandelier", height: 3, at: [15, 56, -3], selfLit: 0.6 },
      { name: "mx_hh_luggage_cart", height: 1.8, at: [10, 63, -2], rot: 3.1 },
      { name: "mx_hh_chandelier", height: 3, at: [15, 75, -3], selfLit: 0.6 },
      { name: "mx_hh_piano", height: 1.7, at: [8, 82, -2.6], rot: -0.3 },
      { name: "mx_hh_chandelier", height: 3.4, at: [15, 94, -3], selfLit: 0.7 },
      // Mặt tiền khách sạn khổng lồ phía sau tháp
      { name: "mx_map_hollow_hotel", height: 120, at: [15, -6, -46], selfLit: 0.25 },
    ],
  },
  {
    def: LEVEL_WARZONE,
    mapId: "warzone",
    key: "crystal",
    keyLabel: "Chìa Pha Lê",
    mapMultiplier: 1.5,
    blurb: "Hẻm núi pha lê của hành tinh chiến tranh. Cưỡi xe bay ngược lên giữa hai vách pha lê.",
    view: "topdown",
    howTo: "Bay bắn cuộn dọc nhìn từ trên (kiểu 1942 / Raiden). W/A/S/D bay, K tăng tốc, J bắn.",
    looks: {
      trooper: { base: "mx_wz_heavy", clips: { walk: "walk", idle: "walk", shoot: "walkshoot", death: "death" }, height: 1.95 },
      zombie: zombieLook("mx_zmb_soldier"),
      boss: monster("mx_mon_cyborg_hound_rider", 3.4),
    },
    bossName: "Kỵ Sĩ Chó Máy",
    backBuildings: ["mx_map_bunker", "mx_bld_factory", "mx_map_radio_tower", "mx_map_ruins"],
    props: [
      { name: "mx_wz_crystal", height: 6, at: [22, 0, -7], selfLit: 0.5 },
      { name: "mx_wz_artillery", height: 4, at: [34, 2, -3], rot: 0.5 },
      { name: "mx_map_dropship", height: 8, at: [60, 6, -70], rot: -2.2 },
      { name: "mx_wz_bridge", height: 7, at: [84, 0, -10] },
      { name: "mx_wz_comms", height: 12, at: [104, 0, -14] },
      { name: "mx_wz_ammo", height: 1.4, at: [110, 3, -2] },
      { name: "mx_wz_crystal", height: 7, at: [126, 0, -9], selfLit: 0.5 },
      { name: "mx_wz_hovertank", height: 3, at: [146, 3, -4], rot: 0.2 },
      { name: "mx_wz_crystal", height: 5, at: [168, 0, -6], rot: 1.4, selfLit: 0.5 },
      { name: "mx_wz_sandbags", height: 1.4, at: [196, 3, -2] },
      { name: "mx_veh_tank", height: 3.4, at: [214, 2, -8], rot: -0.6 },
      { name: "mx_colossus_mech", height: 18, at: [226, 0, -50], selfLit: 0.3 },
    ],
  },
  {
    def: LEVEL_CITADEL,
    mapId: "citadel_raid",
    key: null,
    keyLabel: "Cổng cuối",
    mapMultiplier: 2,
    blurb: "Pháo đài của Director Vane. Cầu bậc trên hố gai, tháp đôi, điện ngai vàng.",
    view: "cinema",
    howTo: "Đột kích pháo đài kiểu Shinobi: camera điện ảnh, trận trùm có khung hình rộng.",
    looks: {
      trooper: { base: "mx_ct_guard", clips: { walk: "walk", idle: "walk", shoot: "attack", death: "death" }, height: 1.95 },
      zombie: zombieLook("mx_zmb_cyborg"),
      boss: { base: "mx_vane_human", clips: { walk: "walk", run: "run", attack: "walkshoot", death: "death", scream: "talk", hit: "hit" }, height: 3.6 },
    },
    bossName: "Director Vane",
    backBuildings: ["mx_map_citadel", "mx_map_shield_gen", "mx_bld_megacorp", "mx_bld_skyscraper"],
    props: [
      { name: "mx_ct_keygate", height: 7, at: [6, 2, -3.2], selfLit: 0.5 },
      { name: "mx_ct_brazier", height: 2.2, at: [14, 4, -1.6], selfLit: 0.6 },
      { name: "mx_ct_banner", height: 6, at: [26, 8, -2.5] },
      { name: "mx_ct_pillar", height: 12, at: [40, 0, -5] },
      { name: "mx_ct_pillar", height: 12, at: [60, 0, -5] },
      { name: "mx_ct_conduit", height: 9, at: [70, 6, -3], selfLit: 0.6 },
      { name: "mx_ct_sentinel_turret", height: 3, at: [88, 10, -2.4] },
      { name: "mx_map_turret", height: 3.5, at: [114, 13, -2.4] },
      { name: "mx_ct_banner", height: 6, at: [128, 2, -3] },
      { name: "mx_ct_brazier", height: 2.2, at: [145, 2, -1.6], selfLit: 0.6 },
      { name: "mx_ct_brazier", height: 2.2, at: [165, 2, -1.6], selfLit: 0.6 },
      { name: "mx_ct_conduit", height: 9, at: [180, 2, -4], selfLit: 0.6 },
      { name: "mx_ct_throne", height: 6, at: [196, 2, -5], selfLit: 0.4 },
      { name: "mx_ct_pillar", height: 14, at: [186, 0, -6] },
      { name: "mx_director_vane_mech", height: 14, at: [204, 0, -24], selfLit: 0.4 },
    ],
  },
];

LEVELS.push({
  def: LEVEL_HUNT,
  mapId: "neon_city",
  key: "copper",
  keyLabel: "Chìa Đồng",
  mapMultiplier: 1.3,
  blurb: "Khu phố bị Legion phong toả. Đi giữa các dãy nhà, săn mục tiêu truy nã ở góc đông.",
  view: "iso",
  howTo: "Săn tiền thưởng nhìn chéo sa bàn (kiểu Final Fantasy Tactics). W/A/S/D đi 8 hướng, J bắn theo hướng nhìn, K lướt.",
  side: true,
  looks: { trooper: TROOPER, zombie: zombieLook("mx_zmb_runner"), boss: monster("mx_mon_psycho", 2.6) },
  bossName: "Kẻ Bị Truy Nã",
  backBuildings: [],
  // Map đi 8 hướng: toạ độ đạo cụ là [x, y ô trên mặt đất, bỏ qua]
  props: [
    { name: "mx_noodle_stall", height: 2.6, at: [14.5, 15, 0], rot: 0.4 },
    { name: "mx_vending_kiosk", height: 2.4, at: [26.5, 15, 0], rot: -0.3 },
    { name: "mx_car_taxi", height: 1.6, at: [15.5, 27, 0], rot: 1.57 },
    { name: "mx_prop_trash_pile", height: 1.2, at: [27, 30, 0], rot: 1 },
    { name: "mx_supply_crate", height: 1, at: [38, 12, 0], rot: 0.2 },
    { name: "mx_car_police", height: 1.6, at: [46, 10, 0], rot: 0.1 },
    { name: "mx_prop_neon_arch", height: 6, at: [46.5, 20, 0], rot: 1.57, selfLit: 0.6 },
    { name: "mx_holo_tower", height: 5, at: [3, 20, 0], selfLit: 0.7 },
  ],
});

export const levelById = (id: string) => LEVELS.find((l) => l.def.id === id) ?? LEVELS[0];

/** Map mở khi đã qua map đứng trước (Citadel cần qua đủ ba map: tượng trưng cho đủ 3 Chìa) */
export function isUnlocked(index: number, cleared: string[]) {
  if (index === 0) return true;
  if (LEVELS[index].side) return cleared.includes(LEVELS[0].def.id);
  if (LEVELS[index].mapId === "citadel_raid") return LEVELS.slice(0, index)
      .filter((l) => !l.side)
      .every((l) => cleared.includes(l.def.id));
  return cleared.includes(LEVELS[index - 1].def.id);
}
