// Bảng LED khổng lồ ốp quanh góc toà tháp phía tây bắc điểm xuất phát: chiếu album NFT "CYBERHOOD Genesis"
// (ảnh pixel nhân vật, vật phẩm, quái thú hiếm) với nhãn kiểu sàn NFT: bộ sưu tập đã xác minh, số token, độ hiếm,
// giá ETH, chủ sở hữu, lượt thích. Hai mặt bảng dùng chung một texture nên hình chạy liền qua góc nhà.
// Hiệu ứng LED (lưới chấm, quét dòng, chuyển trang tan điểm ảnh) làm trong shader, canvas chỉ vẽ lại khi đổi trang.

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CITY } from "./config";
import { NFT_ATLAS } from "./nftAtlas";
import { NFT_CELL, NFT_COLS, NFT_ITEMS, RARITY_COLOR, type NftItem } from "./nftAlbum";

/** Góc ngoài của toà tháp (mép đông + mép bắc) và kích thước hai mặt bảng */
const CORNER = { x: -13.15, z: 13.55 };
const EAST_W = 12.05; // mặt đông, quay ra đại lộ
const NORTH_W = 13.05; // mặt bắc, quay về điểm xuất phát
const BOTTOM = 12;
const HEIGHT = 21;
const TOTAL_W = EAST_W + NORTH_W;
const SPLIT = EAST_W / TOTAL_W;
const TEX_W = 2048;
const TEX_H = Math.round((TEX_W * HEIGHT) / TOTAL_W / 8) * 8;
const SPLIT_PX = Math.round(TEX_W * SPLIT);
const PAGE_SECONDS = 6.5;
const GRID = 6;

const FONT = "'Chakra Petch', 'Arial Black', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const atlas = new Image();
const atlasReady = new Promise<void>((res) => {
  atlas.onload = () => res();
  atlas.src = NFT_ATLAS;
});

/** Chủ sở hữu và lượt thích giả lập, cố định theo số token */
function owner(i: number) {
  let h = Math.imul(i + 7, 2654435761);
  let s = "0x";
  for (let k = 0; k < 4; k++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    s += ((h >>> 0) & 0xf).toString(16);
  }
  return `${s}…${((i * 7919) & 0xffff).toString(16).padStart(4, "0")}`;
}
const likes = (i: number) => 120 + ((i * 3779) % 2400);
const tokenId = (i: number) => `#${String(i + 1).padStart(4, "0")}`;
const usd = (eth: number) => `$${Math.round(eth * 3100).toLocaleString("en-US")}`;

function sprite(g: CanvasRenderingContext2D, i: number, x: number, y: number, size: number) {
  g.imageSmoothingEnabled = false;
  g.drawImage(atlas, (i % NFT_COLS) * NFT_CELL, Math.floor(i / NFT_COLS) * NFT_CELL, NFT_CELL, NFT_CELL, x, y, size, size);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Nền ô ảnh: chuyển màu theo độ hiếm + lưới pixel + mặt trời neon kiểu synthwave */
function artBg(g: CanvasRenderingContext2D, it: NftItem, x: number, y: number, w: number, h: number) {
  const c = RARITY_COLOR[it.rarity];
  const bg = g.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, "#12052b");
  bg.addColorStop(0.62, c + "66");
  bg.addColorStop(1, "#06020f");
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  // Mặt trời sọc
  const r = w * 0.26;
  const sx = x + w / 2;
  const sy = y + h * 0.5;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const sun = g.createLinearGradient(0, sy - r, 0, sy + r);
  sun.addColorStop(0, "#ffd84a");
  sun.addColorStop(1, "#ff2a8a");
  g.fillStyle = sun;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.arc(sx, sy, r, Math.PI, 0);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = "#12052b";
  for (let k = 0; k < 5; k++) g.fillRect(sx - r, sy - r * 0.08 - k * r * 0.17, r * 2, r * 0.05 + k * 0.6);
  // Lưới phối cảnh dưới chân
  g.strokeStyle = c;
  g.globalAlpha = 0.45;
  g.lineWidth = Math.max(1, w / 220);
  for (let k = 0; k <= 10; k++) {
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(x + (k / 10) * w * 2 - w / 2, y + h);
    g.stroke();
  }
  for (let k = 1; k < 6; k++) {
    const yy = sy + (h - (sy - y)) * (k / 6) ** 1.8;
    g.beginPath();
    g.moveTo(x, yy);
    g.lineTo(x + w, yy);
    g.stroke();
  }
  g.restore();
  g.globalAlpha = 1;
}

