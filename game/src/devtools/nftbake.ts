// Xưởng nướng ảnh pixel cho album NFT trên bảng LED sảnh (chỉ dùng khi phát triển):
// nạp từng model, chụp góc 3/4 với đèn viền neon, hạ độ phân giải, giảm màu theo bảng cyberpunk, viền đen.
// Kết quả là một atlas PNG (window.__atlas) để nhúng vào src/game/nftAtlas.ts.
import * as THREE from "three";
import { extraModel, type ExtraModel } from "../game/assets";
import { NFT_ITEMS, NFT_CELL } from "../game/nftAlbum";

const PX = NFT_CELL;
// ?raw=512: xuất ảnh render gốc từng món (nền trong suốt) làm đầu vào cho dịch vụ vẽ pixel bên ngoài
const RAW = Number(new URLSearchParams(location.search).get("raw")) || 0;
const SS = RAW ? RAW / PX : 4; // siêu lấy mẫu trước khi hạ xuống PX
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(PX * SS, PX * SS);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.1;

const PALETTE = [
  "#0b0618", "#1d0b3a", "#3a1466", "#6b1f8f", "#b5179e", "#ff2a8a", "#ff7ac0", "#ffd6f0",
  "#05d9e8", "#00f5d4", "#7dfcff", "#0d3b66", "#1f6feb", "#f7ff4a", "#ffb800", "#ff6b1a",
  "#c1121f", "#5a2a1a", "#9a6b4a", "#e9d8c4", "#2d6a4f", "#52b788", "#b7e4c7", "#ffffff",
  "#3d3d5c", "#6c6c8a", "#a8a8c8", "#141428",
].map((h) => new THREE.Color(h));

function nearest(r: number, g: number, b: number) {
  let best = 0;
  let bd = 1e9;
  PALETTE.forEach((c, i) => {
    const d = (c.r * 255 - r) ** 2 * 0.3 + (c.g * 255 - g) ** 2 * 0.59 + (c.b * 255 - b) ** 2 * 0.11;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return PALETTE[best];
}

async function shoot(model: string, node: string | undefined, yaw: number, anim: number, roll = 0, bright = 1) {
  const gltf = await extraModel(model as ExtraModel);
  const src = node ? gltf.scene.getObjectByName(node)! : gltf.scene;
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const obj = node ? src.clone(true) : src;
  obj.position.set(0, 0, 0);
  root.add(obj);
  scene.add(root);
  if (gltf.animations.length && !node) {
    const mixer = new THREE.AnimationMixer(obj);
    mixer.clipAction(gltf.animations[0]).play();
    mixer.update(anim);
  }
  root.rotation.set(0, yaw, 0);
  if (roll) root.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), roll);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z) * 0.5;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.01, r * 20);
  cam.position.copy(c).add(new THREE.Vector3(0, r * 0.35, r * 4));
  cam.lookAt(c);
  scene.add(new THREE.HemisphereLight("#bfe6ff", "#3a1050", 2.6));
  const key = new THREE.DirectionalLight("#ffffff", 3.2);
  key.position.set(r * 2, r * 3, r * 4).add(c);
  scene.add(key);
  const rimA = new THREE.DirectionalLight("#00f0ff", 3.5);
  rimA.position.set(-r * 4, r, -r * 2).add(c);
  scene.add(rimA);
  const rimB = new THREE.DirectionalLight("#ff2a8a", 3.5);
  rimB.position.set(r * 4, r * 0.5, -r * 3).add(c);
  scene.add(rimB);
  renderer.setClearColor(0x000000, 0);
  renderer.render(scene, cam);
  // Hạ độ phân giải: lấy trung bình khối SS×SS, giảm màu, viền đen quanh hình
  const big = document.createElement("canvas");
  big.width = big.height = PX * SS;
  big.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
  if (RAW) return big;
  const sm = document.createElement("canvas");
  sm.width = sm.height = PX;
  const g = sm.getContext("2d")!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.drawImage(big, 0, 0, PX, PX);
  const img = g.getImageData(0, 0, PX, PX);
  const d = img.data;
  const solid = new Uint8Array(PX * PX);
  for (let i = 0; i < PX * PX; i++) {
    const a = d[i * 4 + 3];
    if (a < 110) {
      d[i * 4 + 3] = 0;
      continue;
    }
    solid[i] = 1;
    const k = (255 / a) * 1.35 * bright;
    const col = nearest(Math.min(255, d[i * 4] * k), Math.min(255, d[i * 4 + 1] * k), Math.min(255, d[i * 4 + 2] * k));
    d[i * 4] = col.r * 255;
    d[i * 4 + 1] = col.g * 255;
    d[i * 4 + 2] = col.b * 255;
    d[i * 4 + 3] = 255;
  }
  for (let y = 0; y < PX; y++)
    for (let x = 0; x < PX; x++) {
      const i = y * PX + x;
      if (solid[i]) continue;
      const nb = (x > 0 && solid[i - 1]) || (x < PX - 1 && solid[i + 1]) || (y > 0 && solid[i - PX]) || (y < PX - 1 && solid[i + PX]);
      if (nb) {
        d[i * 4] = 8;
        d[i * 4 + 1] = 4;
        d[i * 4 + 2] = 20;
        d[i * 4 + 3] = 255;
      }
    }
  g.putImageData(img, 0, 0);
  scene.traverse((o) => (o as THREE.Mesh).geometry && o !== obj && 0);
  return sm;
}

async function main() {
  const cols = 6;
  const rows = Math.ceil(NFT_ITEMS.length / cols);
  const out = document.getElementById("out") as HTMLCanvasElement;
  out.width = cols * PX;
  out.height = rows * PX;
  out.style.width = `${cols * PX * 3}px`;
  out.style.imageRendering = "pixelated";
  const g = out.getContext("2d")!;
  const raw: string[] = [];
  for (let i = 0; i < NFT_ITEMS.length; i++) {
    const it = NFT_ITEMS[i];
    if (RAW) {
      const s = await shoot(it.model, it.node, it.yaw ?? -0.6, it.anim ?? 0.35, it.roll ?? 0, it.bright ?? 1).catch(() => null);
      raw.push(s ? s.toDataURL("image/png") : "");
      continue;
    }
    try {
      const s = await shoot(it.model, it.node, it.yaw ?? -0.6, it.anim ?? 0.35, it.roll ?? 0, it.bright ?? 1);
      g.drawImage(s, (i % cols) * PX, Math.floor(i / cols) * PX);
    } catch (e) {
      console.error("bake fail", it.model, e);
    }
  }
  if (RAW) (window as unknown as { __raw: string[] }).__raw = raw;
  else (window as unknown as { __atlas: string }).__atlas = out.toDataURL("image/png");
}
main();
