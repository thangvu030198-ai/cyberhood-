// Danh sách map sau cổng nhiệm vụ: thứ tự mở khoá, hệ số rơi đồ (GDD mục 2), Chìa mùa nhận mảnh,
// ngoại hình địch và đạo cụ nền của từng map. Map sau mở khi đã qua map trước một lần.

import type { ExtraModel } from "../game/assets";
import type { MapId } from "../sim/config";
import type { KeyId } from "../sim/season";
import { LEVEL_1 } from "./level1";
import { LEVEL_CITADEL, LEVEL_HOTEL, LEVEL_HUNT, LEVEL_PARISH, LEVEL_WARZONE } from "./maps";
import type { LevelDef } from "./platformer";
import type { ViewId } from "./views";

/** Model địch có xương: tên gốc + clip (tên clip → hậu tố file, hoặc đủ tên "mx_..." để mượn clip của model khác) + chiều cao */
export type RigLook = { base: string; clips: Record<string, string>; height: number };
/**
 * Model địch không xương (sinh vật kỳ dị không rig được): chuyển động dựng bằng tay.
 * float: trôi lơ lửng, lắc lư; crawl: bò sát đất, nhún theo bước; fly: bay lượn, chao cánh
 */
/** `by: "longest"`: `height` là cạnh dài nhất (model có tay / cánh dài toả ra, đo theo chiều cao sẽ to quá cỡ) */
export type StaticLook = { model: ExtraModel; height: number; motion: "float" | "crawl" | "fly"; by?: "height" | "longest" };
export type Look = RigLook | StaticLook;
/** Một kiểu hoặc một nhóm kiểu (mỗi địch lấy một kiểu theo số thứ tự, cho đám đông đa dạng) */
export type LookSet = Look | Look[];

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
  /** Model cho lính / zombie / trùm; drone mặc định là drone Kamdo */
  looks: { trooper: LookSet; zombie: LookSet; boss: Look; drone?: LookSet };
  bossName: string;
  /** Map phụ (chế độ chơi khác): mở khi đã qua map đầu tiên, không chặn map chính */
  side?: boolean;
  /** Toà nhà xa phía sau */
  backBuildings: ExtraModel[];
  /** Đạo cụ lớp giữa và sát làn chơi */
  props: Prop[];
  /** Cốt truyện: tên chương, lời dẫn khi vào màn, câu thoại trùm, kết chương */
  story: { chapter: string; intro: string; boss: string; outro: string };
  /** Phông nền vẽ sẵn (public/mattes/<tên>.webp) thay cho lớp cảnh xa dựng bằng 3D */
  matte?: string;
  /** Ảnh sàn khi nhìn từ trên (public/mattes/<tên>.webp, lặp đối xứng) */
  floorTex?: string;
};

const TROOPER: RigLook = { base: "mx_legion_android", clips: { walk: "walk", idle: "idle", shoot: "walkshoot", death: "death" }, height: 1.9 };
const zombieLook = (base: string, height = 1.85): RigLook => ({ base, clips: { walk: "walk", run: "run", attack: "attack", death: "death", hit: "stagger" }, height });
const monster = (base: string, height: number): RigLook => ({ base, clips: { walk: "walk", run: "run", attack: "attack", death: "death", scream: "scream", hit: "stagger" }, height });
/** Zombie rig mới (model người chơi tải lên): đi/chạy của chính nó, đòn đánh / chết / khựng mượn của zombie gốc */
const drZombie = (name: string, height = 1.85, ownRun = true): RigLook => ({
  base: `mx_dr_${name}`,
  clips: { walk: "walk", run: ownRun ? "run" : "mx_zmb_runner_run", attack: "mx_zmb_walker_attack", death: "mx_zmb_walker_death", hit: "mx_zmb_walker_stagger" },
  height,
});
/** Trùm rig mới: mượn bộ đòn của Quái Đột Biến */
const drBoss = (name: string, height: number, ownRun = true): RigLook => ({
  base: `mx_dr_${name}`,
  clips: { walk: "walk", run: ownRun ? "run" : "mx_mon_mutant_run", attack: "mx_mon_mutant_attack", death: "mx_mon_mutant_death", scream: "mx_mon_mutant_scream", hit: "mx_mon_mutant_stagger" },
  height,
});
/** Lính cận chiến rig mới (hiệp sĩ): mượn đòn chém của lính Citadel */
const drGuard = (name: string, height = 1.95): RigLook => ({
  base: `mx_dr_${name}`,
  clips: { walk: "walk", idle: "walk", shoot: "mx_ct_guard_attack", death: "mx_ct_guard_death" },
  height,
});
const still = (name: string, height: number, motion: StaticLook["motion"], by?: StaticLook["by"]): StaticLook => ({ model: `mx_dr_${name}` as ExtraModel, height, motion, by });