function verified(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = "#2081e2";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#fff";
  g.lineWidth = r * 0.28;
  g.beginPath();
  g.moveTo(x - r * 0.45, y);
  g.lineTo(x - r * 0.1, y + r * 0.38);
  g.lineTo(x + r * 0.5, y - r * 0.35);
  g.stroke();
}

function eth(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  // Biểu tượng ETH: hai tam giác chồng lên nhau
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x + s * 0.6, y + s * 0.1);
  g.lineTo(x, y + s * 0.4);
  g.lineTo(x - s * 0.6, y + s * 0.1);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(x - s * 0.6, y + s * 0.3);
  g.lineTo(x, y + s);
  g.lineTo(x + s * 0.6, y + s * 0.3);
  g.lineTo(x, y + s * 0.6);
  g.closePath();
  g.fill();
}

function tag(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number) {
  g.font = `700 ${size}px ${FONT}`;
  const w = g.measureText(text).width + size;
  roundRect(g, x, y - size * 0.75, w, size * 1.5, size * 0.35);
  g.fillStyle = color + "33";
  g.fill();
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = color;
  g.textBaseline = "middle";
  g.fillText(text, x + size / 2, y + 1);
  return w;
}

/** Thẻ lớn: một NFT nổi bật trên mặt đông */
function featured(g: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number) {
  const it = NFT_ITEMS[i];
  const c = RARITY_COLOR[it.rarity];
  roundRect(g, x, y, w, h, 28);
  g.fillStyle = "#0d0a1f";
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = c;
  g.shadowColor = c;
  g.shadowBlur = 30;
  g.stroke();
  g.shadowBlur = 0;
  const pad = 26;
  const art = w - pad * 2;
  const artH = Math.min(art, h * 0.69);
  g.save();
  roundRect(g, x + pad, y + pad, art, artH, 18);
  g.clip();
  artBg(g, it, x + pad, y + pad, art, artH);
  const sz = Math.floor(artH / NFT_CELL) * NFT_CELL * 0.98;
  sprite(g, i, x + pad + (art - sz) / 2, y + pad + (artH - sz) / 2 + artH * 0.02, sz);
  g.restore();
  // Nhãn trên ảnh
  tag(g, it.rarity.toUpperCase(), x + pad + 20, y + pad + 42, c, 30);
  g.font = `700 28px ${MONO}`;
  g.textAlign = "right";
  g.fillStyle = "#ffffff";
  g.fillText(`♥ ${likes(i).toLocaleString("en-US")}`, x + w - pad - 20, y + pad + 44);
  g.textAlign = "left";
  let ty = y + pad + artH + 50;
  g.font = `600 30px ${FONT}`;
  g.fillStyle = "#2081e2";
  g.fillText("CYBERHOOD Genesis", x + pad, ty);
  verified(g, x + pad + g.measureText("CYBERHOOD Genesis").width + 24, ty, 15);
  ty += 66;
  g.font = `900 62px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.fillText(`${it.name} ${tokenId(i)}`, x + pad, ty, w - pad * 2);
  ty += 52;
  g.font = `500 28px ${MONO}`;
  g.fillStyle = "#9b93c4";
  g.fillText(`Owned by ${owner(i)} · ${it.kind} · ERC-721`, x + pad, ty, w - pad * 2);
  // Hộp giá
  ty += 30;
  const bh = y + h - pad - ty;
  roundRect(g, x + pad, ty, w - pad * 2, bh, 18);
  g.fillStyle = "#17122f";
  g.fill();
  g.font = `500 26px ${MONO}`;
  g.fillStyle = "#9b93c4";
  g.fillText("Current price", x + pad + 26, ty + 40);
  eth(g, x + pad + 48, ty + bh * 0.6, 26, "#ffffff");
  g.font = `900 66px ${FONT}`;
  g.fillStyle = "#ffffff";
  const ps = `${it.price.toFixed(2)} ETH`;
  g.fillText(ps, x + pad + 84, ty + bh * 0.6);
  const pw = g.measureText(ps).width;
  g.font = `500 28px ${MONO}`;
  g.fillStyle = "#9b93c4";
  g.fillText(usd(it.price), x + pad + 100 + pw, ty + bh * 0.62);
  // Nút mua
  const bw = 270;
  const bx = x + w - pad - 26 - bw;
  roundRect(g, bx, ty + bh / 2 - 44, bw, 88, 16);
  g.fillStyle = "#2081e2";
  g.shadowColor = "#2081e2";
  g.shadowBlur = 24;
  g.fill();
  g.shadowBlur = 0;
  g.font = `800 40px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.fillText("Buy now", bx + bw / 2, ty + bh / 2 + 2);
  g.textAlign = "left";
}

