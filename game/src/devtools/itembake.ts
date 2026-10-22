// Xưởng render vật phẩm mới (chỉ dùng khi phát triển): nạp GLB theo danh sách ?files=a.glb,b.glb trong /_bake/,
// chụp góc 3/4 với đèn viền neon, nền trong suốt, 512px. Vũ khí dài tự xoay nằm chéo khung.
// Kết quả (window.__raw) là đầu vào cho PixelLab image-to-pixelart.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const SIZE = 512;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 2.1;
const loader = new GLTFLoader();

async function shoot(url: string) {
  const gltf = await loader.loadAsync(url);
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.add(gltf.scene);
  scene.add(root);
  root.rotation.set(0, -0.6, 0);
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root, true);
  let size = box.getSize(new THREE.Vector3());
  const long = Math.max(size.x, size.y, size.z);
  const short = Math.min(size.x, size.y);
  // Vũ khí dài: đặt trục dài theo đường chéo khung
  if (long / Math.max(short, 1e-3) > 2.2) {
    if (size.y >= size.x) root.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -0.785);
    else root.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), 0.785);
    root.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(root, true);
    size = box.getSize(new THREE.Vector3());
  }
  const c = box.getCenter(new THREE.Vector3());
  const r = Math.max(size.x, size.y) * 0.53;
  const cam = new THREE.OrthographicCamera(-r, r, r, -r, 0.01, r * 40);
  cam.position.copy(c).add(new THREE.Vector3(0, r * 0.35, Math.max(r, size.z) * 4));
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
  const url2 = renderer.domElement.toDataURL("image/png");
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    mats.forEach((mt) => { Object.values(mt).forEach((v) => (v as THREE.Texture)?.isTexture && (v as THREE.Texture).dispose()); mt.dispose(); });
  });
  return url2;
}

async function main() {
  const files = (new URLSearchParams(location.search).get("files") || "").split(",").filter(Boolean);
  const raw: string[] = [];
  for (const f of files) {
    try {
      raw.push(await shoot(`/_bake/${f}`));
    } catch (e) {
      console.error("bake fail", f, e);
      raw.push("");
    }
  }
  (window as unknown as { __raw: string[] }).__raw = raw;
}
main();
