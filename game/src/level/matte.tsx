// Phông nền vẽ sẵn (matte painting) từ ảnh mẫu của chủ dự án: một tấm ảnh phủ kín khung hình, gắn theo camera,
// vẽ trước mọi thứ (không ghi chiều sâu) nên cả màn 3D nằm đè lên. Trôi chậm hơn đường chạy (parallax) và lặp
// đối xứng để map dài bao nhiêu cũng không lộ mép. Kiểu nền của game 2D/2.5D đời PS1–PS2.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

const DIST = 40;

export function Matte({ file, parallax = 0.25, scroll = "x" }: { file: string; parallax?: number; scroll?: "x" | "top" }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const tex = useMemo(() => {
    const t = new THREE.TextureLoader().load(`mattes/${file}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
    t.anisotropy = 4;
    return t;
  }, [file]);
  const ref = useRef<THREE.Mesh>(null);
  const dir = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    camera.getWorldDirection(dir);
    m.position.copy(camera.position).addScaledVector(dir, DIST);
    m.quaternion.copy(camera.quaternion);
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * DIST * 1.06;
    const img = tex.image as HTMLImageElement | undefined;
    const aspect = img?.width ? img.width / img.height : 16 / 9;
    // Phủ kín khung hình: theo chiều nào thiếu thì phóng theo chiều đó (giữ tỉ lệ ảnh)
    const w = Math.max(h * camera.aspect, h * aspect);
    const hh = w / aspect;
    m.scale.set(w, Math.max(h, hh), 1);
    // Trôi theo vị trí camera chậm hơn cảnh trước
    if (scroll === "x") tex.offset.x = (camera.position.x * parallax) / w;
    else tex.offset.y = (camera.position.x * parallax) / hh;
  });
  return (
    <mesh ref={ref} renderOrder={-100} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} depthTest={false} depthWrite={false} fog={false} toneMapped={false} />
    </mesh>
  );
}
