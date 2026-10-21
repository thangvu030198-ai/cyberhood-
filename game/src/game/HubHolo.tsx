// Sảnh: bàn sa bàn cạnh cổng nhiệm vụ chiếu hologram từng map của mùa (đổi lần lượt), và tàu vũ trụ
// tuần tra vòng trên trời. Mô hình sa bàn là model Meshy người chơi tải lên.

import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useFitted } from "./Showcase";
import { MISSION_GATE } from "./config";
import type { ExtraModel } from "./assets";

/** Bàn sa bàn đặt chếch bên phải cổng (nhìn từ phía người chơi bước ra) */
export const HOLO_TABLE = { x: MISSION_GATE.x + 6.5, z: MISSION_GATE.z + 2.5 };

/** Sa bàn hologram: model + tên map nó đại diện */
const DIORAMAS: { model: ExtraModel; label: string }[] = [
  { model: "mx_dr_dio_neon", label: "KHU CÁCH LY · NEON CITY" },
  { model: "mx_dr_dio_mansion", label: "KHÁCH SẠN MA" },
  { model: "mx_dr_dio_rift", label: "HẺM NÚI WARZONE" },
  { model: "mx_dr_dio_towers", label: "PHÁO ĐÀI CITADEL" },
  { model: "mx_dr_dio_ny", label: "KHU SĂN NEON" },
  { model: "mx_dr_dio_realms", label: "GIÁO XỨ NEON" },
  { model: "mx_dr_dio_uber", label: "ĐƯỜNG ĐUA NEON LOOP" },
];

function Table() {
  const { root } = useFitted("mx_dr_holotable", 1.6, "height", 0.45);
  return <primitive object={root} />;
}

/** Một sa bàn hologram: tự sáng, hơi trong, xoay chậm, hiện dần khi tới lượt */
function Diorama({ model, active }: { model: ExtraModel; active: boolean }) {
  const { root } = useFitted(model, 2.6, "longest", 0.9);
  const obj = useMemo(() => {
    const c = root.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      // Sa bàn không có texture (trắng): nhuộm xanh hologram
      if (!mat.map) {
        mat.color.set("#7fe8ff");
        mat.emissive.set("#2ab8ff");
        mat.emissiveIntensity = 1.4;
      }
      m.material = mat;
    });
    return c;
  }, [root]);
  const ref = useRef<THREE.Group>(null);
  const fade = useRef(0);
  useFrame(({ clock }, dt) => {
    const g = ref.current;
    if (!g) return;
    fade.current = THREE.MathUtils.damp(fade.current, active ? 1 : 0, 3, dt);
    g.visible = fade.current > 0.01;
    g.rotation.y = clock.elapsedTime * 0.35;
    g.position.y = 2.1 + Math.sin(clock.elapsedTime * 1.2) * 0.06;
    g.scale.setScalar(0.85 + fade.current * 0.15);
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) (m.material as THREE.MeshStandardMaterial).opacity = fade.current * 0.88;
    });
  });
  return (
    <group ref={ref}>
      <primitive object={obj} />
    </group>
  );
}

/** Nhãn hologram vẽ bằng canvas (không tải font ngoài) */
function Label({ text }: { text: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.textAlign = "center";
    g.shadowColor = "#05d9e8";
    g.shadowBlur = 14;
    g.fillStyle = "#9ff3ff";
    g.font = "700 30px monospace";
    g.fillText("SA BÀN MÙA S1", 256, 46);
    g.font = "700 36px monospace";
    g.fillStyle = "#ffffff";
    g.fillText(text, 256, 100);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text]);
  return (
    <sprite position={[0, 3.8, 0]} scale={[3.2, 0.8, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

function HoloTable() {
  const [i, setI] = useState(0);
  const last = useRef(0);
  const beam = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (t - last.current > 6) {
      last.current = t;
      setI((n) => (n + 1) % DIORAMAS.length);
    }
    if (beam.current) (beam.current.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(t * 3) * 0.04;
  });
  return (
    <group position={[HOLO_TABLE.x, 0.15, HOLO_TABLE.z]} rotation-y={-0.5}>
      <Suspense fallback={null}>
        <Table />
      </Suspense>
      {/* Chùm sáng chiếu từ mặt bàn lên */}
      <mesh ref={beam} position={[0, 2.1, 0]}>
        <cylinderGeometry args={[1.5, 0.9, 1.6, 32, 1, true]} />
        <meshBasicMaterial color={[0.4, 1.8, 2.6]} transparent opacity={0.16} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      {DIORAMAS.map((d, k) => (
        <Suspense key={d.model} fallback={null}>
          <Diorama model={d.model} active={k === i} />
        </Suspense>
      ))}
      <Label text={DIORAMAS[i].label} />
    </group>
  );
}

/** Tàu vũ trụ bay vòng trên quảng trường, chao nghiêng theo vòng lượn */
function PatrolShip() {
  const { root } = useFitted("mx_dr_ship", 9, "longest", 0.5);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime * 0.12;
    const r = 46;
    g.position.set(Math.cos(t) * r, 34 + Math.sin(t * 3) * 2, -10 + Math.sin(t) * r);
    // Mũi tàu (phía -X của model) hướng theo tiếp tuyến vòng bay
    g.rotation.set(0, -t + Math.PI, -0.35);
  });
  return (
    <group ref={ref}>
      <primitive object={root} />
    </group>
  );
}

export function HubHolo() {
  return (
    <group>
      <HoloTable />
      <Suspense fallback={null}>
        <PatrolShip />
      </Suspense>
    </group>
  );
}
