import * as THREE from "three";
import { NEON_COLORS, mulberry32 } from "./config";

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d")!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Cửa sổ toà nhà: phần lớn tối, một số sáng màu ấm/lạnh. Dùng làm emissiveMap. */
export function makeWindowTexture(seed: number) {
  const rand = mulberry32(seed);
  const tex = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 128, 256);
    const cols = 8;
    const rows = 16;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const r = rand();
        if (r > 0.42) continue;
        const warm = r < 0.12;
        const hue = warm ? 35 + rand() * 15 : 185 + rand() * 80;
        const light = 35 + rand() * 35;
        ctx.fillStyle = `hsl(${hue} 90% ${light}%)`;
        ctx.fillRect(x * 16 + 3, y * 16 + 4, 10, 9);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/** Mặt đường nhựa: vạch kẻ đứt đoạn ở giữa, viền vàng hai bên. */
export function makeRoadTexture() {
  const tex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#16131f";
    ctx.fillRect(0, 0, 256, 256);
    // nhiễu nhẹ cho mặt nhựa
    const rand = mulberry32(7);
    for (let i = 0; i < 2500; i++) {
      const v = 20 + rand() * 18;
      ctx.fillStyle = `rgb(${v},${v - 2},${v + 8})`;
      ctx.fillRect(rand() * 256, rand() * 256, 2, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function makeLaneTexture() {
  const tex = canvasTexture(64, 256, (ctx) => {
    ctx.clearRect(0, 0, 64, 256);
    ctx.fillStyle = "#e8e2c8";
    ctx.fillRect(26, 0, 12, 140);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const SIGN_WORDS = [
  "CYBERHOOD",
  "NEON BAZAAR",
  "RIPPERDOC",
  "OMNI-DYNE",
  "$CRED",
  "JACK IN",
  "GHOST_0",
  "NOODLES 24H",
  "CHROME ARENA",
  "DATA HAVEN",
  "UNDERGRID",
  "ROOT ACCESS",
];

export const SIGN_COUNT = SIGN_WORDS.length;

/** Biển hiệu neon dọc hoặc ngang, chữ phát sáng có viền glow. */
export function makeSignTexture(index: number, vertical: boolean) {
  const word = SIGN_WORDS[index % SIGN_WORDS.length];
  const color = NEON_COLORS[index % NEON_COLORS.length];
  const w = vertical ? 128 : 512;
  const h = vertical ? 512 : 128;
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = "#07040d";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (vertical) {
      const letters = word.replace(/ /g, "").split("");
      const size = Math.min(64, (h - 40) / letters.length);
      ctx.font = `700 ${size}px "Chakra Petch", ui-monospace, monospace`;
      letters.forEach((ch, i) => {
        ctx.fillText(ch, w / 2, 24 + size * (i + 0.5));
      });
    } else {
      ctx.font = `700 ${Math.min(72, 900 / word.length)}px "Chakra Petch", ui-monospace, monospace`;
      ctx.fillText(word, w / 2, h / 2 + 4);
    }
  });
}