/** Thẻ nhỏ trong lưới mặt bắc */
function card(g: CanvasRenderingContext2D, i: number, x: number, y: number, w: number, h: number) {
  const it = NFT_ITEMS[i];
  const c = RARITY_COLOR[it.rarity];
  roundRect(g, x, y, w, h, 18);
  g.fillStyle = "#0d0a1f";
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = c + "cc";
  g.stroke();
  const pad = 12;
  const artH = h - 150;
  g.save();
  roundRect(g, x + pad, y + pad, w - pad * 2, artH, 12);
  g.clip();
  artBg(g, it, x + pad, y + pad, w - pad * 2, artH);
  const sz = Math.min(w - pad * 2, artH) * 0.96;
  sprite(g, i, x + (w - sz) / 2, y + pad + (artH - sz) / 2, sz);
  g.restore();
  g.textBaseline = "middle";
  g.font = `600 20px ${FONT}`;
  g.fillStyle = "#2081e2";
  g.fillText("CYBERHOOD Genesis", x + pad + 4, y + artH + 34);
  verified(g, x + pad + 16 + g.measureText("CYBERHOOD Genesis").width, y + artH + 34, 10);
  g.font = `800 30px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.fillText(`${it.name} ${tokenId(i)}`, x + pad + 4, y + artH + 72, w - pad * 2 - 8);
  eth(g, x + pad + 16, y + artH + 114, 13, c);
  g.font = `800 30px ${FONT}`;
  g.fillStyle = c;
  g.fillText(`${it.price.toFixed(2)} ETH`, x + pad + 38, y + artH + 115);
  g.font = `500 20px ${MONO}`;
  g.fillStyle = "#9b93c4";
  g.textAlign = "right";
  g.fillText(it.rarity.toUpperCase(), x + w - pad - 4, y + artH + 115);
  g.textAlign = "left";
}

const FLOOR = Math.min(...NFT_ITEMS.map((n) => n.price));
const VOLUME = NFT_ITEMS.reduce((s, n) => s + n.price, 0) * 53;

function drawPage(g: CanvasRenderingContext2D, page: number) {
  (g as CanvasRenderingContext2D & { keepText?: boolean }).keepText = true;
  const W = TEX_W;
  const H = TEX_H;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#09031c");
  bg.addColorStop(0.5, "#120634");
  bg.addColorStop(1, "#05020f");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";
  // Dải tiêu đề chạy ngang cả hai mặt
  const HEAD = 150;
  g.fillStyle = "#04020c";
  g.fillRect(0, 0, W, HEAD);
  g.font = `900 64px ${FONT}`;
  g.shadowColor = "#05f0ff";
  g.shadowBlur = 26;
  g.fillStyle = "#05f0ff";
  g.fillText("CYBER", 40, HEAD / 2);
  const cw = g.measureText("CYBER").width;
  g.shadowColor = "#ff2a8a";
  g.fillStyle = "#ff2a8a";
  g.fillText("HOOD", 40 + cw, HEAD / 2);
  const hw = g.measureText("HOOD").width;
  g.shadowBlur = 0;
  g.font = `800 42px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.fillText("× NFT MARKET", 64 + cw + hw, HEAD / 2 + 4);
  // Đèn LIVE ở ngay sau tiêu đề, trước góc nhà
  const lx = Math.min(SPLIT_PX - 130, 64 + cw + hw + g.measureText("× NFT MARKET").width + 40);
  g.fillStyle = "#ff2a4a";
  g.beginPath();
  g.arc(lx, HEAD / 2, 12, 0, Math.PI * 2);
  g.fill();
  g.font = `800 34px ${MONO}`;
  g.fillText("LIVE", lx + 22, HEAD / 2 + 2);
  // Thống kê bộ sưu tập (mặt bắc)
  const stats: [string, string][] = [
    ["FLOOR", `${FLOOR.toFixed(2)} ETH`],
    ["TOTAL VOLUME", `${Math.round(VOLUME).toLocaleString("en-US")} ETH`],
    ["ITEMS", "10,000"],
    ["OWNERS", "4,812"],
  ];
  const sw = (W - SPLIT_PX - 60) / stats.length;
  stats.forEach(([k, v], n) => {
    const sx = SPLIT_PX + 40 + n * sw;
    g.font = `500 24px ${MONO}`;
    g.fillStyle = "#9b93c4";
    g.fillText(k, sx, HEAD / 2 - 26);
    g.font = `800 40px ${FONT}`;
    g.fillStyle = n === 0 ? "#7dffb0" : "#ffffff";
    g.fillText(v, sx, HEAD / 2 + 22);
  });
  g.fillStyle = "#05f0ff";
  g.fillRect(0, HEAD - 4, W, 4);
  // Mặt đông: thẻ nổi bật
  const fi = page % NFT_ITEMS.length;
  featured(g, fi, 44, HEAD + 34, SPLIT_PX - 88, H - HEAD - 70);
  // Mặt bắc: lưới 3×2 thẻ tiếp theo
  const gx = SPLIT_PX + 40;
  const gy = HEAD + 34;
  const gw = W - gx - 40;
  const gh = H - gy - 36;
  const cols = 3;
  const gap = 26;
  const cwid = (gw - gap * (cols - 1)) / cols;
  const chei = (gh - gap) / 2;
  for (let k = 0; k < GRID; k++) {
    const i = (fi + 1 + k) % NFT_ITEMS.length;
    card(g, i, gx + (k % cols) * (cwid + gap), gy + Math.floor(k / cols) * (chei + gap), cwid, chei);
  }
}

