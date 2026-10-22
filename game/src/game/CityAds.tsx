// Biển quảng cáo LED khắp thành phố: gắn trên mặt tiền các toà nhà khối hộp cao, mỗi biển xoay vòng các chương trình
// dùng chung (canvas vẽ một lần cho mọi biển): NFT mới đúc, clip replay Hunter hạ quái, bảng giá coin, quảng cáo chuỗi
// HOOD CHAIN và sàn NEONSWAP (thương hiệu hư cấu trong game), bảng xếp hạng KOL AI. Hiệu ứng LED dùng chung shader với
// bảng NFT khổng lồ ở góc tháp.

import { useEffect, useMemo, useRef } from "react";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CITY, BLOCK_CENTERS } from "./config";
import { BUILDINGS } from "./City";
import { NFT_CELL, NFT_COLS, NFT_ITEMS, RARITY_COLOR } from "./nftAlbum";
import { NFT_TOWER, artBg, atlas, atlasReady, eth, ledMaterial, likes, roundRect, sprite, tokenId, verified } from "./NftBoard";

const W = 1024;
const H = 576;
const TEX_W = 640;
const FONT = "'Chakra Petch', 'Arial Black', sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
type Ctx = CanvasRenderingContext2D & { keepText?: boolean };

type Program = "nft" | "clip" | "coin" | "hood" | "swap" | "kol";
const PROGRAMS: Program[] = ["clip", "nft", "coin", "kol", "hood", "clip", "swap", "nft"];
const SLOT_SECONDS = 9;
const programAt = (t: number, offset: number) => PROGRAMS[Math.floor((t + offset) / SLOT_SECONDS) % PROGRAMS.length];

const byName = (n: string) => NFT_ITEMS.findIndex((it) => it.name === n);

// ---------- Clip replay: Hunter hạ quái ----------

const MATCHES: [string, string, string][] = [
  ["Shadow Ninja", "Gold Dragon", "Thunder Spear"],
  ["Ronin Samurai", "Electric Leviathan", "Leviathan Scale"],
  ["Ghost Hacker", "Reaper Mk-II", "Chrono Cube"],
  ["Neon Racer", "Twin-Head Ogre", "Nova Bomb"],
  ["Iron Engineer", "Colossus Mech", "Oni Helm"],
  ["Vex the Fixer", "Crimson Drake", "Cosmic Edge"],
  ["Rook the Smith", "Alpha Werewolf", "Frost Fang Blade"],
  ["Legion Officer", "The Watcher", "Extra Coin"],
];
const CLIP_LEN = 7;

/** Ảnh pixel nhuộm trắng để nháy khi trúng đòn */
const flashCanvas = document.createElement("canvas");
flashCanvas.width = flashCanvas.height = 64;
function flashSprite(g: Ctx, i: number, x: number, y: number, size: number, flip: boolean, white: number) {
  g.save();
  if (flip) {
    g.translate(x + size, y);
    g.scale(-1, 1);
    x = 0;
    y = 0;
  }
  sprite(g, i, x, y, size);
  if (white > 0) {
    const f = flashCanvas.getContext("2d")!;
    f.clearRect(0, 0, 64, 64);
    f.globalCompositeOperation = "source-over";
    sprite(f, i, 0, 0, 64);
    f.globalCompositeOperation = "source-atop";
    f.fillStyle = "#ffffff";
    f.fillRect(0, 0, 64, 64);
    g.globalAlpha = white;
    g.imageSmoothingEnabled = false;
    g.drawImage(flashCanvas, x, y, size, size);
    g.globalAlpha = 1;
  }
  g.restore();
}

function skyline(g: Ctx, t: number) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#14052e");
  bg.addColorStop(0.7, "#3a0d4f");
  bg.addColorStop(1, "#08020f");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Toà nhà pixel hai lớp trôi chậm
  for (const [layer, col, speed, base] of [
    [0, "#1e0b3d", 6, 360],
    [1, "#12062a", 14, 400],
  ] as const) {
    g.fillStyle = col;
    for (let k = -1; k < 14; k++) {
      const bw = 70 + ((k * 37 + layer * 11) % 40);
      const bh = 80 + ((k * 53 + layer * 29) % 140);
      const x = ((k * 90 - t * speed) % (W + 180)) + (k * 90 - t * speed < 0 ? W + 180 : 0) - 90;
      g.fillRect(x, base - bh, bw, bh + 200);
      g.fillStyle = layer ? "#ff2a8a55" : "#05d9e844";
      for (let wy = base - bh + 12; wy < base - 8; wy += 18) for (let wx = x + 8; wx < x + bw - 8; wx += 16) if ((wx * 7 + wy * 3 + k) % 5 < 2) g.fillRect(wx, wy, 6, 8);
      g.fillStyle = col;
    }
  }
  // Mặt sàn lưới
  g.fillStyle = "#0a0316";
  g.fillRect(0, 430, W, H - 430);
  g.strokeStyle = "#ff2a8a88";
  g.lineWidth = 2;
  for (let k = 0; k < 18; k++) {
    g.beginPath();
    g.moveTo(W / 2, 430);
    g.lineTo((k / 17) * W * 2.4 - W * 0.7, H);
    g.stroke();
  }
  for (let k = 0; k < 6; k++) {
    const yy = 430 + (H - 430) * ((k + ((t * 1.5) % 1)) / 6) ** 1.7;
    g.beginPath();
    g.moveTo(0, yy);
    g.lineTo(W, yy);
    g.stroke();
  }
}

