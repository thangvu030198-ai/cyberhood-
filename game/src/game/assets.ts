import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import droneUrl from "../assets/kenney/enemy-flying.glb?inline";
import blasterUrl from "../assets/kenney/blaster.glb?inline";
import repeaterUrl from "../assets/kenney/blaster-repeater.glb?inline";
import colormapUrl from "../assets/kenney/colormap.png?inline";
import sfxBlaster from "../assets/sounds/blaster.ogg?inline";
import sfxRepeater from "../assets/sounds/blaster_repeater.ogg?inline";
import sfxEnemyAttack from "../assets/sounds/enemy_attack.ogg?inline";
import sfxEnemyDestroy from "../assets/sounds/enemy_destroy.ogg?inline";
import sfxEnemyHurt from "../assets/sounds/enemy_hurt.ogg?inline";

// Asset nhỏ (Kenney) nhúng thẳng trong bundle. Model lớn nằm ở public/models và được tải khi chạy,
// để file JS không vượt giới hạn và màn hình tải hiện được tiến độ thật.

function dataUrlToBuffer(url: string) {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

function makeLoader() {
  const manager = new THREE.LoadingManager();
  // Model Kenney trỏ tới "Textures/colormap.png" bên ngoài: chuyển sang bản nhúng.
  manager.setURLModifier((u) => (u.endsWith("colormap.png") ? colormapUrl : u));
  const loader = new GLTFLoader(manager);
  // Model lớn được nén lưới bằng meshopt (EXT_meshopt_compression) để vừa giới hạn dung lượng artifact
  loader.setMeshoptDecoder(MeshoptDecoder);
  // Nạp ảnh qua thẻ <img> thay vì fetch, vì CSP của artifact có thể chặn fetch data/blob URI.
  loader.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(manager);
    return { name: "cyberhood_img_textures" };
  });
  return loader;
}

function parseGlb(url: string): Promise<GLTF> {
  return makeLoader().parseAsync(dataUrlToBuffer(url), "");
}

/** Tiến độ tải model lớn, đọc bởi màn hình tải */
export const loadProgress = { loaded: 0, total: 0, files: 0, done: 0, error: null as string | null };

/**
 * Artifact chỉ phục vụ một số đuôi file; .glb không nằm trong đó nên bản build đóng gói model
 * dưới tên "*.glb.wasm" (nội dung giữ nguyên). Khi chạy dev thì đọc thẳng .glb.
 */
const MODEL_SUFFIX = import.meta.env.PROD ? ".wasm" : "";

/** Tải model từ public/models, đếm byte để hiện tiến độ */
function fetchGlb(name: string, sizeHint: number): Promise<GLTF> {
  loadProgress.total += sizeHint;
  loadProgress.files++;
  return fetch(`models/${name}${MODEL_SUFFIX}`)
    .then(async (res) => {
      if (!res.ok || !res.body) throw new Error(`Không tải được ${name} (${res.status})`);
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        loadProgress.loaded += value.length;
      }
      const buf = new Uint8Array(got);
      let offset = 0;
      for (const c of chunks) {
        buf.set(c, offset);
        offset += c.length;
      }
      loadProgress.done++;
      return makeLoader().parseAsync(buf.buffer, "");
    })
    .catch((e: Error) => {
      loadProgress.error = e.message;
      throw e;
    });
}

