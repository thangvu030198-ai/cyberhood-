// Bảng LED ở sảnh (Vùng An toàn): logo CYBERHOOD dạng LED chấm có dải chữ chạy, và bảng LED nhiệm vụ
// hiện tiến độ ngày / tuần / tháng theo thời gian thực. Texture vẽ bằng canvas, không cần file ảnh.

import { sign } from "../i18n/i18n";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CITY, MISSION_GATE } from "./config";
import { MISSIONS, isClaimed, isDone, periodEnds } from "./missions";
import { useMissions } from "./missionStore";

/** Bảng LED nhiệm vụ: vỉa hè phía đông, đối diện bảng hợp đồng */
export const MISSION_BOARD = { x: 10.6, z: 1.5, reach: 3.4 };

const SIDE = 13.1;
/** Bảng logo gắn trên mặt tiền hai bên đại lộ qua Hub và trên cổng nhiệm vụ: [x, y, z, góc quay, rộng] */
const LOGO_BOARDS: [number, number, number, number, number][] = [
  [-SIDE, 8.5, -6, Math.PI / 2, 9],
  [SIDE, 9.5, 12, -Math.PI / 2, 9],
  [-SIDE, 10, 26, Math.PI / 2, 7],
  [SIDE, 8, -14, -Math.PI / 2, 7],
  // Trên cổng torii nhiệm vụ, quay về phía điểm xuất phát
  [0, 9.6, -26.2, 0, 7.5],
  // Cổng torii phía nam, quay về phía Hub
  [0, 9.6, 38.2, Math.PI, 7.5],
];

/** Lưới chấm LED phủ lên canvas: mỗi điểm ảnh LED là một chấm tròn có viền tối */
function ledify(g: CanvasRenderingContext2D, w: number, h: number, cell = 6) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = (x % cell) - cell / 2 + 0.5;
      const cy = (y % cell) - cell / 2 + 0.5;
      const r = Math.hypot(cx, cy) / (cell / 2);
      const k = r > 0.85 ? 0.12 : r > 0.6 ? 0.6 : 1;
      const i = (y * w + x) * 4;
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
  }
  g.putImageData(img, 0, 0);
}

function glowText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, blur = 24) {
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.shadowBlur = 0;
  g.fillStyle = "#ffffff";
  g.globalAlpha = 0.35;
  g.fillText(text, x, y);
  g.globalAlpha = 1;
}

