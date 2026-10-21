import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import robotUrl from "../assets/robot.glb?inline";
import droneUrl from "../assets/kenney/enemy-flying.glb?inline";
import blasterUrl from "../assets/kenney/blaster.glb?inline";
import repeaterUrl from "../assets/kenney/blaster-repeater.glb?inline";
import colormapUrl from "../assets/kenney/colormap.png?inline";
import sfxBlaster from "../assets/sounds/blaster.ogg?inline";
import sfxRepeater from "../assets/sounds/blaster_repeater.ogg?inline";
import sfxEnemyAttack from "../assets/sounds/enemy_attack.ogg?inline";
import sfxEnemyDestroy from "../assets/sounds/enemy_destroy.ogg?inline";
import sfxEnemyHurt from "../assets/sounds/enemy_hurt.ogg?inline";

// Mọi asset được nhúng sẵn trong bundle (data URI) và parse trực tiếp, không fetch file ngoài,
// để game chạy được cả trong khung artifact chặn mạng.

function dataUrlToBuffer(url: string) {
  const base64 = url.slice(url.indexOf(",") + 1);
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer;
}

function parseGlb(url: string): Promise<GLTF> {
  const manager = new THREE.LoadingManager();
  // Model Kenney trỏ tới "Textures/colormap.png" bên ngoài: chuyển sang bản nhúng.
  manager.setURLModifier((u) => (u.endsWith("colormap.png") ? colormapUrl : u));
  const loader = new GLTFLoader(manager);
  // Nạp ảnh qua thẻ <img> thay vì fetch, vì CSP của artifact có thể chặn fetch data URI.
  loader.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(manager);
    return { name: "cyberhood_img_textures" };
  });
  return loader.parseAsync(dataUrlToBuffer(url), "");
}

export const models = {
  robot: parseGlb(robotUrl),
  drone: parseGlb(droneUrl),
  blaster: parseGlb(blasterUrl),
  repeater: parseGlb(repeaterUrl),
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