function hpBar(g: Ctx, x: number, y: number, w: number, frac: number, name: string, color: string, right: boolean) {
  g.fillStyle = "#000000aa";
  g.fillRect(x, y, w, 26);
  g.fillStyle = color;
  const fw = (w - 6) * Math.max(0, frac);
  g.fillRect(right ? x + w - 3 - fw : x + 3, y + 3, fw, 20);
  g.font = `800 22px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.textAlign = right ? "right" : "left";
  g.textBaseline = "bottom";
  g.fillText(name.toUpperCase(), right ? x + w : x, y - 4);
  g.textAlign = "left";
}

function drawClip(g: Ctx, t: number) {
  const n = Math.floor(t / CLIP_LEN);
  const [hn, bn, drop] = MATCHES[n % MATCHES.length];
  const hi = byName(hn);
  const bi = byName(bn);
  const di = byName(drop);
  const lt = t % CLIP_LEN;
  // Rung màn hình lúc đánh
  const hitting = lt > 1.4 && lt < 4.4;
  const shake = hitting ? Math.sin(lt * 60) * 4 : lt > 4.4 && lt < 4.8 ? Math.sin(lt * 90) * 12 : 0;
  g.save();
  g.translate(shake, shake * 0.4);
  skyline(g, t);
  // Hunter lao tới rồi chém liên tục, quái nháy trắng và trừ máu
  const dash = Math.min(1, Math.max(0, (lt - 0.8) / 0.6));
  const hx = 120 + dash * 300 + (hitting ? Math.sin(lt * 18) * 26 : 0);
  const hy = 230 - (hitting ? Math.abs(Math.sin(lt * 9)) * 50 : 0);
  const hits = Math.max(0, Math.floor((lt - 1.4) / 0.38));
  const hpFrac = lt < 1.4 ? 1 : Math.max(0, 1 - Math.min(hits, 8) / 8);
  const dead = lt > 4.4;
  const flash = hitting && (lt - 1.4) % 0.38 < 0.09 ? 1 : 0;
  // Quái
  const bSize = 300;
  if (!dead || lt < 5.6) {
    g.save();
    if (dead) {
      const k = Math.min(1, (lt - 4.4) / 1.2);
      g.globalAlpha = 1 - k;
      g.translate(0, k * 60);
    }
    flashSprite(g, bi, 600, 140, bSize, true, dead ? Math.max(0, 1 - (lt - 4.4) * 2) : flash);
    g.restore();
  }
  // Mảnh vỡ pixel khi quái gục
  if (dead) {
    const k = lt - 4.4;
    for (let p = 0; p < 60; p++) {
      const a = p * 2.4;
      const sp = 80 + ((p * 37) % 160);
      g.fillStyle = ["#ff2a8a", "#05f0ff", "#ffd84a", "#ffffff"][p % 4];
      g.fillRect(750 + Math.cos(a) * sp * k, 290 + Math.sin(a) * sp * k + k * k * 120, 8, 8);
    }
  }
  flashSprite(g, hi, hx, hy, 200, false, 0);
  // Vệt chém neon
  if (hitting) {
    const ph = ((lt - 1.4) % 0.38) / 0.38;
    g.strokeStyle = hits % 2 ? "#05f0ff" : "#ff2a8a";
    g.lineWidth = 14 * (1 - ph);
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 24;
    g.beginPath();
    g.arc(700, 290, 130, -1.2 + (hits % 2 ? 0.6 : 0) + ph, 0.6 + ph * 1.4);
    g.stroke();
    g.shadowBlur = 0;
    // Số sát thương bay lên
    g.font = `900 40px ${FONT}`;
    g.fillStyle = "#ffd84a";
    g.textAlign = "center";
    g.fillText(`-${(1200 + ((hits * 977) % 2600)).toLocaleString("en-US")}`, 760 + ((hits * 53) % 120) - 60, 200 - ph * 60);
    g.textAlign = "left";
  }
  // Chém kết liễu: chớp trắng toàn màn
  if (lt > 4.3 && lt < 4.55) {
    g.fillStyle = `rgba(255,255,255,${1 - (lt - 4.3) / 0.25})`;
    g.fillRect(-20, -20, W + 40, H + 40);
  }
  g.restore();
  // Giao diện replay
  hpBar(g, 30, 60, 340, 1, hn, "#05f0ff", false);
  hpBar(g, W - 370, 60, 340, hpFrac, bn, "#ff2a4a", true);
  g.font = `800 22px ${MONO}`;
  g.fillStyle = "#ff2a4a";
  g.beginPath();
  g.arc(W / 2 - 70, 26, 9, 0, Math.PI * 2);
  if (Math.floor(t * 2) % 2) g.fill();
  g.fillStyle = "#ffffff";
  g.textBaseline = "middle";
  g.fillText(`REPLAY #${4100 + (n % 900)}`, W / 2 - 52, 27);
  if (lt < 1.2) {
    g.font = `900 64px ${FONT}`;
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.shadowColor = "#ff2a8a";
    g.shadowBlur = 20;
    g.fillText("VS", W / 2, 270);
    g.shadowBlur = 0;
    g.textAlign = "left";
  }
  if (dead) {
    const k = Math.min(1, (lt - 4.5) * 3);
    g.textAlign = "center";
    g.font = `900 ${Math.round(110 + (1 - k) * 80)}px ${FONT}`;
    g.fillStyle = "#ffd84a";
    g.shadowColor = "#ff2a8a";
    g.shadowBlur = 30;
    g.fillText("K.O.!", W / 2, 230);
    g.shadowBlur = 0;
    if (lt > 5) {
      roundRect(g, W / 2 - 330, 330, 660, 120, 16);
      g.fillStyle = "#0b0618dd";
      g.fill();
      g.strokeStyle = RARITY_COLOR[NFT_ITEMS[di].rarity];
      g.lineWidth = 4;
      g.stroke();
      g.font = `800 30px ${FONT}`;
      g.fillStyle = "#ffffff";
      g.fillText(`${hn.toUpperCase()} defeated ${bn.toUpperCase()}`, W / 2, 365, 620);
      sprite(g, di, W / 2 - 300, 384, 56);
      g.font = `700 26px ${MONO}`;
      g.fillStyle = RARITY_COLOR[NFT_ITEMS[di].rarity];
      g.fillText(`DROP · ${drop} (${NFT_ITEMS[di].rarity})`, W / 2 + 20, 414, 540);
    }
    g.textAlign = "left";
  }
}