export const LEVELS: LevelEntry[] = [
  {
    def: LEVEL_1,
    matte: "quarantine",
    story: { chapter: "Chương 1 · Vùng Cách Ly", intro: "Virus NX-0 biến dân khu ven thành zombie cyber. Robot Reaper của Legion canh cổng cách ly — trong lõi nó là mảnh Chìa Đồng.", boss: 'ROBOT REAPER: "Khu này đã bị xoá khỏi bản đồ. Ngươi cũng vậy."', outro: "Robot Reaper sụp đổ. Lõi của nó chứa toạ độ Hollow Hotel — nơi Legion giấu Chìa Ngọc Bích." },
    mapId: "neon_city",
    key: "copper",
    keyLabel: "Chìa Đồng",
    mapMultiplier: 1,
    blurb: "Vùng cách ly ven Neon City. Zombie cyber và lính Legion canh giữ.",
    view: "classic",
    howTo: "Chạy · nhảy · bắn ngang kiểu Mega Man X. Leo tường, lướt qua hố.",
    looks: {
      trooper: TROOPER,
      // Vùng cách ly: đủ kiểu người nhiễm (zombie gốc + 5 zombie Meshy mới)
      zombie: [zombieLook("mx_zmb_walker"), drZombie("zmb_jeans"), drZombie("zmb_shirt"), drZombie("zmb_gut", 1.8), drZombie("zmb_walker2", 1.8, false), drZombie("zmb_vest")],
      boss: monster("mx_mon_robot_reaper", 3.6),
    },
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
    matte: "hollow_hotel",
    story: { chapter: "Chương 2 · Hollow Hotel", intro: "Khách sạn xa hoa nhất Neon City đã sụp vào lòng đất. Những vị khách cuối cùng chưa từng rời đi…", boss: 'LA MADRE: "Các con ta ở lại đây mãi mãi… con cũng vậy."', outro: "Tiếng khóc tắt dần. La Madre để lại Chìa Ngọc Bích và tấm bản đồ một hẻm núi pha lê ngoài quỹ đạo." },
    mapId: "hollow_hotel",
    key: "jade",
    keyLabel: "Chìa Ngọc Bích",
    mapMultiplier: 1.2,
    blurb: "Khách sạn cổ đổ sụp vào hang đá gothic. Cầu sắt, ván gỗ treo qua vực sâu; đèn chùm, đàn piano, sách vở vương vãi.",
    view: "ps2",
    howTo: "Vượt cầu treo qua vực (rơi là mất mạng). Nhảy, leo vách đá, lướt qua khe rộng; bậc ván gãy giấu rương.",
    looks: {
      trooper: TROOPER,
      // Khách trọ ma: hồn ma bellhop, cô dâu tóc dài, đứa trẻ rỗng ruột
      zombie: [zombieLook("mx_hh_ghost", 1.75), drZombie("bride", 1.8), drZombie("child", 1.45, false)],
      // Quỷ nhiều tay trôi lơ lửng thay drone
      drone: still("wraith", 3.2, "float", "longest"),
      boss: drBoss("madre", 3.6, false),
    },
    bossName: "La Madre · Bà Mẹ Than Khóc",
    backBuildings: ["mx_map_ruins"],
    props: [
      { name: "mx_hh_reception", height: 2, at: [5, 8, -1.6] },
      { name: "mx_hh_piano", height: 1.7, at: [36, 10, -1.4], rot: 0.4 },
      { name: "mx_hh_elevator", height: 4.2, at: [67, 8, -2.4], selfLit: 0.5 },
      { name: "mx_hh_armchair", height: 1.4, at: [99, 13, -1.4], rot: -0.3 },
      { name: "mx_hh_planter", height: 3, at: [133, 11, -1.6] },
      { name: "mx_hh_piano", height: 1.8, at: [170, 8, -2.2], rot: -0.5 },
      { name: "mx_hh_reception", height: 2.2, at: [192, 8, -2.4] },
      // Dinh thự và nhà thờ cổ chìm sâu trong lòng hang
      { name: "mx_dr_mansion", height: 18, at: [60, -14, -40], selfLit: 0.35 },
      { name: "mx_dr_church", height: 26, at: [140, -16, -46], selfLit: 0.35 },
      { name: "mx_map_hollow_hotel", height: 60, at: [100, -20, -70], selfLit: 0.3 },
    ],
  },
  {
    def: LEVEL_WARZONE,
    matte: "warzone",
    story: { chapter: "Chương 3 · Hẻm Pha Lê", intro: "Legion khai thác pha lê năng lượng trên một hành tinh chiến tranh. Lái tàu xuyên hẻm núi trước khi Rồng Vàng phát hiện.", boss: 'RỒNG VÀNG gầm vang — vảy nó cứng như hợp kim, chỉ khi há miệng mới lộ điểm yếu.', outro: "Chìa Pha Lê đã về tay. Ba chìa ghép lại, cổng Citadel bắt đầu rung chuyển." },
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
      // Rồng đen bay thành đàn trong hẻm núi, Rồng Vàng canh cuối hẻm
      drone: still("dragon", 2.6, "fly"),
      boss: still("golddragon", 5, "fly"),
    },
    bossName: "Rồng Vàng Canh Hẻm",
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
    matte: "citadel_raid",
    story: { chapter: "Chương cuối · Pháo Đài Citadel", intro: "Ba chìa mở cổng. Director Vane chờ trên ngai sắt giữa pháo đài.", boss: 'DIRECTOR VANE: "Thành phố này cần một chủ nhân, không cần anh hùng."', outro: "Lõi Ký Ức được giải phóng, Neon City thở lại. Nhưng ở đâu đó, Legion vẫn còn người kế vị…" },
    mapId: "citadel_raid",
    key: null,
    keyLabel: "Cổng cuối",
    mapMultiplier: 2,
    blurb: "Pháo đài của Director Vane. Cầu bậc trên hố gai, tháp đôi, điện ngai vàng.",
    view: "cinema",
    howTo: "Đột kích pháo đài kiểu Shinobi: camera điện ảnh, trận trùm có khung hình rộng.",
    looks: {
      // Vệ binh pháo đài: lính Citadel, hiệp sĩ giáp bạc, hiệp sĩ hắc diện
      trooper: [{ base: "mx_ct_guard", clips: { walk: "walk", idle: "walk", shoot: "attack", death: "death" }, height: 1.95 }, drGuard("knight"), drGuard("obsidian", 2)],
      zombie: [zombieLook("mx_zmb_cyborg"), drZombie("zmb_bones")],
      boss: { base: "mx_vane_human", clips: { walk: "walk", run: "run", attack: "walkshoot", death: "death", scream: "talk", hit: "hit" }, height: 3.6 },
    },
    bossName: "Director Vane",
    backBuildings: ["mx_map_citadel", "mx_map_shield_gen", "mx_bld_megacorp", "mx_bld_skyscraper"],
    props: [
      { name: "mx_dr_throne", height: 5, at: [190, 2, -3.6], selfLit: 0.3 },
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
  story: { chapter: "Truy nã · Khu Săn Neon", intro: "Thủ lĩnh Goblin Hàm Sắt cướp hàng tiếp tế của Cyberhood rồi trốn vào khu phố bị phong toả.", boss: 'GOBLIN HÀM SẮT: "Chuỳ của ta nặng hơn cả đời ngươi!"', outro: "Hàng tiếp tế đã về. Bầy thú săn tan tác khỏi khu phố." },
  mapId: "neon_city",
  key: "copper",
  keyLabel: "Chìa Đồng",
  mapMultiplier: 1.3,
  blurb: "Khu phố bị Legion phong toả. Đi giữa các dãy nhà, săn mục tiêu truy nã ở góc đông.",
  view: "iso",
  howTo: "Săn tiền thưởng nhìn chéo sa bàn (kiểu Final Fantasy Tactics). W/A/S/D đi 8 hướng, J bắn theo hướng nhìn, K lướt.",
  side: true,
  looks: {
    trooper: [TROOPER, drGuard("goblin", 1.5)],
    // Bầy thú săn đêm: người sói, sói con, chó thịt
    zombie: [drZombie("werewolf", 2.1), drZombie("wolfling", 1.6), zombieLook("mx_zmb_runner")],
    drone: still("fleshfang", 1.4, "crawl"),
    boss: drBoss("warlord", 2.8),
  },
  bossName: "Thủ Lĩnh Goblin Hàm Sắt",
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

LEVELS.push({
  def: LEVEL_PARISH,
  floorTex: "parish_floor",
  story: { chapter: "Truyền thuyết · Giáo Xứ Neon", intro: "Chuông nhà thờ bỏ hoang lại vang lúc nửa đêm. Người chết bị cấy chip đứng dậy — Kẻ Canh Giữ đã thức.", boss: 'KẺ CANH GIỮ mở con mắt duy nhất… rồi khép lại.', outro: "Chuông im bặt. Con mắt khép vĩnh viễn, giáo xứ chìm lại trong ánh neon." },
  mapId: "hollow_hotel",
  key: "jade",
  keyLabel: "Chìa Ngọc Bích",
  mapMultiplier: 1.4,
  blurb: "Khu nhà thờ bỏ hoang giữa lòng Neon City: biển hiệu hỏng chập chờn, người chết bị cấy chip lang thang giữa nghĩa địa. Kẻ Canh Giữ chờ ở bãi tế.",
  view: "farm",
  howTo: "Phiêu lưu nhìn từ trên kiểu Stardew Valley. W/A/S/D đi 8 hướng, J bắn / chém theo hướng nhìn, K lướt. Tab mở Túi đồ ở thành phố.",
  side: true,
  looks: {
    // Sinh vật bò phun axit đứng xa mà bắn
    trooper: [still("crawler", 1.5, "crawl"), still("fleshfang", 1.3, "crawl")],
    // Người chết đủ kiểu: áo choàng, rách rưới, trơ xương sườn, nụ cười khâu, bóng đen, đầu còi, quái hai đầu
    zombie: [drZombie("zmb_hood"), drZombie("zmb_rag"), drZombie("zmb_ribs"), drZombie("grin", 1.75, false), drZombie("shade", 2.1, false), drZombie("siren", 2.4), drZombie("twinhead", 2.1, false)],
    drone: [still("sinew", 3.2, "float", "longest"), still("wraith", 3.2, "float", "longest")],
    boss: still("watcher", 4.4, "float"),
  },
  bossName: "Kẻ Canh Giữ",
  backBuildings: [],
  props: [
    { name: "mx_dr_church", height: 9.5, at: [13, 33, 0] },
    // Tu viện đổ nát bên cạnh nhà thờ, tượng thiên thần khóc canh cửa, bàn thờ hoang ở bãi tế
    { name: "mx_map_ruins", height: 1.6, at: [31.5, 36.5, 0], rot: 0.2, selfLit: 0.3 },
    { name: "mx_pr_angel_statue", height: 2.8, at: [31.5, 36.5, 0], rot: 3.4, selfLit: 0.35 },
    { name: "mx_pr_candle_stand", height: 1.6, at: [28, 33, 0], rot: 0.5, selfLit: 0.6 },
    { name: "mx_pr_candle_stand", height: 1.6, at: [35, 33, 0], rot: 2.5, selfLit: 0.6 },
    { name: "mx_pr_angel_statue", height: 2.6, at: [8, 27, 0], rot: 0.3, selfLit: 0.35 },
    { name: "mx_pr_angel_statue", height: 2.6, at: [18, 27, 0], rot: -0.3, selfLit: 0.35 },
    { name: "mx_pr_altar", height: 2.6, at: [54.5, 22, 0], rot: -1.57, selfLit: 0.45 },
    { name: "mx_pr_coffin", height: 0.7, at: [30, 13, 0], rot: 0.4 },
    { name: "mx_pr_coffin", height: 0.7, at: [36, 28, 0], rot: 2.1 },
    { name: "mx_pr_dead_tree", height: 4, at: [22, 40, 0], rot: 1 },
    { name: "mx_pr_dead_tree", height: 3.6, at: [40, 3, 0], rot: 2.5 },
    { name: "mx_dr_reaper_statue", height: 3.6, at: [24, 21, 0], selfLit: 0.4 },
    { name: "mx_dr_rocks", height: 1.6, at: [6, 15, 0], rot: 0.6 },
    { name: "mx_dr_rocks", height: 1.4, at: [41, 9, 0], rot: 2.1 },
    { name: "mx_dr_rocks", height: 1.5, at: [18, 6, 0], rot: 4 },
    { name: "mx_dr_reaper_statue", height: 3, at: [50, 38, 0], rot: -0.5, selfLit: 0.5 },
    { name: "mx_dr_reaper_statue", height: 3, at: [50, 6, 0], rot: 0.5, selfLit: 0.5 },
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