/** Logo CYBERHOOD: CYBER xanh neon, HOOD hồng neon, mũi tên vàng xuyên qua chữ H */
function logoTexture() {
  const w = 1024;
  const h = 384;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#0a0420");
  bg.addColorStop(1, "#1a0630");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.font = "900 150px 'Chakra Petch', 'Arial Black', sans-serif";
  g.textBaseline = "middle";
  const cyberW = g.measureText("CYBER").width;
  const hoodW = g.measureText("HOOD").width;
  const x0 = (w - cyberW - hoodW) / 2;
  const y = h * 0.45;
  glowText(g, "CYBER", x0, y, "#05f0ff");
  glowText(g, "HOOD", x0 + cyberW, y, "#ff2a8a");
  // Mũi tên vàng cắm chéo qua chữ H
  const hx = x0 + cyberW + g.measureText("H").width / 2;
  g.save();
  g.translate(hx, y);
  g.rotate(-0.42);
  g.shadowColor = "#ffc23d";
  g.shadowBlur = 20;
  g.strokeStyle = "#ffd75a";
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(-120, 0);
  g.lineTo(110, 0);
  g.stroke();
  g.fillStyle = "#ffd75a";
  g.beginPath();
  g.moveTo(140, 0);
  g.lineTo(100, -20);
  g.lineTo(100, 20);
  g.closePath();
  g.fill();
  for (const dy of [-1, 1]) {
    g.beginPath();
    g.moveTo(-120, 0);
    g.lineTo(-150, dy * 18);
    g.lineTo(-135, 0);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.font = "700 34px 'Chakra Petch', Arial, sans-serif";
  g.textAlign = "center";
  glowText(g, "NEON CITY · HUNTERS WANTED", w / 2, h * 0.82, "#ffd75a", 12);
  ledify(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Dải chữ chạy dưới logo */
function tickerTexture() {
  const w = 2048;
  const h = 96;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#080214";
  g.fillRect(0, 0, w, h);
  g.font = "700 46px 'Chakra Petch', Arial, sans-serif";
  g.textBaseline = "middle";
  const msg = "★ NHIỆM VỤ NGÀY · TUẦN · THÁNG: NHẤN N  ★ QUA CỔNG TORII PHÍA BẮC ĐỂ VÀO MÀN  ★ RƯƠNG GIẤU CẦN CHÌA RƯƠNG  ★ ĐIỂM HUNTER CHIA QUỸ THƯỞNG TUẦN  ";
  glowText(g, msg, 10, h / 2, "#ffd75a", 10);
  ledify(g, w, h, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function LogoBoard({ position, rotationY, width, logo, ticker }: { position: [number, number, number]; rotationY: number; width: number; logo: THREE.Texture; ticker: THREE.Texture }) {
  const h = width * 0.375;
  const tickerH = width * 0.07;
  const flicker = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    // Nhấp nháy rất nhẹ như đèn LED thật
    if (flicker.current) flicker.current.color.setScalar(1.25 + Math.sin(clock.elapsedTime * 23 + position[2]) * 0.03);
  });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[width + 0.4, h + tickerH + 0.5, 0.14]} />
        <meshStandardMaterial color="#14141c" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, tickerH / 2 + 0.05, 0]}>
        <planeGeometry args={[width, h]} />
        <meshBasicMaterial ref={flicker} map={logo} toneMapped={false} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.02, 0]}>
        <planeGeometry args={[width, tickerH]} />
        <meshBasicMaterial map={ticker} toneMapped={false} color={[1.2, 1.2, 1.2]} />
      </mesh>
      {/* Viền neon */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[0, s * ((h + tickerH) / 2 + 0.2), 0.01]}>
          <boxGeometry args={[width + 0.4, 0.06, 0.06]} />
          <meshBasicMaterial color={s > 0 ? [0.2, 2.6, 3] : [3, 0.4, 1.6]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Bảng LED nhiệm vụ: vẽ lại mỗi giây theo tiến độ */
function MissionBoard() {
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 1024;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex };
  }, []);
  const state = useMissions((s) => s.state);
  const last = useRef(0);
  const draw = () => {
    const g = canvas.getContext("2d")!;
    const w = canvas.width;
    const H = canvas.height;
    g.fillStyle = "#07031a";
    g.fillRect(0, 0, w, H);
    g.textBaseline = "middle";
    g.font = "900 64px 'Chakra Petch', Arial, sans-serif";
    glowText(g, "NHIỆM VỤ", 36, 64, "#05f0ff", 18);
    g.font = "700 30px 'Chakra Petch', Arial, sans-serif";
    glowText(g, `ĐIỂM HUNTER TUẦN  ${state.hunterPoints.points}`, 36, 128, "#ffd75a", 10);
    let y = 190;
    const sections: ["daily" | "weekly" | "monthly", string][] = [
      ["daily", "TODAY · 本日"],
      ["weekly", "THIS WEEK · 今週"],
      ["monthly", "THIS MONTH · 今月"],
    ];
    for (const [p, label] of sections) {
      const ms = periodEnds(p, new Date()).getTime() - Date.now();
      const left = ms > 48 * 3.6e6 ? `${Math.floor(ms / 8.64e7)} DAYS` : `${Math.floor(ms / 3.6e6)}H ${Math.floor((ms % 3.6e6) / 6e4)}M`;
      g.font = "700 34px 'Chakra Petch', Arial, sans-serif";
      glowText(g, label, 36, y, "#ff2a8a", 12);
      g.font = "500 24px 'JetBrains Mono', monospace";
      g.fillStyle = "#8f86ad";
      g.textAlign = "right";
      g.fillText(`RESET IN ${left}`, w - 36, y);
      g.textAlign = "left";
      y += 48;
      for (const m of MISSIONS.filter((x) => x.period === p)) {
        const prog = state[p].progress[m.id] ?? 0;
        const done = isDone(state, m);
        const claimed = isClaimed(state, m);
        g.font = "600 26px 'Chakra Petch', Arial, sans-serif";
        g.fillStyle = claimed ? "#5d5875" : done ? "#7dffb0" : "#e9e6f5";
        g.fillText(`${claimed ? "✓" : done ? "!" : "·"} ${sign(m.title)}`, 36, y);
        g.textAlign = "right";
        g.fillText(`${prog}/${m.goal}`, w - 36, y);
        g.textAlign = "left";
        // Thanh tiến độ
        g.fillStyle = "rgba(255,255,255,0.1)";
        g.fillRect(36, y + 20, w - 72, 6);
        g.fillStyle = done ? "#7dffb0" : "#05d9e8";
        g.fillRect(36, y + 20, (w - 72) * Math.min(1, prog / m.goal), 6);
        y += 54;
      }
      y += 18;
    }
    g.font = "700 28px 'Chakra Petch', Arial, sans-serif";
    g.textAlign = "center";
    glowText(g, "NHẤN E HOẶC N ĐỂ NHẬN THƯỞNG", w / 2, H - 46, "#ffd75a", 10);
    g.textAlign = "left";
    ledify(g, w, H, 4);
    tex.needsUpdate = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [state]);
  useFrame(({ clock }) => {
    // Đồng hồ đếm ngược trên bảng: vẽ lại mỗi 30 giây
    if (clock.elapsedTime - last.current > 30) {
      last.current = clock.elapsedTime;
      draw();
    }
  });
  const W = 3.2;
  const H = W * (4 / 3);
  return (
    <group position={[MISSION_BOARD.x, CITY.SIDEWALK_HEIGHT, MISSION_BOARD.z]} rotation={[0, -Math.PI / 2, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 + 0.12), H / 2 + 0.5, -0.05]}>
          <boxGeometry args={[0.14, H + 1, 0.14]} />
          <meshStandardMaterial color="#1b1b26" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, H / 2 + 0.9, -0.08]}>
        <boxGeometry args={[W + 0.2, H + 0.2, 0.1]} />
        <meshStandardMaterial color="#0e0e16" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, H / 2 + 0.9, 0]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={[1.3, 1.3, 1.3]} />
      </mesh>
      <mesh position={[0, H + 1.05, 0.02]}>
        <boxGeometry args={[W + 0.2, 0.06, 0.06]} />
        <meshBasicMaterial color={[0.2, 2.6, 3]} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Xoáy cổng dịch chuyển dưới cổng torii nhiệm vụ */
function portalTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.25, "rgba(200,120,255,0.8)");
  grad.addColorStop(0.6, "rgba(90,40,255,0.45)");
  grad.addColorStop(1, "rgba(20,0,60,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  // Các vệt xoắn
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 3;
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = k * (Math.PI / 3) + t * 5;
      const r = t * s * 0.48;
      const x = s / 2 + Math.cos(a) * r;
      const y = s / 2 + Math.sin(a) * r;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function GatePortal() {
  const tex = useMemo(portalTexture, []);
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (a.current) a.current.rotation.z = t * 0.8;
    if (b.current) {
      b.current.rotation.z = -t * 1.3;
      b.current.scale.setScalar(0.8 + Math.sin(t * 2) * 0.05);
    }
  });
  return (
    <group position={[MISSION_GATE.x, 3.3, MISSION_GATE.z]}>
      <mesh ref={a}>
        <circleGeometry args={[2.6, 48]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} color={[1.6, 1.2, 2.4]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={b} position={[0, 0, 0.05]}>
        <circleGeometry args={[2.6, 48]} />
        <meshBasicMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} color={[0.6, 1.6, 2.4]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -3.1, 0]}>
        <ringGeometry args={[2.2, 2.7, 48]} />
        <meshBasicMaterial color={[2, 0.8, 3]} toneMapped={false} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

export function LedBoards() {
  const logo = useMemo(logoTexture, []);
  const ticker = useMemo(tickerTexture, []);
  useFrame((_, dt) => {
    ticker.offset.x = (ticker.offset.x + dt * 0.06) % 1;
  });
  return (
    <group>
      {LOGO_BOARDS.map(([x, y, z, r, w], i) => (
        <LogoBoard key={i} position={[x, y, z]} rotationY={r} width={w} logo={logo} ticker={ticker} />
      ))}
      <MissionBoard />
      <GatePortal />
    </group>
  );
}