// ---------- NFT mới đúc (thẻ ngang) ----------

function drawNft(g: Ctx, page: number) {
  const i = (page * 5 + 3) % NFT_ITEMS.length;
  const it = NFT_ITEMS[i];
  const c = RARITY_COLOR[it.rarity];
  g.fillStyle = "#07031a";
  g.fillRect(0, 0, W, H);
  roundRect(g, 24, 24, 528, 528, 22);
  g.save();
  g.clip();
  artBg(g, it, 24, 24, 528, 528);
  sprite(g, i, 24 + 8, 24 + 8, 512);
  g.restore();
  g.lineWidth = 5;
  g.strokeStyle = c;
  roundRect(g, 24, 24, 528, 528, 22);
  g.stroke();
  const x = 590;
  g.textBaseline = "middle";
  g.font = `900 40px ${FONT}`;
  g.fillStyle = "#ff2a8a";
  g.fillText("NEW DROP", x, 70);
  g.font = `600 26px ${FONT}`;
  g.fillStyle = "#2081e2";
  g.fillText("CYBERHOOD Genesis", x, 130);
  verified(g, x + g.measureText("CYBERHOOD Genesis").width + 18, 130, 12);
  g.font = `900 50px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.fillText(it.name, x, 190, W - x - 30);
  g.font = `800 40px ${FONT}`;
  g.fillText(tokenId(i), x, 245);
  g.font = `700 26px ${MONO}`;
  g.fillStyle = c;
  g.fillText(`${it.rarity.toUpperCase()} · ${it.kind.toUpperCase()}`, x, 295);
  g.fillStyle = "#9b93c4";
  g.fillText(`♥ ${likes(i).toLocaleString("en-US")}  ·  ERC-721`, x, 335);
  roundRect(g, x, 380, W - x - 30, 150, 16);
  g.fillStyle = "#17122f";
  g.fill();
  g.font = `500 22px ${MONO}`;
  g.fillStyle = "#9b93c4";
  g.fillText("Mint price", x + 20, 410);
  eth(g, x + 36, 465, 22, "#ffffff");
  g.font = `900 54px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.fillText(`${it.price.toFixed(2)} ETH`, x + 70, 467);
  g.font = `800 26px ${FONT}`;
  g.fillStyle = "#7dffb0";
  g.fillText("● MINTING NOW", x + 20, 510);
}

// ---------- Bảng giá coin (giá trong game, đi ngẫu nhiên) ----------

