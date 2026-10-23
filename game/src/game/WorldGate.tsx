// Vào Công thành / Raid: bản đồ nặng (texture, model quân, Leviathan) tải không đồng bộ.
// Trong lúc tải, giữ nhân vật đứng yên ở điểm vào trận và báo "Đang tải bản đồ"; tải xong mới thả.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { handles } from "./refs";
import { useGame } from "./store";

/** Đặt cuối cùng bên trong Suspense của bản đồ: chỉ gắn khi mọi phần anh em đã tải xong */
export function WorldReady() {
  useEffect(() => {
    useGame.setState({ worldReady: true });
    return () => useGame.setState({ worldReady: false });
  }, []);
  return null;
}

/** Ghim nhân vật tại chỗ cho tới khi bản đồ sẵn sàng */
export function HoldUntilReady() {
  const hold = useRef<THREE.Vector3 | null>(null);
  useFrame(() => {
    const s = useGame.getState();
    const body = handles.player?.body;
    const waiting = (s.location === "siege" || s.location === "raid") && !s.worldReady;
    if (!waiting || !body) {
      hold.current = null;
      return;
    }
    const t = body.translation();
    // Điểm giữ = nơi vừa được dịch chuyển tới (lấy ở frame đầu tiên của lượt chờ)
    if (!hold.current) hold.current = new THREE.Vector3(t.x, Math.max(t.y, 1.4), t.z);
    body.setTranslation(hold.current, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  });
  return null;
}

/** Lớp phủ DOM khi đang chờ bản đồ */
export function WorldLoading() {
  const waiting = useGame((s) => (s.location === "siege" || s.location === "raid") && !s.worldReady);
  if (!waiting) return null;
  return (
    <div className="world-loading" role="status" aria-live="polite">
      <span className="world-loading__spin" aria-hidden />
      <span>Đang tải bản đồ…</span>
    </div>
  );
}
