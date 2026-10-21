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
  /** Xe: Kenney Car Kit (CC0) + Dodge Challenger 1970 của kryptonmedia (CC0) */
  cars: 9_209_000,
  /** Đạo cụ phố: Polygonal Mind, KayKit, Khronos/Microsoft, Michael Pavlovic (CC0) và Traffic Cone của hinndia (CC-BY 4.0) */
  street: 5_372_000,
  helicopter: 2_344_000,
  bigufo: 1_462_000,
  platform: 1_412_000,
  // Model gốc tạo bằng Meshy (text-to-3d, tài khoản của chủ dự án), xem docs/MESHY_ASSETS.md
  mx_legion_trooper_walk: 3_890_000,
  mx_legion_trooper_run: 35_000,
  mx_archivist_walk: 2_386_000,
  mx_archivist_run: 35_000,
  mx_director_vane_mech: 3_259_000,
  mx_colossus_mech: 3_017_000,
  mx_velocity_car: 2_054_000,
  mx_supply_crate: 577_000,
  mx_battery_cell: 489_000,
  mx_extra_coin: 512_000,
  mx_chrono_cube: 587_000,
  mx_nova_bomb: 453_000,
  mx_easter_egg: 573_000,
  mx_part_core: 715_000,
  mx_part_armor: 677_000,
  mx_part_weapon: 581_000,
  mx_part_engine: 712_000,
  mx_npc_rook_walk: 3_418_224,
  mx_npc_rook_run: 34_712,
  mx_npc_vex_walk: 3_406_668,
  mx_npc_vex_run: 34_980,
  mx_npc_echo_walk: 2_378_672,
  mx_npc_echo_run: 34_776,
  mx_npc_ghost_walk: 2_564_168,
  mx_npc_ghost_run: 34_884,
  mx_civ_vendor_walk: 2_399_984,
  mx_civ_vendor_run: 34_896,
  mx_civ_punk_walk: 2_894_960,
  mx_civ_punk_run: 34_860,
  mx_civ_salaryman_walk: 2_177_588,
  mx_civ_salaryman_run: 35_056,
  mx_legion_heavy_walk: 2_967_992,
  mx_legion_heavy_run: 34_904,
  mx_police_hovercar: 1_638_564,
  mx_cyber_bike: 2_167_204,
  mx_noodle_stall: 2_221_012,
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