type Coin = { sym: string; name: string; color: string; price: number; hist: number[] };
const COINS: Coin[] = [
  { sym: "BTC", name: "Bitcoin", color: "#f7931a", price: 108420, hist: [] },
  { sym: "ETH", name: "Ether", color: "#8c8cff", price: 3912, hist: [] },
  { sym: "CRED", name: "Cyberhood Cred", color: "#05f0ff", price: 0.0842, hist: [] },
];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
for (const c of COINS) for (let k = 0; k < 60; k++) stepCoin(c);
function stepCoin(c: Coin) {
  c.price *= 1 + rnd() * 0.004 + 0.0002;
  c.hist.push(c.price);
  if (c.hist.length > 60) c.hist.shift();
}

function btcLogo(g: Ctx, x: number, y: number, r: number) {
  g.fillStyle = "#f7931a";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(x, y);
  g.rotate(0.24);
  g.fillStyle = "#ffffff";
  g.font = `900 ${Math.round(r * 1.35)}px Arial, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("₿", 0, r * 0.06);
  g.restore();
}

function ethLogo(g: Ctx, x: number, y: number, r: number) {
  g.fillStyle = "#1c1c3a";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  const s = r * 0.62;
  const part = (pts: number[][], col: string) => {
    g.fillStyle = col;
    g.beginPath();
    pts.forEach(([px, py], k) => (k ? g.lineTo(x + px * s, y + py * s) : g.moveTo(x + px * s, y + py * s)));
    g.closePath();
    g.fill();
  };
  part([[0, -1.25], [0.72, 0.1], [0, 0.45]], "#c9c9ff");
  part([[0, -1.25], [-0.72, 0.1], [0, 0.45]], "#8c8cff");
  part([[0, 0.62], [0.72, 0.25], [0, 1.3]], "#c9c9ff");
  part([[0, 0.62], [-0.72, 0.25], [0, 1.3]], "#8c8cff");
}

function credLogo(g: Ctx, x: number, y: number, r: number) {
  g.fillStyle = "#0b2a33";
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#05f0ff";
  g.lineWidth = r * 0.14;
  g.stroke();
  g.fillStyle = "#05f0ff";
  g.font = `900 ${Math.round(r * 1.1)}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("C", x, y + r * 0.05);
  g.textAlign = "left";
}

const fmtPrice = (p: number) => (p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p.toFixed(4));