/** Model tải nền sau khi vào game: không chặn màn hình tải, hiện ra khi xong */
const extraCache = new Map<string, Promise<GLTF>>();
const EXTRA_SIZES = {
  /** Titan Frame: robot người chơi của Godot TPS Demo (Juan Linietsky, Fernando Calabró, CC-BY 3.0) */
  mech: 7_416_000,
  /** Trùm Mech: robot đỏ TPS Demo (CC-BY 3.0) */
  redbot: 3_108_000,
  forklift: 3_914_000,
  spaceship: 578_000,
  ufo: 89_000,
  fridge: 1_751_000,
  computers: 295_000,
  love: 225_000,
  iondrive: 2_814_000,
  robotarm: 2_491_000,
  crate: 198_000,
  tokyo: 8_137_000,
  skyline: 5_249_000,
  teleporter: 60_000,
  holotree: 84_000,
  /** Đám đông: 100Avatars của Polygonal Mind (CC0), chia 2 file */
  crowd_a: 9_472_000,
  crowd_b: 7_639_000,
  /** Drone Legion: "S2WT Kamdo" của Hansalex (CC-BY 4.0) */
  kamdo: 720_000,
  /** RobotExpressive: Tomás Laulhé (CC0) */
  robot: 416_000,
  /** Đạo cụ phố: Polygonal Mind, KayKit, Khronos/Microsoft, Michael Pavlovic (CC0) và Traffic Cone của hinndia (CC-BY 4.0) */
  street: 5_372_000,
  helicopter: 2_344_000,
  bigufo: 1_462_000,
  platform: 1_412_000,
  // Model gốc tạo bằng Meshy (text-to-3d, tài khoản của chủ dự án), xem docs/MESHY_ASSETS.md
  mx_archivist_run: 34_988,
  mx_archivist_walk: 490_492,
  mx_battery_cell: 232_932,
  mx_bld_apartment: 411_628,
  mx_bld_arcade: 405_328,
  mx_bld_capsule_hotel: 435_920,
  mx_bld_clinic: 460_944,
  mx_bld_factory: 430_080,
  mx_bld_hotel: 448_712,
  mx_bld_megacorp: 527_180,
  mx_bld_nightclub: 446_016,
  mx_bld_noodle_bar: 745_080,
  mx_bld_pagoda: 519_412,
  mx_bld_police_station: 581_744,
  mx_bld_shoprow: 515_928,
  mx_bld_skyscraper: 397_308,
  mx_bld_tower_round: 576_572,
  mx_car_armored: 750_292,
  mx_car_muscle: 658_812,
  mx_car_police: 503_232,
  mx_car_sedan: 477_112,
  mx_car_sports: 480_880,
  mx_car_taxi: 471_956,
  mx_car_truck: 614_068,
  mx_car_van: 517_768,
  mx_chrono_cube: 307_404,
  mx_civ_biker_idle: 124_228,
  mx_civ_biker_run: 34_836,
  mx_civ_biker_walk: 881_304,
  mx_civ_biker_wave: 63_264,
  mx_civ_courier_idle: 124_272,
  mx_civ_courier_run: 34_880,
  mx_civ_courier_walk: 635_136,
  mx_civ_courier_wave: 62_576,
  mx_civ_dancer_dance: 79_708,
  mx_civ_dancer_idle: 124_380,
  mx_civ_dancer_run: 34_992,
  mx_civ_dancer_walk: 957_924,
  mx_civ_dancer_wave: 63_128,
  mx_civ_elder_idle: 124_380,
  mx_civ_elder_run: 34_992,
  mx_civ_elder_walk: 623_748,
  mx_civ_elder_wave: 61_720,
  mx_civ_punk_run: 34_860,
  mx_civ_punk_walk: 747_588,
  mx_civ_salaryman_run: 35_056,
  mx_civ_salaryman_walk: 478_128,
  mx_civ_student_idle: 124_284,
  mx_civ_student_run: 34_896,
  mx_civ_student_walk: 666_760,
  mx_civ_student_wave: 62_700,
  mx_civ_vendor_run: 34_896,
  mx_civ_vendor_walk: 517_160,
  mx_civ_worker_idle: 124_296,
  mx_civ_worker_run: 34_908,
  mx_civ_worker_walk: 707_328,
  mx_civ_worker_wave: 62_884,
  mx_cls_engineer_death: 111_040,
  mx_cls_engineer_hit: 97_708,
  mx_cls_engineer_idle: 124_288,
  mx_cls_engineer_jump: 72_056,
  mx_cls_engineer_run: 34_900,
  mx_cls_engineer_runshoot: 35_792,
  mx_cls_engineer_walk: 992_424,
  mx_cls_engineer_walkshoot: 104_788,
  mx_cls_hacker_death: 111_164,
  mx_cls_hacker_hit: 97_832,
  mx_cls_hacker_idle: 124_412,
  mx_cls_hacker_jump: 72_180,
  mx_cls_hacker_run: 35_024,
  mx_cls_hacker_runshoot: 35_916,
  mx_cls_hacker_walk: 752_352,
  mx_cls_hacker_walkshoot: 104_912,
  mx_cls_ninja_death: 111_332,
  mx_cls_ninja_hit: 98_000,
  mx_cls_ninja_idle: 124_580,
  mx_cls_ninja_jump: 72_348,
  mx_cls_ninja_run: 35_192,
  mx_cls_ninja_runshoot: 36_084,
  mx_cls_ninja_walk: 545_628,
  mx_cls_ninja_walkshoot: 105_080,
  mx_cls_racer_death: 111_004,
  mx_cls_racer_hit: 97_672,
  mx_cls_racer_idle: 124_252,
  mx_cls_racer_jump: 72_020,
  mx_cls_racer_run: 34_864,
  mx_cls_racer_runshoot: 35_756,
  mx_cls_racer_walk: 773_244,
  mx_cls_racer_walkshoot: 104_752,
  mx_cls_samurai_death: 111_040,
  mx_cls_samurai_hit: 97_704,
  mx_cls_samurai_idle: 124_288,
  mx_cls_samurai_jump: 72_056,
  mx_cls_samurai_run: 34_900,
  mx_cls_samurai_runshoot: 35_792,
  mx_cls_samurai_walk: 1_064_468,
  mx_cls_samurai_walkshoot: 104_788,
  mx_colossus_mech: 884_108,
  mx_crowd_cls_engineer: 170_088,
  mx_crowd_cls_hacker: 148_244,
  mx_crowd_cls_racer: 166_864,
  mx_crowd_cls_samurai: 176_044,
  mx_crowd_dr_goblin: 253_712,
  mx_crowd_dr_golem: 122_516,
  mx_crowd_dr_knight: 239_672,
  mx_crowd_dr_werewolf: 121_080,
  mx_crowd_mon_alien: 157_968,
  mx_crowd_mon_mutant: 166_144,
  mx_crowd_mon_robot_reaper: 178_836,
  mx_crowd_npc_cop: 157_548,
  mx_crowd_npc_medic: 159_100,
  mx_crowd_wz_heavy: 219_172,
  mx_crowd_zmb_brute: 159_580,
  mx_crowd_zmb_cyborg: 143_092,
  mx_crowd_zmb_hazmat: 166_312,
  mx_crowd_zmb_soldier: 134_804,
  mx_ct_banner: 431_220,
  mx_ct_brazier: 467_932,
  mx_ct_conduit: 317_020,
  mx_ct_guard_attack: 109_992,
  mx_ct_guard_death: 110_884,
  mx_ct_guard_hit: 97_552,
  mx_ct_guard_run: 34_744,
  mx_ct_guard_walk: 1_018_052,
  mx_ct_keygate: 655_956,
  mx_ct_pillar: 828_620,
  mx_ct_sentinel_turret: 714_492,
  mx_ct_throne: 444_708,
  mx_cyber_bike: 705_088,
  mx_director_vane_mech: 1_101_592,
  mx_dr_a_darkset: 553_064,
  mx_dr_a_void: 698_188,
  mx_dr_aegis_run: 26_472,
  mx_dr_aegis_walk: 1_516_248,
  mx_dr_bride_run: 26_524,
  mx_dr_bride_walk: 993_660,
  mx_dr_child_walk: 323_544,
  mx_dr_church: 870_660,
  mx_dr_crawler: 575_584,
  mx_dr_dio_mansion: 188_544,
  mx_dr_dio_neon: 918_288,
  mx_dr_dio_ny: 163_920,
  mx_dr_dio_realms: 586_160,
  mx_dr_dio_rift: 981_808,
  mx_dr_dio_towers: 540_348,
  mx_dr_dio_uber: 747_756,
  mx_dr_dragon: 600_804,
  mx_dr_fleshfang: 531_488,
  mx_dr_goblin_run: 26_816,
  mx_dr_goblin_walk: 1_342_880,
  mx_dr_golddragon: 945_208,
  mx_dr_golem_run: 27_024,
  mx_dr_golem_walk: 548_620,
  mx_dr_grin_walk: 881_916,
  mx_dr_holotable: 555_088,
  mx_dr_knight_run: 26_332,
  mx_dr_knight_walk: 1_222_864,
  mx_dr_madre_walk: 525_928,
  mx_dr_mansion: 623_620,
  mx_dr_obsidian_run: 26_336,
  mx_dr_obsidian_walk: 1_239_732,
  mx_dr_reaper_statue: 613_444,
  mx_dr_rocks: 201_620,
  mx_dr_shade_walk: 228_156,
  mx_dr_ship: 558_732,
  mx_dr_sinew: 556_188,
  mx_dr_siren_run: 27_356,
  mx_dr_siren_walk: 1_374_224,
  mx_dr_throne: 860_152,
  mx_dr_twinhead_walk: 599_368,
  mx_dr_w_ar: 176_016,
  mx_dr_w_bow: 212_508,
  mx_dr_w_celestial: 268_280,
  mx_dr_w_cosmic: 219_440,
  mx_dr_w_frost: 260_084,
  mx_dr_w_scythe: 227_240,
  mx_dr_w_shotgun: 202_408,
  mx_dr_w_sniper: 224_684,
  mx_dr_warlord_run: 26_580,
  mx_dr_warlord_walk: 845_024,
  mx_dr_watcher: 452_780,
  mx_dr_werewolf_run: 26_728,
  mx_dr_werewolf_walk: 1_239_800,
  mx_dr_wolfling_run: 26_536,
  mx_dr_wolfling_walk: 890_096,
  mx_dr_wolfwar_run: 26_596,
  mx_dr_wolfwar_walk: 1_269_116,
  mx_dr_wraith: 346_036,
  mx_dr_zmb_bones_run: 27_200,
  mx_dr_zmb_bones_walk: 1_070_376,
  mx_dr_zmb_gut_run: 26_564,
  mx_dr_zmb_gut_walk: 422_944,
  mx_dr_zmb_hood_run: 26_824,
  mx_dr_zmb_hood_walk: 737_076,
  mx_dr_zmb_jeans_run: 26_288,
  mx_dr_zmb_jeans_walk: 558_496,
  mx_dr_zmb_rag_run: 27_112,
  mx_dr_zmb_rag_walk: 601_252,
  mx_dr_zmb_ribs_run: 26_140,
  mx_dr_zmb_ribs_walk: 329_704,
  mx_dr_zmb_shirt_run: 26_680,
  mx_dr_zmb_shirt_walk: 476_652,
  mx_dr_zmb_vest_run: 26_744,
  mx_dr_zmb_vest_walk: 836_012,
  mx_dr_zmb_walker2_walk: 404_284,
  mx_du_bleachers: 1_559_932,
  mx_du_floodlight: 1_016_044,
  mx_du_speaker_stack: 693_200,
  mx_easter_egg: 320_492,
  mx_extra_coin: 262_496,
  mx_fa_all: 1_880_632,
  mx_gr_boot_grav: 462_456,
  mx_gr_boot_runner: 346_380,
  mx_gr_chip_luck: 346_072,
  mx_gr_chip_overclock: 269_112,
  mx_gr_glove_shock: 298_268,
  mx_gr_glove_titan: 449_656,
  mx_gr_helm_oni: 345_408,
  mx_gr_helm_visor: 405_088,
  mx_gr_ice_armor: 938_792,
  mx_gr_ice_boot: 499_252,
  mx_gr_ice_glove: 396_236,
  mx_gr_ice_helm: 452_424,
  mx_hh_armchair: 386_328,
  mx_hh_chandelier: 660_588,
  mx_hh_elevator: 572_184,
  mx_hh_ghost_attack: 110_116,
  mx_hh_ghost_death: 111_008,
  mx_hh_ghost_run: 34_868,
  mx_hh_ghost_stagger: 97_676,
  mx_hh_ghost_walk: 815_904,
  mx_hh_luggage_cart: 610_584,
  mx_hh_piano: 404_648,
  mx_hh_planter: 714_136,
  mx_hh_reception: 626_804,
  mx_holo_tower: 512_372,
  mx_legion_android_death: 111_124,
  mx_legion_android_idle: 124_372,
  mx_legion_android_run: 34_980,
  mx_legion_android_walk: 818_320,
  mx_legion_android_walkshoot: 104_872,
  mx_legion_heavy_run: 34_904,
  mx_legion_heavy_walk: 643_744,
  mx_legion_officer_death: 110_996,
  mx_legion_officer_idle: 124_244,
  mx_legion_officer_run: 34_852,
  mx_legion_officer_walk: 657_508,
  mx_legion_officer_walkshoot: 104_744,
  mx_legion_sniper_death: 110_992,
  mx_legion_sniper_idle: 124_240,
  mx_legion_sniper_run: 34_852,
  mx_legion_sniper_walk: 624_324,
  mx_legion_sniper_walkshoot: 104_740,
  mx_legion_trooper_run: 34_892,
  mx_legion_trooper_walk: 1_131_176,
  mx_map_bio_lab: 695_356,
  mx_map_bunker: 367_464,
  mx_map_citadel: 811_084,
  mx_map_crashed_mech: 741_172,
  mx_map_dropship: 681_860,
  mx_map_gate: 823_500,
  mx_map_hollow_hotel: 656_780,
  mx_map_radio_tower: 878_020,
  mx_map_ruins: 462_120,
  mx_map_shield_gen: 750_932,
  mx_map_turret: 590_520,
  mx_map_watchtower: 859_600,
  mx_mon_alien_attack: 110_096,
  mx_mon_alien_death: 110_988,
  mx_mon_alien_run: 34_848,
  mx_mon_alien_scream: 92_348,
  mx_mon_alien_stagger: 146_356,
  mx_mon_alien_walk: 563_760,
  mx_mon_cyborg_hound_rider_attack: 110_132,
  mx_mon_cyborg_hound_rider_death: 111_024,
  mx_mon_cyborg_hound_rider_run: 34_884,
  mx_mon_cyborg_hound_rider_scream: 92_384,
  mx_mon_cyborg_hound_rider_stagger: 146_392,
  mx_mon_cyborg_hound_rider_walk: 898_128,
  mx_mon_mutant_attack: 110_144,
  mx_mon_mutant_death: 111_036,
  mx_mon_mutant_run: 34_896,
  mx_mon_mutant_scream: 92_396,
  mx_mon_mutant_stagger: 146_404,
  mx_mon_mutant_walk: 563_004,
  mx_mon_psycho_attack: 110_124,
  mx_mon_psycho_death: 111_016,
  mx_mon_psycho_run: 34_876,
  mx_mon_psycho_scream: 92_376,
  mx_mon_psycho_stagger: 146_384,
  mx_mon_psycho_walk: 554_416,
  mx_mon_robot_reaper_attack: 110_248,
  mx_mon_robot_reaper_death: 111_140,
  mx_mon_robot_reaper_run: 35_000,
  mx_mon_robot_reaper_scream: 92_500,
  mx_mon_robot_reaper_stagger: 146_508,
  mx_mon_robot_reaper_walk: 1_050_268,
  mx_noodle_stall: 637_428,
  mx_nova_bomb: 202_544,
  mx_npc_android_maid_run: 34_952,
  mx_npc_android_maid_walk: 698_552,
  mx_npc_bartender_run: 34_744,
  mx_npc_bartender_walk: 481_768,
  mx_npc_child_run: 34_984,
  mx_npc_child_walk: 543_104,
  mx_npc_cop_run: 34_884,
  mx_npc_cop_walk: 705_992,
  mx_npc_dj_run: 35_200,
  mx_npc_dj_walk: 606_408,
  mx_npc_echo_run: 34_776,
  mx_npc_echo_walk: 485_560,
  mx_npc_gangster_run: 35_172,
  mx_npc_gangster_walk: 459_392,
  mx_npc_ghost_run: 34_884,
  mx_npc_ghost_walk: 528_348,
  mx_npc_medic_run: 34_900,
  mx_npc_medic_walk: 617_948,
  mx_npc_monk_run: 34_908,
  mx_npc_monk_walk: 574_760,
  mx_npc_rook_run: 34_712,
  mx_npc_rook_walk: 833_940,
  mx_npc_vex_run: 34_980,
  mx_npc_vex_walk: 820_336,
  mx_part_armor: 307_316,
  mx_part_core: 320_284,
  mx_part_engine: 325_876,
  mx_part_weapon: 241_776,
  mx_police_hovercar: 332_440,
  mx_pr_altar: 1_052_804,
  mx_pr_angel_statue: 992_452,
  mx_pr_bell_tower: 1_157_548,
  mx_pr_broken_column: 1_010_124,
  mx_pr_broken_pew: 486_272,
  mx_pr_candle_stand: 1_035_772,
  mx_pr_coffin: 586_572,
  mx_pr_dead_tree: 843_248,
  mx_pr_gravestone: 358_668,
  mx_pr_hanging_cage: 812_144,
  mx_pr_iron_fence: 1_193_276,
  mx_pr_neon_cross: 645_064,
  mx_pr_skull_candles: 1_172_284,
  mx_pr_stone_cross: 605_068,
  mx_prop_neon_arch: 357_076,
  mx_prop_trash_pile: 763_320,
  mx_sg_barricade: 623_324,
  mx_sg_cannon: 768_228,
  mx_sg_core: 1_064_164,
  mx_sg_gate: 1_683_944,
  mx_sg_generator: 824_752,
  mx_sg_icerock: 203_668,
  mx_sg_keep: 4_243_052,
  mx_sg_pine: 744_112,
  mx_sg_tent: 731_408,
  mx_sg_tower: 1_030_204,
  mx_sg_wall: 1_038_336,
  mx_supply_crate: 239_020,
  mx_tr_crystal_rock: 543_192,
  mx_tr_gothic_bridge: 1_814_024,
  mx_tr_gothic_ledge: 1_781_588,
  mx_tr_scifi_catwalk: 1_607_504,
  mx_tr_scifi_wall: 1_332_120,
  mx_vane_human_death: 111_096,
  mx_vane_human_hit: 97_764,
  mx_vane_human_idle: 124_344,
  mx_vane_human_run: 34_956,
  mx_vane_human_runshoot: 35_848,
  mx_vane_human_talk: 123_460,
  mx_vane_human_walk: 506_868,
  mx_vane_human_walkshoot: 104_844,
  mx_veh_ambulance: 453_976,
  mx_veh_buggy: 942_392,
  mx_veh_bus: 626_496,
  mx_veh_garbage_truck: 820_620,
  mx_veh_hoverbike: 821_768,
  mx_veh_hovertruck: 792_884,
  mx_veh_limo: 612_316,
  mx_veh_police_bike: 865_568,
  mx_veh_scooter: 724_056,
  mx_veh_tank: 547_944,
  mx_velocity_car: 609_248,
  mx_vending_kiosk: 495_724,
  mx_w_ice_blade: 335_208,
  mx_w_katana: 234_776,
  mx_w_pistol: 462_848,
  mx_wz_ammo: 745_720,
  mx_wz_artillery: 772_856,
  mx_wz_bridge: 780_816,
  mx_wz_comms: 670_340,
  mx_wz_crystal: 769_536,
  mx_wz_heavy_death: 111_040,
  mx_wz_heavy_hit: 97_704,
  mx_wz_heavy_run: 34_896,
  mx_wz_heavy_walk: 1_130_984,
  mx_wz_heavy_walkshoot: 104_788,
  mx_wz_hovertank: 722_996,
  mx_wz_sandbags: 605_816,
  mx_zmb_brute_attack: 109_864,
  mx_zmb_brute_death: 110_756,
  mx_zmb_brute_run: 34_616,
  mx_zmb_brute_scream: 92_116,
  mx_zmb_brute_stagger: 146_124,
  mx_zmb_brute_walk: 620_672,
  mx_zmb_cyborg_attack: 110_260,
  mx_zmb_cyborg_death: 111_152,
  mx_zmb_cyborg_run: 35_012,
  mx_zmb_cyborg_scream: 92_468,
  mx_zmb_cyborg_stagger: 146_520,
  mx_zmb_cyborg_walk: 698_732,
  mx_zmb_hazmat_attack: 110_216,
  mx_zmb_hazmat_death: 111_108,
  mx_zmb_hazmat_run: 34_968,
  mx_zmb_hazmat_scream: 92_468,
  mx_zmb_hazmat_stagger: 146_476,
  mx_zmb_hazmat_walk: 680_436,
  mx_zmb_nurse_attack: 110_200,
  mx_zmb_nurse_death: 111_092,
  mx_zmb_nurse_run: 34_952,
  mx_zmb_nurse_scream: 92_448,
  mx_zmb_nurse_stagger: 146_460,
  mx_zmb_nurse_walk: 529_788,
  mx_zmb_runner_attack: 109_904,
  mx_zmb_runner_death: 110_796,
  mx_zmb_runner_run: 34_656,
  mx_zmb_runner_scream: 92_152,
  mx_zmb_runner_stagger: 146_164,
  mx_zmb_runner_walk: 837_508,
  mx_zmb_soldier_attack: 110_436,
  mx_zmb_soldier_death: 111_328,
  mx_zmb_soldier_run: 35_184,
  mx_zmb_soldier_scream: 92_684,
  mx_zmb_soldier_stagger: 146_696,
  mx_zmb_soldier_walk: 632_848,
  mx_zmb_walker_attack: 110_028,
  mx_zmb_walker_death: 110_920,
  mx_zmb_walker_run: 34_780,
  mx_zmb_walker_scream: 92_280,
  mx_zmb_walker_stagger: 146_288,
  mx_zmb_walker_walk: 908_648,
} as const;
export type ExtraModel = keyof typeof EXTRA_SIZES;

