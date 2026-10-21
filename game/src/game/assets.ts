import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
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
  mx_archivist_walk: 1_383_304,
  mx_battery_cell: 488_560,
  mx_bld_apartment: 1_075_820,
  mx_bld_arcade: 1_092_360,
  mx_bld_capsule_hotel: 1_198_744,
  mx_bld_clinic: 1_218_956,
  mx_bld_factory: 1_087_196,
  mx_bld_hotel: 1_192_868,
  mx_bld_megacorp: 1_347_248,
  mx_bld_nightclub: 1_171_852,
  mx_bld_noodle_bar: 1_892_984,
  mx_bld_pagoda: 1_352_696,
  mx_bld_police_station: 1_544_808,
  mx_bld_shoprow: 1_375_440,
  mx_bld_skyscraper: 1_113_792,
  mx_bld_tower_round: 1_547_144,
  mx_car_armored: 1_901_908,
  mx_car_muscle: 1_706_680,
  mx_car_police: 1_296_656,
  mx_car_sedan: 1_245_520,
  mx_car_sports: 1_208_264,
  mx_car_taxi: 1_213_088,
  mx_car_truck: 1_598_224,
  mx_car_van: 1_383_352,
  mx_chrono_cube: 587_164,
  mx_civ_biker_idle: 124_228,
  mx_civ_biker_run: 34_836,
  mx_civ_biker_walk: 2_528_312,
  mx_civ_biker_wave: 159_612,
  mx_civ_courier_idle: 124_272,
  mx_civ_courier_run: 34_880,
  mx_civ_courier_walk: 1_735_676,
  mx_civ_courier_wave: 159_656,
  mx_civ_dancer_dance: 207_512,
  mx_civ_dancer_idle: 124_380,
  mx_civ_dancer_run: 34_992,
  mx_civ_dancer_walk: 2_718_484,
  mx_civ_dancer_wave: 159_768,
  mx_civ_elder_idle: 124_380,
  mx_civ_elder_run: 34_992,
  mx_civ_elder_walk: 1_726_536,
  mx_civ_elder_wave: 159_768,
  mx_civ_punk_run: 34_860,
  mx_civ_punk_walk: 2_056_408,
  mx_civ_salaryman_run: 35_056,
  mx_civ_salaryman_walk: 1_319_724,
  mx_civ_student_idle: 124_284,
  mx_civ_student_run: 34_896,
  mx_civ_student_walk: 1_905_772,
  mx_civ_student_wave: 159_668,
  mx_civ_vendor_run: 34_896,
  mx_civ_vendor_walk: 1_471_968,
  mx_civ_worker_idle: 124_296,
  mx_civ_worker_run: 34_908,
  mx_civ_worker_walk: 2_002_864,
  mx_civ_worker_wave: 159_684,
  mx_cls_engineer_death: 111_040,
  mx_cls_engineer_hit: 97_708,
  mx_cls_engineer_idle: 124_288,
  mx_cls_engineer_jump: 72_056,
  mx_cls_engineer_run: 34_900,
  mx_cls_engineer_runshoot: 35_792,
  mx_cls_engineer_walk: 2_248_388,
  mx_cls_engineer_walkshoot: 104_788,
  mx_cls_hacker_death: 111_164,
  mx_cls_hacker_hit: 97_832,
  mx_cls_hacker_idle: 124_412,
  mx_cls_hacker_jump: 72_180,
  mx_cls_hacker_run: 35_024,
  mx_cls_hacker_runshoot: 35_916,
  mx_cls_hacker_walk: 1_680_648,
  mx_cls_hacker_walkshoot: 104_912,
  mx_cls_ninja_death: 111_332,
  mx_cls_ninja_hit: 98_000,
  mx_cls_ninja_idle: 124_580,
  mx_cls_ninja_jump: 72_348,
  mx_cls_ninja_run: 35_192,
  mx_cls_ninja_runshoot: 36_084,
  mx_cls_ninja_walk: 1_375_912,
  mx_cls_ninja_walkshoot: 105_080,
  mx_cls_racer_death: 111_004,
  mx_cls_racer_hit: 97_672,
  mx_cls_racer_idle: 124_252,
  mx_cls_racer_jump: 72_020,
  mx_cls_racer_run: 34_864,
  mx_cls_racer_runshoot: 35_756,
  mx_cls_racer_walk: 1_719_984,
  mx_cls_racer_walkshoot: 104_752,
  mx_cls_samurai_death: 111_040,
  mx_cls_samurai_hit: 97_704,
  mx_cls_samurai_idle: 124_288,
  mx_cls_samurai_jump: 72_056,
  mx_cls_samurai_run: 34_900,
  mx_cls_samurai_runshoot: 35_792,
  mx_cls_samurai_walk: 2_373_900,
  mx_cls_samurai_walkshoot: 104_788,
  mx_colossus_mech: 2_257_396,
  mx_cyber_bike: 1_825_488,
  mx_director_vane_mech: 2_983_800,
  mx_easter_egg: 573_468,
  mx_extra_coin: 511_920,
  mx_hh_armchair: 1_354_840,
  mx_hh_chandelier: 2_059_044,
  mx_hh_elevator: 1_882_620,
  mx_hh_ghost_run: 34_868,
  mx_hh_ghost_walk: 2_414_272,
  mx_hh_luggage_cart: 1_704_552,
  mx_hh_piano: 1_544_080,
  mx_hh_planter: 1_903_768,
  mx_hh_reception: 2_045_628,
  mx_holo_tower: 1_396_412,
  mx_legion_android_death: 111_124,
  mx_legion_android_idle: 124_372,
  mx_legion_android_run: 34_980,
  mx_legion_android_walk: 2_343_344,
  mx_legion_android_walkshoot: 104_872,
  mx_legion_heavy_run: 34_904,
  mx_legion_heavy_walk: 1_789_296,
  mx_legion_officer_death: 110_996,
  mx_legion_officer_idle: 124_244,
  mx_legion_officer_run: 34_852,
  mx_legion_officer_walk: 1_788_072,
  mx_legion_officer_walkshoot: 104_744,
  mx_legion_sniper_death: 110_992,
  mx_legion_sniper_idle: 124_240,
  mx_legion_sniper_run: 34_852,
  mx_legion_sniper_walk: 1_711_216,
  mx_legion_sniper_walkshoot: 104_740,
  mx_legion_trooper_run: 34_892,
  mx_legion_trooper_walk: 3_216_904,
  mx_map_bio_lab: 1_779_756,
  mx_map_bunker: 1_021_652,
  mx_map_citadel: 2_060_640,
  mx_map_crashed_mech: 1_892_372,
  mx_map_dropship: 1_766_976,
  mx_map_gate: 2_178_296,
  mx_map_hollow_hotel: 1_747_592,
  mx_map_radio_tower: 2_327_708,
  mx_map_ruins: 1_244_664,
  mx_map_shield_gen: 1_995_668,
  mx_map_turret: 1_488_024,
  mx_map_watchtower: 2_294_132,
  mx_mon_alien_attack: 110_096,
  mx_mon_alien_death: 110_988,
  mx_mon_alien_run: 34_848,
  mx_mon_alien_scream: 92_348,
  mx_mon_alien_stagger: 146_356,
  mx_mon_alien_walk: 1_621_508,
  mx_mon_cyborg_hound_rider_attack: 110_132,
  mx_mon_cyborg_hound_rider_death: 111_024,
  mx_mon_cyborg_hound_rider_run: 34_884,
  mx_mon_cyborg_hound_rider_scream: 92_384,
  mx_mon_cyborg_hound_rider_stagger: 146_392,
  mx_mon_cyborg_hound_rider_walk: 2_541_840,
  mx_mon_mutant_attack: 110_144,
  mx_mon_mutant_death: 111_036,
  mx_mon_mutant_run: 34_896,
  mx_mon_mutant_scream: 92_396,
  mx_mon_mutant_stagger: 146_404,
  mx_mon_mutant_walk: 1_708_744,
  mx_mon_psycho_attack: 110_124,
  mx_mon_psycho_death: 111_016,
  mx_mon_psycho_run: 34_876,
  mx_mon_psycho_scream: 92_376,
  mx_mon_psycho_stagger: 146_384,
  mx_mon_psycho_walk: 1_611_520,
  mx_mon_robot_reaper_attack: 110_248,
  mx_mon_robot_reaper_death: 111_140,
  mx_mon_robot_reaper_run: 35_000,
  mx_mon_robot_reaper_scream: 92_500,
  mx_mon_robot_reaper_stagger: 146_508,
  mx_mon_robot_reaper_walk: 3_056_560,
  mx_noodle_stall: 1_688_836,
  mx_nova_bomb: 452_984,
  mx_npc_android_maid_run: 34_952,
  mx_npc_android_maid_walk: 1_992_268,
  mx_npc_bartender_run: 34_744,
  mx_npc_bartender_walk: 1_378_352,
  mx_npc_child_run: 34_984,
  mx_npc_child_walk: 1_528_564,
  mx_npc_cop_run: 34_884,
  mx_npc_cop_walk: 1_969_264,
  mx_npc_dj_run: 35_200,
  mx_npc_dj_walk: 1_767_940,
  mx_npc_echo_run: 34_776,
  mx_npc_echo_walk: 1_357_988,
  mx_npc_gangster_run: 35_172,
  mx_npc_gangster_walk: 1_303_612,
  mx_npc_ghost_run: 34_884,
  mx_npc_ghost_walk: 1_476_952,
  mx_npc_medic_run: 34_900,
  mx_npc_medic_walk: 1_726_484,
  mx_npc_monk_run: 34_908,
  mx_npc_monk_walk: 1_574_860,
  mx_npc_rook_run: 34_712,
  mx_npc_rook_walk: 2_414_100,
  mx_npc_vex_run: 34_980,
  mx_npc_vex_walk: 2_361_064,
  mx_part_armor: 676_720,
  mx_part_core: 715_024,
  mx_part_engine: 711_996,
  mx_part_weapon: 581_120,
  mx_police_hovercar: 909_324,
  mx_prop_neon_arch: 1_028_364,
  mx_prop_trash_pile: 1_902_720,
  mx_supply_crate: 577_112,
  mx_vane_human_death: 111_096,
  mx_vane_human_hit: 97_764,
  mx_vane_human_idle: 124_344,
  mx_vane_human_run: 34_956,
  mx_vane_human_runshoot: 35_848,
  mx_vane_human_talk: 123_460,
  mx_vane_human_walk: 1_394_980,
  mx_vane_human_walkshoot: 104_844,
  mx_veh_ambulance: 1_195_032,
  mx_veh_buggy: 2_403_176,
  mx_veh_bus: 1_612_268,
  mx_veh_garbage_truck: 2_120_428,
  mx_veh_hoverbike: 2_078_508,
  mx_veh_hovertruck: 2_075_084,
  mx_veh_limo: 1_563_916,
  mx_veh_police_bike: 2_203_672,
  mx_veh_scooter: 1_810_664,
  mx_veh_tank: 1_422_280,
  mx_velocity_car: 1_539_728,
  mx_vending_kiosk: 1_288_768,
  mx_zmb_brute_attack: 109_864,
  mx_zmb_brute_death: 110_756,
  mx_zmb_brute_run: 34_616,
  mx_zmb_brute_scream: 92_116,
  mx_zmb_brute_stagger: 146_124,
  mx_zmb_brute_walk: 1_769_284,
  mx_zmb_cyborg_attack: 110_260,
  mx_zmb_cyborg_death: 111_152,
  mx_zmb_cyborg_run: 35_012,
  mx_zmb_cyborg_scream: 92_468,
  mx_zmb_cyborg_stagger: 146_520,
  mx_zmb_cyborg_walk: 2_013_720,
  mx_zmb_hazmat_attack: 110_216,
  mx_zmb_hazmat_death: 111_108,
  mx_zmb_hazmat_run: 34_968,
  mx_zmb_hazmat_scream: 92_468,
  mx_zmb_hazmat_stagger: 146_476,
  mx_zmb_hazmat_walk: 1_924_600,
  mx_zmb_nurse_attack: 110_200,
  mx_zmb_nurse_death: 111_092,
  mx_zmb_nurse_run: 34_952,
  mx_zmb_nurse_scream: 92_448,
  mx_zmb_nurse_stagger: 146_460,
  mx_zmb_nurse_walk: 1_529_588,
  mx_zmb_runner_attack: 109_904,
  mx_zmb_runner_death: 110_796,
  mx_zmb_runner_run: 34_656,
  mx_zmb_runner_scream: 92_152,
  mx_zmb_runner_stagger: 146_164,
  mx_zmb_runner_walk: 2_454_356,
  mx_zmb_soldier_attack: 110_436,
  mx_zmb_soldier_death: 111_328,
  mx_zmb_soldier_run: 35_184,
  mx_zmb_soldier_scream: 92_684,
  mx_zmb_soldier_stagger: 146_696,
  mx_zmb_soldier_walk: 1_770_416,
  mx_zmb_walker_attack: 110_028,
  mx_zmb_walker_death: 110_920,
  mx_zmb_walker_run: 34_780,
  mx_zmb_walker_scream: 92_280,
  mx_zmb_walker_stagger: 146_288,
  mx_zmb_walker_walk: 2_593_368,
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
/** Âm báo tổng hợp bằng oscillator, không cần file: nhặt đồ, biến hình */
type SynthName = "pickup" | "transform";

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
  if (name === "pickup" || name === "transform") return playSynth(name, volume);
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