function drawCoin(g: Ctx) {
  g.fillStyle = "#05020f";
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";
  g.font = `900 34px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.fillText("NEON CITY EXCHANGE", 30, 40);
  g.font = `700 20px ${MONO}`;
  g.fillStyle = "#7dffb0";
  g.textAlign = "right";
  g.fillText("● LIVE · IN-GAME MARKET", W - 30, 40);
  g.textAlign = "left";
  const rowH = 160;
  COINS.forEach((c, k) => {
    const y = 80 + k * (rowH + 12);
    roundRect(g, 20, y, W - 40, rowH, 16);
    g.fillStyle = "#110a26";
    g.fill();
    const lx = 100;
    const ly = y + rowH / 2;
    if (c.sym === "BTC") btcLogo(g, lx, ly, 52);
    else if (c.sym === "ETH") ethLogo(g, lx, ly, 52);
    else credLogo(g, lx, ly, 52);
    g.font = `900 48px ${FONT}`;
    g.fillStyle = "#ffffff";
    g.fillText(c.sym, 172, ly - 26);
    g.font = `600 22px ${MONO}`;
    g.fillStyle = "#9b93c4";
    g.fillText(c.name, 174, ly + 22);
    const first = c.hist[0];
    const ch = (c.price / first - 1) * 100;
    const up = ch >= 0;
    g.font = `900 52px ${FONT}`;
    g.fillStyle = "#ffffff";
    g.fillText(`$${fmtPrice(c.price)}`, 360, ly - 18);
    g.font = `800 28px ${FONT}`;
    g.fillStyle = up ? "#29e07a" : "#ff3b5c";
    g.fillText(`${up ? "▲" : "▼"} ${Math.abs(ch).toFixed(2)}%`, 362, ly + 32);
    // Đường giá
    const cx = 660;
    const cw = W - 60 - cx;
    const min = Math.min(...c.hist);
    const max = Math.max(...c.hist);
    g.beginPath();
    c.hist.forEach((p, j) => {
      const px = cx + (j / (c.hist.length - 1)) * cw;
      const py = y + rowH - 22 - ((p - min) / (max - min || 1)) * (rowH - 44);
      if (j) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.strokeStyle = up ? "#29e07a" : "#ff3b5c";
    g.lineWidth = 4;
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 12;
    g.stroke();
    g.shadowBlur = 0;
  });
}

// ---------- Quảng cáo chuỗi / sàn hư cấu trong game ----------

function hoodLogo(g: Ctx, x: number, y: number, r: number, t: number) {
  // Lục giác neon với hình người đội mũ trùm
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 0.8) * 0.05);
  g.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    if (k) g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  const grd = g.createLinearGradient(-r, -r, r, r);
  grd.addColorStop(0, "#05f0ff");
  grd.addColorStop(1, "#ff2a8a");
  g.fillStyle = "#0b0618";
  g.fill();
  g.lineWidth = r * 0.1;
  g.strokeStyle = grd;
  g.shadowColor = "#05f0ff";
  g.shadowBlur = 30;
  g.stroke();
  g.shadowBlur = 0;
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(0, -r * 0.62);
  g.quadraticCurveTo(r * 0.55, -r * 0.5, r * 0.5, r * 0.15);
  g.lineTo(r * 0.62, r * 0.6);
  g.lineTo(-r * 0.62, r * 0.6);
  g.lineTo(-r * 0.5, r * 0.15);
  g.quadraticCurveTo(-r * 0.55, -r * 0.5, 0, -r * 0.62);
  g.fill();
  g.fillStyle = "#0b0618";
  g.beginPath();
  g.ellipse(0, -r * 0.05, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#05f0ff";
  g.fillRect(-r * 0.17, -r * 0.08, r * 0.12, r * 0.05);
  g.fillRect(r * 0.05, -r * 0.08, r * 0.12, r * 0.05);
  g.restore();
}

function drawHood(g: Ctx, t: number) {
  const bg = g.createRadialGradient(W * 0.3, H / 2, 20, W * 0.3, H / 2, W * 0.8);
  bg.addColorStop(0, "#1a0b3d");
  bg.addColorStop(1, "#04020c");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Khối chuỗi chạy ngang
  for (let k = 0; k < 9; k++) {
    const x = ((k * 140 + t * 90) % 1260) - 140;
    roundRect(g, x, 470, 100, 60, 10);
    g.strokeStyle = k % 2 ? "#05f0ff" : "#ff2a8a";
    g.lineWidth = 3;
    g.stroke();
    g.font = `700 18px ${MONO}`;
    g.fillStyle = "#9b93c4";
    g.textBaseline = "middle";
    g.fillText(`#${(9_120_400 + Math.floor(t * 10) - k).toString().slice(-5)}`, x + 14, 500);
    if (x > -100) {
      g.fillStyle = "#3a2c6e";
      g.fillRect(x + 100, 498, 40, 4);
    }
  }
  hoodLogo(g, 230, 230, 150, t);
  g.textBaseline = "middle";
  g.font = `900 92px ${FONT}`;
  g.fillStyle = "#ffffff";
  g.shadowColor = "#05f0ff";
  g.shadowBlur = 24;
  g.fillText("HOOD", 430, 150);
  g.fillStyle = "#05f0ff";
  g.fillText("CHAIN", 430, 245);
  g.shadowBlur = 0;
  g.font = `700 30px ${FONT}`;
  g.fillStyle = "#e9e6f5";
  g.fillText("The Layer-2 of Neon City", 432, 320);
  g.font = `600 24px ${MONO}`;
  g.fillStyle = "#ffd84a";
  g.fillText(`⚡ 0.2s blocks · gas ≈ 0.0001 · TPS ${(48000 + Math.round(Math.sin(t) * 900)).toLocaleString("en-US")}`, 432, 375);
  g.fillStyle = "#ff2a8a";
  g.font = `800 26px ${FONT}`;
  g.fillText("BRIDGE YOUR LOOT · MAINNET LIVE", 432, 425);
}

