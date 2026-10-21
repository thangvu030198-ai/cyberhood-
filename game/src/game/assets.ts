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
export function playSfx(name: SfxName, volume = 1) {
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