/** Dải chữ chạy bên dưới bảng: lịch sử giao dịch */
function tickerTexture() {
  const c = document.createElement("canvas");
  c.width = 4096;
  c.height = 128;
  const g = c.getContext("2d")! as CanvasRenderingContext2D & { keepText?: boolean };
  g.keepText = true;
  g.fillStyle = "#04020c";
  g.fillRect(0, 0, c.width, c.height);
  g.textBaseline = "middle";
  let x = 20;
  for (let k = 0; x < c.width - 40; k++) {
    const i = (k * 7) % NFT_ITEMS.length;
    const it = NFT_ITEMS[i];
    const verb = ["SOLD", "LISTED", "OFFER", "MINTED"][k % 4];
    g.font = `800 52px ${FONT}`;
    g.fillStyle = verb === "SOLD" ? "#7dffb0" : verb === "OFFER" ? "#ffd84a" : verb === "MINTED" ? "#ff2a8a" : "#05f0ff";
    g.fillText(verb, x, 66);
    x += g.measureText(verb).width + 18;
    g.fillStyle = "#ffffff";
    const s = `${it.name} ${tokenId(i)}  ${(it.price * (0.9 + ((k * 37) % 30) / 100)).toFixed(2)} ETH`;
    g.fillText(s, x, 66);
    x += g.measureText(s).width + 26;
    g.fillStyle = "#3a2c6e";
    g.fillText("◆", x, 64);
    x += 70;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D map;
uniform sampler2D prev;
uniform float mixT;
uniform float time;
uniform vec2 cells;
uniform float scroll;
uniform float gain;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 uv = vec2(fract(vUv.x + scroll), vUv.y);
  vec2 cell = vUv * cells;
  vec2 id = floor(cell);
  // Chuyển trang: từng điểm LED đổi sang ảnh mới theo thứ tự ngẫu nhiên, quét từ trên xuống
  float order = hash(floor(id / 3.0)) * 0.55 + (1.0 - vUv.y) * 0.45;
  float useNew = step(order, mixT * 1.15);
  vec2 su = (id + 0.5) / cells;
  su.x = fract(su.x + scroll);
  vec3 col = mix(texture2D(prev, su).rgb, texture2D(map, su).rgb, useNew);
  // Viền chuyển trang sáng lên
  float edge = smoothstep(0.06, 0.0, abs(order - mixT * 1.15)) * step(mixT, 0.999);
  col += edge * vec3(0.3, 0.9, 1.0);
  // Chấm LED: tròn, mờ dần thành mảng phẳng khi nhìn xa để tránh vân moiré
  vec2 f = fract(cell) - 0.5;
  float d = length(f);
  float dotMask = smoothstep(0.5, 0.32, d);
  float far = clamp(max(fwidth(cell.x), fwidth(cell.y)) * 1.4, 0.0, 1.0);
  float mask = mix(dotMask * 1.25, 0.78, far);
  // Quét dòng chạy và nhấp nháy nhẹ
  float scan = 0.92 + 0.08 * sin(vUv.y * 90.0 - time * 6.0);
  float flick = 0.97 + 0.03 * hash(vec2(floor(time * 24.0), 1.0));
  gl_FragColor = vec4(col * mask * scan * flick * gain, 1.0);
  #include <colorspace_fragment>
}`;

function ledMaterial(map: THREE.Texture, cells: [number, number], gain = 1.6) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      prev: { value: map },
      mixT: { value: 1 },
      time: { value: 0 },
      cells: { value: new THREE.Vector2(...cells) },
      scroll: { value: 0 },
      gain: { value: gain },
    },
    vertexShader: vert,
    fragmentShader: frag,
    toneMapped: false,
  });
}

/** Mặt phẳng chỉ lấy một khoảng u của texture chung */
function facePlane(w: number, h: number, u0: number, u1: number) {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let k = 0; k < uv.count; k++) uv.setX(k, u0 + uv.getX(k) * (u1 - u0));
  return geo;
}

export function NftBoard() {
  const { pages, mat, tick, tickMat, geoE, geoN, tickE, tickN } = useMemo(() => {
    const pages = [0, 1].map(() => {
      const c = document.createElement("canvas");
      c.width = TEX_W;
      c.height = TEX_H;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.generateMipmaps = true;
      return { c, t };
    });
    // Mỗi chấm LED ~6cm
    const mat = ledMaterial(pages[0].t, [Math.round(TOTAL_W / 0.055), Math.round(HEIGHT / 0.055)]);
    const tick = tickerTexture();
    const tickMat = ledMaterial(tick, [Math.round(TOTAL_W / 0.05) * 2, 22], 1.8);
    tickMat.uniforms.prev.value = tick;
    return {
      pages,
      mat,
      tick,
      tickMat,
      geoE: facePlane(EAST_W, HEIGHT, 0, SPLIT),
      geoN: facePlane(NORTH_W, HEIGHT, SPLIT, 1),
      tickE: facePlane(EAST_W, 1.1, 0, SPLIT),
      tickN: facePlane(NORTH_W, 1.1, SPLIT, 1),
    };
  }, []);
  const st = useRef({ page: 0, at: 0, cur: 0 });
  useEffect(() => {
    let alive = true;
    atlasReady.then(() => {
      if (!alive) return;
      drawPage(pages[0].c.getContext("2d")!, 0);
      pages[0].t.needsUpdate = true;
    });
    return () => {
      alive = false;
      tick.dispose();
    };
  }, [pages, tick]);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    mat.uniforms.time.value = t;
    tickMat.uniforms.time.value = t;
    tickMat.uniforms.scroll.value = (tickMat.uniforms.scroll.value + dt * 0.035) % 1;
    const s = st.current;
    if (t - s.at > PAGE_SECONDS && atlas.complete) {
      s.at = t;
      s.page++;
      const next = 1 - s.cur;
      drawPage(pages[next].c.getContext("2d")!, s.page);
      pages[next].t.needsUpdate = true;
      mat.uniforms.prev.value = pages[s.cur].t;
      mat.uniforms.map.value = pages[next].t;
      mat.uniforms.mixT.value = 0;
      s.cur = next;
    }
    mat.uniforms.mixT.value = Math.min(1, mat.uniforms.mixT.value + dt / 1.1);
  });
  const y0 = CITY.SIDEWALK_HEIGHT + BOTTOM;
  const cy = y0 + HEIGHT / 2;
  const frame = <meshStandardMaterial color="#14141f" metalness={0.85} roughness={0.35} />;
  const neonC = <meshBasicMaterial color={[0.2, 2.4, 3]} toneMapped={false} />;
  const neonM = <meshBasicMaterial color={[3, 0.4, 1.6]} toneMapped={false} />;
  return (
    <group>
      {/* Mặt đông: quay +x, chạy từ z xa về góc */}
      <group position={[CORNER.x, 0, CORNER.z + EAST_W / 2]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={geoE} material={mat} position={[0, cy, 0]} />
        <mesh geometry={tickE} material={tickMat} position={[0, y0 - 1.05, 0]} />
        <mesh position={[0, cy, -0.25]}>
          <boxGeometry args={[EAST_W + 0.3, HEIGHT + 3.2, 0.4]} />
          {frame}
        </mesh>
        <mesh position={[0, y0 + HEIGHT + 0.12, 0.1]}>
          <boxGeometry args={[EAST_W, 0.12, 0.12]} />
          {neonC}
        </mesh>
        <mesh position={[0, y0 - 1.75, 0.1]}>
          <boxGeometry args={[EAST_W, 0.1, 0.1]} />
          {neonM}
        </mesh>
      </group>
      {/* Mặt bắc: quay -z, chạy từ góc sang tây */}
      <group position={[CORNER.x - NORTH_W / 2, 0, CORNER.z]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={geoN} material={mat} position={[0, cy, 0]} />
        <mesh geometry={tickN} material={tickMat} position={[0, y0 - 1.05, 0]} />
        <mesh position={[0, cy, -0.25]}>
          <boxGeometry args={[NORTH_W + 0.3, HEIGHT + 3.2, 0.4]} />
          {frame}
        </mesh>
        <mesh position={[0, y0 + HEIGHT + 0.12, 0.1]}>
          <boxGeometry args={[NORTH_W, 0.12, 0.12]} />
          {neonC}
        </mesh>
        <mesh position={[0, y0 - 1.75, 0.1]}>
          <boxGeometry args={[NORTH_W, 0.1, 0.1]} />
          {neonM}
        </mesh>
      </group>
      {/* Cột góc: dải neon dọc che mối nối hai mặt */}
      <mesh position={[CORNER.x + 0.02, cy, CORNER.z - 0.02]}>
        <boxGeometry args={[0.22, HEIGHT + 3.2, 0.22]} />
        {neonC}
      </mesh>
    </group>
  );
}