function drawSwap(g: Ctx, t: number) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a0838");
  bg.addColorStop(1, "#06021a");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Logo: hai mũi tên neon xoay quanh vòng tròn
  const cx = 230;
  const cy = 270;
  g.save();
  g.translate(cx, cy);
  g.rotate(t * 0.9);
  for (let k = 0; k < 2; k++) {
    g.rotate(Math.PI);
    g.strokeStyle = k ? "#ff2a8a" : "#05f0ff";
    g.shadowColor = g.strokeStyle;
    g.shadowBlur = 24;
    g.lineWidth = 22;
    g.beginPath();
    g.arc(0, 0, 120, 0.2, Math.PI - 0.5);
    g.stroke();
    const a = Math.PI - 0.5;
    g.fillStyle = g.strokeStyle;
    g.beginPath();
    g.moveTo(Math.cos(a) * 120 - 30, Math.sin(a) * 120 - 10);
    g.lineTo(Math.cos(a) * 120 + 26, Math.sin(a) * 120 - 18);
    g.lineTo(Math.cos(a + 0.35) * 120, Math.sin(a + 0.35) * 120 + 8);
    g.fill();
  }
  g.restore();
  g.shadowBlur = 0;
  g.font = `900 70px ${FONT}`;
  g.fillStyle = "#ff2a8a";
  g.textBaseline = "middle";
  g.fillText("NEON", 430, 120);
  g.fillStyle = "#ffffff";
  g.fillText("SWAP", 430 + g.measureText("NEON").width + 10, 120);
  g.font = `700 28px ${FONT}`;
  g.fillStyle = "#e9e6f5";
  g.fillText("Swap loot tokens in one click", 432, 180);
  // Ô hoán đổi
  const pairs = [
    ["CRED", "ETH"],
    ["ETH", "BTC"],
    ["CRED", "BTC"],
  ];
  const [a, b] = pairs[Math.floor(t / 3) % pairs.length];
  for (const [k, sym] of [
    [0, a],
    [1, b],
  ] as const) {
    const y = 230 + k * 120;
    roundRect(g, 430, y, W - 470, 100, 16);
    g.fillStyle = "#140c2e";
    g.fill();
    const lx = 490;
    if (sym === "BTC") btcLogo(g, lx, y + 50, 30);
    else if (sym === "ETH") ethLogo(g, lx, y + 50, 30);
    else credLogo(g, lx, y + 50, 30);
    g.font = `900 40px ${FONT}`;
    g.fillStyle = "#ffffff";
    g.textBaseline = "middle";
    g.fillText(sym, 535, y + 52);
    g.textAlign = "right";
    g.font = `800 40px ${MONO}`;
    g.fillText(k ? (1.2 + Math.sin(t) * 0.02).toFixed(4) : "10,000", W - 70, y + 52);
    g.textAlign = "left";
  }
  g.fillStyle = "#ffd84a";
  g.font = `900 40px ${FONT}`;
  g.fillText("⇅", 700, 340);
  g.font = `800 26px ${FONT}`;
  g.fillStyle = "#7dffb0";
  g.fillText("0.05% fee · 0 slippage on loot pairs", 432, 500);
}

// ---------- Bảng xếp hạng KOL AI (nhân vật hư cấu trong game) ----------

const KOLS: [string, string, string, number, number][] = [
  // tên, handle, nhân vật pixel, người theo dõi (nghìn), mindshare %
  ["KIRA-9", "@kira9_ai", "Ghost Hacker", 1280, 18.4],
  ["Sensei Volt", "@voltsensei", "Ronin Samurai", 964, 14.1],
  ["Vex.AI", "@vex_fixer_ai", "Vex the Fixer", 812, 12.7],
  ["Baron Byte", "@baronbyte", "Legion Officer", 655, 9.9],
  ["Turbo Juno", "@junoturbo", "Neon Racer", 540, 8.3],
  ["Rook GPT", "@rookgpt", "Rook the Smith", 402, 6.6],
];

function drawKol(g: Ctx, t: number) {
  g.fillStyle = "#06021a";
  g.fillRect(0, 0, W, H);
  g.textBaseline = "middle";
  g.font = `900 44px ${FONT}`;
  g.fillStyle = "#ff2a8a";
  g.shadowColor = "#ff2a8a";
  g.shadowBlur = 18;
  g.fillText("HOT AI KOL", 30, 44);
  g.shadowBlur = 0;
  g.font = `700 22px ${MONO}`;
  g.fillStyle = "#9b93c4";
  g.textAlign = "right";
  g.fillText("MINDSHARE · 24H", W - 30, 46);
  g.textAlign = "left";
  const rowH = 76;
  KOLS.forEach(([name, handle, who, fol, ms], k) => {
    const y = 92 + k * (rowH + 6);
    const wob = Math.sin(t * 0.7 + k) * 0.6;
    const share = ms + wob;
    roundRect(g, 20, y, W - 40, rowH, 12);
    g.fillStyle = k === 0 ? "#2a0d3f" : "#110a26";
    g.fill();
    g.font = `900 40px ${FONT}`;
    g.fillStyle = k === 0 ? "#ffd84a" : k < 3 ? "#05f0ff" : "#6c6c8a";
    g.fillText(`${k + 1}`, 42, y + rowH / 2);
    const i = byName(who);
    roundRect(g, 90, y + 6, 64, 64, 10);
    g.save();
    g.clip();
    g.fillStyle = RARITY_COLOR[NFT_ITEMS[i].rarity] + "55";
    g.fillRect(90, y + 6, 64, 64);
    // Cắt nửa trên (đầu, vai) làm ảnh đại diện
    g.imageSmoothingEnabled = false;
    g.drawImage(atlas, (i % NFT_COLS) * NFT_CELL + 14, Math.floor(i / NFT_COLS) * NFT_CELL, 36, 36, 90, y + 6, 64, 64);
    g.restore();
    g.font = `800 30px ${FONT}`;
    g.fillStyle = "#ffffff";
    g.fillText(name, 172, y + 26);
    const nw = g.measureText(name).width;
    g.font = `700 16px ${MONO}`;
    roundRect(g, 182 + nw, y + 14, 34, 24, 6);
    g.fillStyle = "#05f0ff33";
    g.fill();
    g.fillStyle = "#05f0ff";
    g.fillText("AI", 190 + nw, y + 27);
    g.font = `500 20px ${MONO}`;
    g.fillStyle = "#9b93c4";
    g.fillText(`${handle} · ${fol >= 1000 ? (fol / 1000).toFixed(2) + "M" : fol + "K"} followers`, 172, y + 56);
    // Thanh mindshare
    const bx = 620;
    const bw = 230;
    g.fillStyle = "#ffffff14";
    g.fillRect(bx, y + 30, bw, 16);
    const grd = g.createLinearGradient(bx, 0, bx + bw, 0);
    grd.addColorStop(0, "#05f0ff");
    grd.addColorStop(1, "#ff2a8a");
    g.fillStyle = grd;
    g.fillRect(bx, y + 30, (bw * share) / 20, 16);
    g.font = `800 26px ${FONT}`;
    g.fillStyle = "#ffffff";
    g.fillText(`${share.toFixed(1)}%`, bx + bw + 14, y + 38);
    g.fillStyle = wob >= 0 ? "#29e07a" : "#ff3b5c";
    g.fillText(wob >= 0 ? "▲" : "▼", W - 58, y + 38);
  });
}

