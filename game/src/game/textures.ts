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

/**
 * Mặt tiền cao ốc: một ô texture phủ 12m x 24m (8 cột cửa sổ 1,5m, 8 tầng 3m).
 * `map` là tường và kính tối, `emissive` chỉ chứa các ô cửa đang sáng đèn.
 */
export function makeFacadeTextures(seed: number) {
  const rand = mulberry32(seed);
  const S = 512;
  const cols = 8;
  const rows = 8;
  const cw = S / cols;
  const ch = S / rows;
  const lit: [number, number, string][] = [];
  const map = canvasTexture(S, S, (ctx) => {
    ctx.fillStyle = "#0b0a12";
    ctx.fillRect(0, 0, S, S);
    for (let y = 0; y < rows; y++) {
      // Dải sàn giữa các tầng
      ctx.fillStyle = "#16141f";
      ctx.fillRect(0, y * ch, S, 6);
      for (let x = 0; x < cols; x++) {
        const wx = x * cw + 6;
        const wy = y * ch + 12;
        const ww = cw - 12;
        const wh = ch - 20;
        // Kính tắt đèn: xanh đen, sáng dần lên phía trên ô như phản chiếu trời
        const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, "#1d2a44");
        g.addColorStop(1, "#0a0f1c");
        ctx.fillStyle = g;
        ctx.fillRect(wx, wy, ww, wh);
        // Khung và thanh chia ô
        ctx.fillStyle = "#24222e";
        ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        ctx.fillRect(wx, wy + wh * 0.35, ww, 2);
        const r = rand();
        if (r < 0.3) {
          const tone = r < 0.17 ? `hsl(${32 + rand() * 14} 85% ${62 + rand() * 18}%)` : `hsl(${180 + rand() * 40} 70% ${55 + rand() * 20}%)`;
          lit.push([x, y, tone]);
        }
      }
    }
  });
  const emissive = canvasTexture(S, S, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    for (const [x, y, tone] of lit) {
      const wx = x * cw + 6;
      const wy = y * ch + 12;
      const ww = cw - 12;
      const wh = ch - 20;
      ctx.fillStyle = tone;
      ctx.fillRect(wx, wy, ww, wh);
      // Rèm che một phần, bóng người/đồ đạc tối
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      if (rand() < 0.5) ctx.fillRect(wx, wy, ww, wh * (0.2 + rand() * 0.4));
      ctx.fillStyle = "#000";
      ctx.fillRect(wx + ww / 2 - 1, wy, 2, wh);
    }
  });
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
  }
  return { map, emissive };
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

/** Bảng chữ phát sáng hai dòng: tiêu đề và dòng phụ (biển cửa, màn hình terminal, bảng tên NPC) */
export function makeLabelTexture(title: string, subtitle: string, color: string, marker?: string) {
  return canvasTexture(512, 160, (ctx) => {
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = "rgba(7, 4, 13, 0.82)";
    ctx.fillRect(0, 20, 512, 120);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeRect(6, 24, 500, 112);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 46px "Chakra Petch", ui-monospace, monospace`;
    ctx.fillText(title, 256, 76);
    ctx.fillStyle = color;
    ctx.font = `600 22px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(subtitle, 256, 116);
    if (marker) {
      ctx.fillStyle = "#ffb000";
      ctx.shadowColor = "#ffb000";
      ctx.font = `700 40px "Chakra Petch", ui-monospace, monospace`;
      ctx.fillText(marker, 470, 74);
    }
  });
}

/** Ảnh quảng cáo hologram: chữ lớn, dòng phụ, khung và các vạch trang trí */
export function makeAdTexture(title: string, subtitle: string, color: string) {
  return canvasTexture(288, 416, (ctx) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 288, 416);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 268, 396);
    ctx.fillStyle = color;
    for (let i = 0; i < 9; i++) ctx.fillRect(24, 40 + i * 9, 40 + ((i * 37) % 80), 3);
    ctx.textAlign = "center";
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fff";
    const size = Math.min(64, 520 / title.length);
    ctx.font = `700 ${size}px "Chakra Petch", ui-monospace, monospace`;
    ctx.fillText(title, 144, 230);
    ctx.fillStyle = color;
    ctx.font = `600 22px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillText(subtitle, 144, 290);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(144, 350, 22, 0, Math.PI * 2);
    ctx.stroke();
  });
}