/** Tiến độ tải nền, cho HUD hiện "Đang tải thêm chi tiết…" */
export const extraProgress = { loaded: 0, total: 0, done: 0, files: 0 };

export function extraModel(name: ExtraModel): Promise<GLTF> {
  let p = extraCache.get(name);
  if (!p) {
    extraProgress.total += EXTRA_SIZES[name];
    extraProgress.files++;
    p = fetch(`models/${name}.glb${MODEL_SUFFIX}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Không tải được ${name} (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        extraProgress.loaded += EXTRA_SIZES[name];
        extraProgress.done++;
        return makeLoader().parseAsync(buf, "");
      });
    extraCache.set(name, p);
  }
  return p;
}

export const models = {
  drone: parseGlb(droneUrl),
  blaster: parseGlb(blasterUrl),
  repeater: parseGlb(repeaterUrl),
  /** Nhân vật người chơi: "Soldier" (Mixamo) */
  soldier: fetchGlb("soldier.glb", 977_000),
  /** Android cho NPC và hologram GHOST_0: "Xbot" (Mixamo) */
  xbot: fetchGlb("xbot.glb", 1_346_000),
  /** Xe "Car Concept" (Eric Chadwick, CC-BY 4.0), đã bỏ nội thất và logo */
  car: fetchGlb("car.glb", 1_523_000),
  vault: fetchGlb("vault.glb", 1_828_000),
  /** Bộ đạo cụ Polygonal Mind + KayKit (CC0): mỗi model là một scene, tên gốc trùng tên model */
  kit: fetchGlb("kit.glb", 4_401_000),
};

// ---------------------------------------------------------------------------
// Âm thanh: WebAudio, chỉ bật sau tương tác đầu tiên của người chơi (chính sách autoplay).

type SfxName = "blaster" | "repeater" | "enemyAttack" | "enemyDestroy" | "enemyHurt";
/** Âm báo tổng hợp bằng oscillator, không cần file: nhặt đồ, biến hình, đồng xu, vút chém, đòn kết liễu, còi báo chiêu */
type SynthName = "pickup" | "transform" | "coin" | "swing" | "crit" | "warn";

const SFX_SOURCES: Record<SfxName, string> = {
  blaster: sfxBlaster,
  repeater: sfxRepeater,
  enemyAttack: sfxEnemyAttack,
  enemyDestroy: sfxEnemyDestroy,
  enemyHurt: sfxEnemyHurt,
};

let audio: AudioContext | null = null;
const buffers = new Map<SfxName, AudioBuffer>();

function ensureAudio() {
  if (audio) return audio;
  try {
    audio = new AudioContext();
  } catch {
    return null;
  }
  for (const [name, url] of Object.entries(SFX_SOURCES) as [SfxName, string][]) {
    audio
      .decodeAudioData(dataUrlToBuffer(url))
      .then((b) => buffers.set(name, b))
      .catch(() => {
        // Trình duyệt không giải mã được Ogg (Safari cũ): chơi im lặng.
      });
  }
  return audio;
}

if (typeof window !== "undefined") {
  const unlock = () => {
    ensureAudio()?.resume();
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

/** Phát hiệu ứng âm thanh; `volume` giảm dần theo khoảng cách do nơi gọi tự tính. */
export function playSfx(name: SfxName | SynthName, volume = 1) {
  if (name === "pickup" || name === "transform" || name === "coin" || name === "swing" || name === "crit" || name === "warn") return playSynth(name, volume);
  const ctx = audio;
  const buffer = buffers.get(name);
  if (!ctx || !buffer || volume <= 0.01) return;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = Math.min(1, volume) * 0.5;
  src.buffer = buffer;
  src.playbackRate.value = 0.94 + Math.random() * 0.12;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

/** Chuỗi nốt ngắn: "pickup" là tiếng chuông đi lên, "transform" là tiếng máy rít trầm dần lên cao */
function playSynth(name: SynthName, volume: number) {
  const ctx = audio;
  if (!ctx || volume <= 0.01) return;
  const t0 = ctx.currentTime;
  if (name === "swing" || name === "crit") return playSweep(ctx, t0, name, volume);
  if (name === "coin" || name === "warn") {
    // Xu: hai nốt cao leng keng; còi: hai tiếng bíp trầm báo chiêu
    const seq = name === "coin" ? [1976 + Math.random() * 120, 2637] : [440, 330, 440, 330];
    const step = name === "coin" ? 0.05 : 0.11;
    seq.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === "coin" ? "square" : "sawtooth";
      const start = t0 + i * step;
      osc.frequency.setValueAtTime(f, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(1, volume) * (name === "coin" ? 0.05 : 0.06), start + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + step * 1.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + step * 2);
    });
    return;
  }
  const notes = name === "pickup" ? [880, 1175, 1568] : [110, 165, 220, 330, 440];
  const step = name === "pickup" ? 0.07 : 0.22;
  notes.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = name === "pickup" ? "triangle" : "sawtooth";
    osc.frequency.setValueAtTime(f, t0 + i * step);
    const start = t0 + i * step;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(Math.min(1, volume) * (name === "pickup" ? 0.18 : 0.08), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + step * 2.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + step * 2.4);
  });
}

/** Tiếng vút (chém) và tiếng nện trầm (đòn kết liễu): nhiễu trắng lọc dải quét tần số */
function playSweep(ctx: AudioContext, t0: number, name: "swing" | "crit", volume: number) {
  const len = name === "swing" ? 0.16 : 0.32;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = name === "swing" ? 1.4 : 0.8;
  filter.frequency.setValueAtTime(name === "swing" ? 900 : 300, t0);
  filter.frequency.exponentialRampToValueAtTime(name === "swing" ? 3800 : 80, t0 + len);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(Math.min(1, volume) * (name === "swing" ? 0.22 : 0.5), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + len);
  if (name === "crit") {
    const osc = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.25);
    g2.gain.setValueAtTime(Math.min(1, volume) * 0.5, t0);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(g2).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  }
}