// ---------- Vị trí biển trên mặt tiền ----------

type Spot = { x: number; y: number; z: number; rot: number; w: number; offset: number };

/** Chọn mặt tiền: toà khối hộp đủ cao, cách xa nhau, bỏ toà đã có bảng NFT khổng lồ */
function pickSpots(): Spot[] {
  const out: Spot[] = [];
  const near = (v: number) => BLOCK_CENTERS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  // Toà cao nhất đã có biển hologram (Visuals HoloAds) và toà mang bảng NFT khổng lồ: bỏ qua
  const holo = new Set(BUILDINGS.filter((b) => b.h > 45 && !b.model).sort((a, b) => b.h - a.h).slice(0, 10));
  const list = BUILDINGS.filter((b) => !b.model && b.h >= 26 && !holo.has(b) && !(Math.abs(b.x - NFT_TOWER.x) < 1 && Math.abs(b.z - NFT_TOWER.z) < 1))
    .map((b) => ({ b, d: Math.hypot(b.x, b.z) }))
    .sort((a, b) => a.d - b.d);
  for (const { b } of list) {
    if (out.length >= 14) break;
    // Mặt tiền nhìn ra đường: phía xa tâm block
    const alongX = Math.abs(b.x - near(b.x)) / b.w > Math.abs(b.z - near(b.z)) / b.d;
    const nx = alongX ? Math.sign(b.x - near(b.x)) || 1 : 0;
    const nz = alongX ? 0 : Math.sign(b.z - near(b.z)) || 1;
    const faceLen = nx ? b.d : b.w;
    const w = Math.min(14, faceLen * 0.84);
    const h = (w * H) / W;
    if (w < 7) continue;
    const y = CITY.SIDEWALK_HEIGHT + Math.min(b.h - h / 2 - 1.5, Math.max(12 + h / 2, Math.min(b.h * 0.55, 24)));
    const x = b.x + nx * (b.w / 2 + 0.3);
    const z = b.z + nz * (b.d / 2 + 0.3);
    if (out.some((s) => Math.hypot(s.x - x, s.z - z) < 22)) continue;
    out.push({ x, y, z, rot: Math.atan2(nx, nz), w, offset: out.length * 3 });
  }
  return out;
}

export const AD_SPOTS = pickSpots();

function Board({ spot, textures }: { spot: Spot; textures: Record<Program, THREE.Texture> }) {
  const h = (spot.w * H) / W;
  const mat = useMemo(() => ledMaterial(textures.clip, [Math.round(spot.w / 0.05), Math.round(h / 0.05)], 1.5), [spot, h, textures]);
  useEffect(() => () => mat.dispose(), [mat]);
  const cur = useRef<Program | null>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    mat.uniforms.time.value = t % 1000;
    const p = programAt(t, spot.offset);
    if (p !== cur.current) {
      mat.uniforms.prev.value = cur.current ? textures[cur.current] : textures[p];
      mat.uniforms.map.value = textures[p];
      mat.uniforms.mixT.value = 0;
      cur.current = p;
    }
    mat.uniforms.mixT.value = Math.min(1, mat.uniforms.mixT.value + dt / 0.9);
  });
  return (
    <group position={[spot.x, spot.y, spot.z]} rotation={[0, spot.rot, 0]}>
      <mesh material={mat} position={[0, 0, 0.06]}>
        <planeGeometry args={[spot.w, h]} />
      </mesh>
    </group>
  );
}

