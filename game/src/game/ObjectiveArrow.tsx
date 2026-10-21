import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { TUNING } from "../traffic/tuning";
import { currentObjective } from "./objectives";
import { handles } from "./refs";
import { useGame } from "./store";

const O = TUNING.objective;

/** Mũi tên neon lơ lửng cạnh nhân vật (hoặc trên nóc xe đang lái), luôn chỉ về mục tiêu nhiệm vụ */
export function ObjectiveArrow() {
  const ref = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(() => {
    // Mũi tên dẹt hình chevron, mũi nhọn hướng +Z
    const s = new THREE.Shape();
    s.moveTo(0, 0.55);
    s.lineTo(0.42, -0.1);
    s.lineTo(0.16, -0.1);
    s.lineTo(0.16, -0.5);
    s.lineTo(-0.16, -0.5);
    s.lineTo(-0.16, -0.1);
    s.lineTo(-0.42, -0.1);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false });
    g.translate(0, 0, -0.04);
    // Nằm ngang: trục +Y của hình (mũi nhọn) → trục +Z thế giới, để rotation.y = yaw chỉ đúng về mục tiêu
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const color = useMemo(() => new THREE.Color(), []);
  const last = useRef(0);
  const target = useRef<ReturnType<typeof currentObjective>>(null);

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    // Tìm mục tiêu 5 lần mỗi giây là đủ
    if (t - last.current > 0.2) {
      last.current = t;
      target.current = currentObjective();
    }
    const s = useGame.getState();
    const car = s.mode === "drive" && s.carId !== null ? handles.cars.get(s.carId) : null;
    const base = car ? car.currPos : handles.player?.currPos;
    const obj = target.current;
    if (!base || !obj || s.flatlinedAt !== null || s.location !== "city") {
      g.visible = false;
      return;
    }
    const dx = obj.x - base.x;
    const dz = obj.z - base.z;
    const d = Math.hypot(dx, dz);
    g.visible = d > O.hideWithin;
    if (!g.visible) return;
    const yaw = Math.atan2(dx, dz);
    const r = car ? 0 : O.arrowDistance;
    const y = car ? base.y + 2.3 : base.y + O.arrowHeight - 0.9;
    g.position.set(base.x + Math.sin(yaw) * r, y + Math.sin(t * 3) * 0.06, base.z + Math.cos(yaw) * r);
    g.rotation.y = yaw;
    g.scale.setScalar(car ? 1.4 : 0.7);
    if (mat.current) {
      color.set(obj.color).multiplyScalar(2.2 + Math.sin(t * 4) * 0.4);
      mat.current.color.copy(color);
    }
  });

  return (
    <group ref={ref} visible={false}>
      <mesh geometry={geo} renderOrder={10}>
        <meshBasicMaterial ref={mat} toneMapped={false} transparent opacity={0.9} depthTest={false} />
      </mesh>
    </group>
  );
}