/** Khung kim loại và viền neon của mọi biển gộp thành hai lưới (hai lượt vẽ cho cả thành phố) */
function BoardFrames() {
  const { frames, neon } = useMemo(() => {
    const fr: THREE.BufferGeometry[] = [];
    const ne: THREE.BufferGeometry[] = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    const tint = (g: THREE.BufferGeometry, c: [number, number, number]) => {
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) col.set(c, i * 3);
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      return g;
    };
    for (const sp of AD_SPOTS) {
      const h = (sp.w * H) / W;
      m.compose(new THREE.Vector3(sp.x, sp.y, sp.z), q.setFromAxisAngle(up, sp.rot), one);
      const box = (w: number, hh: number, d: number, y: number, z: number) => new THREE.BoxGeometry(w, hh, d).translate(0, y, z).applyMatrix4(m);
      fr.push(box(sp.w + 0.4, h + 0.4, 0.35, 0, -0.14));
      ne.push(tint(box(sp.w + 0.4, 0.09, 0.09, h / 2 + 0.26, 0.05), [0.2, 2.4, 3]));
      ne.push(tint(box(sp.w + 0.4, 0.09, 0.09, -h / 2 - 0.26, 0.05), [3, 0.4, 1.6]));
    }
    const frames = mergeGeometries(fr)!;
    const neon = mergeGeometries(ne)!;
    [...fr, ...ne].forEach((g) => g.dispose());
    return { frames, neon };
  }, []);
  useEffect(
    () => () => {
      frames.dispose();
      neon.dispose();
    },
    [frames, neon],
  );
  return (
    <>
      <mesh geometry={frames}>
        <meshStandardMaterial color="#14141f" metalness={0.85} roughness={0.35} />
      </mesh>
      <mesh geometry={neon}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
    </>
  );
}

export function CityAds() {
  const progs = useMemo(() => {
    const make = () => {
      // Vẽ theo toạ độ 1024×576 nhưng canvas thật 640×360: đủ 3 texel cho mỗi chấm LED, tải lên GPU nhẹ hơn 2.5 lần
      const c = document.createElement("canvas");
      c.width = TEX_W;
      c.height = Math.round((TEX_W * H) / W);
      const g = c.getContext("2d")! as Ctx;
      g.scale(TEX_W / W, TEX_W / W);
      g.keepText = true;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return { g, t };
    };
    return { nft: make(), clip: make(), coin: make(), hood: make(), swap: make(), kol: make() } as Record<Program, { g: Ctx; t: THREE.Texture }>;
  }, []);
  const textures = useMemo(() => Object.fromEntries(Object.entries(progs).map(([k, v]) => [k, v.t])) as Record<Program, THREE.Texture>, [progs]);
  const st = useRef({ ready: false, clip: 0, slow: 0, coin: 0, page: -1, slot: -1, on: new Set<Program>() });
  useEffect(() => {
    atlasReady.then(() => (st.current.ready = true));
    return () => Object.values(progs).forEach((p) => p.t.dispose());
  }, [progs]);
  useFrame(({ clock }) => {
    const s = st.current;
    if (!s.ready || !atlas.complete) return;
    const t = clock.elapsedTime;
    // Chỉ vẽ lại chương trình đang chiếu trên ít nhất một biển (tính lại mỗi giây, lịch đổi theo giây nguyên)
    const slot = Math.floor(t);
    if (slot !== s.slot) {
      s.slot = slot;
      s.on.clear();
      for (const sp of AD_SPOTS) s.on.add(programAt(t, sp.offset)).add(programAt(t - 1, sp.offset));
    }
    const on = s.on;
    // Clip chạy 15 khung/giây; quảng cáo động 8 khung/giây; bảng giá 2 lần/giây; thẻ NFT đổi theo lượt
    if (on.has("clip") && t - s.clip > 1 / 15) {
      s.clip = t;
      drawClip(progs.clip.g, t);
      progs.clip.t.needsUpdate = true;
    }
    if (t - s.slow > 1 / 8) {
      s.slow = t;
      for (const [k, draw] of [
        ["hood", drawHood],
        ["swap", drawSwap],
        ["kol", drawKol],
      ] as const) {
        if (!on.has(k)) continue;
        draw(progs[k].g, t);
        progs[k].t.needsUpdate = true;
      }
    }
    if (t - s.coin > 0.5) {
      s.coin = t;
      COINS.forEach(stepCoin);
      if (on.has("coin")) {
        drawCoin(progs.coin.g);
        progs.coin.t.needsUpdate = true;
      }
    }
    const page = Math.floor(t / (SLOT_SECONDS * 2));
    if (page !== s.page) {
      s.page = page;
      drawNft(progs.nft.g, page);
      progs.nft.t.needsUpdate = true;
    }
  });
  return (
    <group>
      {AD_SPOTS.map((s, i) => (
        <Board key={i} spot={s} textures={textures} />
      ))}
      <BoardFrames />
    </group>
  );
}
