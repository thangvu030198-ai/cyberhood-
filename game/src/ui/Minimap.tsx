import { useEffect, useRef } from "react";
import { BUILDINGS } from "../game/City";
import { drones } from "../game/Enemies";
import { fx } from "../game/Effects";
import { handles } from "../game/refs";
import { SHOP_POS } from "../game/Shop";
import { useGame } from "../game/store";
import { currentObjective } from "../game/objectives";
import { contractPins } from "../game/contracts";

const RANGE = 70; // mét từ tâm tới mép bản đồ
const FPS = 12;

/** Radar xoay theo hướng camera: toà nhà, xe, drone, chip CRED, chợ đen. */
export function Minimap({ size }: { size: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = size * dpr;
    el.height = size * dpr;
    let raf = 0;
    let last = 0;

    const draw = (time: number) => {
      raf = requestAnimationFrame(draw);
      if (time - last < 1000 / FPS) return;
      last = time;
      const s = useGame.getState();
      const car = s.mode === "drive" && s.carId !== null ? handles.cars.get(s.carId) : null;
      const center = car?.currPos ?? handles.player?.currPos;
      if (!center) return;

      const scale = size / 2 / RANGE;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "rgba(13, 2, 33, 0.78)";
      ctx.fillRect(0, 0, size, size);

      // Hệ toạ độ: tâm là người chơi, hướng lên là hướng camera đang nhìn
      ctx.translate(size / 2, size / 2);
      ctx.rotate(handles.camYaw);
      const map = (x: number, z: number): [number, number] => [(x - center.x) * scale, (z - center.z) * scale];

      ctx.fillStyle = "rgba(157, 77, 255, 0.28)";
      for (const b of BUILDINGS) {
        const [x, y] = map(b.x - b.w / 2, b.z - b.d / 2);
        ctx.fillRect(x, y, b.w * scale, b.d * scale);
      }

      ctx.fillStyle = "#ffb000";
      for (const c of fx.chips()) {
        const [x, y] = map(c.x, c.z);
        ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      }

      ctx.fillStyle = "#05d9e8";
      handles.cars.forEach((c, id) => {
        if (id === s.carId) return;
        const [x, y] = map(c.currPos.x, c.currPos.z);
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      });

      {
        const [x, y] = map(SHOP_POS.x, SHOP_POS.z);
        ctx.strokeStyle = "#ffb000";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 4, y - 4, 8, 8);
      }

      // Mục tiêu đang dẫn đường (cùng mục tiêu với mũi tên cạnh nhân vật): chấm lớn nhấp nháy có vòng sáng;
      // nằm ngoài tầm radar thì ghim ở mép kèm mũi nhọn chỉ ra ngoài
      const obj = currentObjective();
      if (obj) {
        let [tx, ty] = map(obj.x, obj.z);
        const r = Math.hypot(tx, ty);
        const edge = size / 2 - 9;
        const outside = r > edge;
        if (outside) {
          tx = (tx / r) * edge;
          ty = (ty / r) * edge;
        }
        const pulse = (Math.sin(time / 180) + 1) / 2;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.shadowColor = obj.color;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = obj.color;
        ctx.globalAlpha = 0.35 + pulse * 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 7 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
        if (outside) {
          ctx.rotate(Math.atan2(ty, tx));
          ctx.fillStyle = obj.color;
          ctx.beginPath();
          ctx.moveTo(12, 0);
          ctx.lineTo(6, -4);
          ctx.lineTo(6, 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Ghim hợp đồng: marker vàng, mục tiêu, thùng hàng, điểm thoát; ngoài tầm thì ghim ở mép
      for (const pin of contractPins()) {
        let [tx, ty] = map(pin.x, pin.z);
        const r = Math.hypot(tx, ty);
        const edge = size / 2 - 8;
        if (r > edge) {
          tx = (tx / r) * edge;
          ty = (ty / r) * edge;
        }
        ctx.save();
        ctx.translate(tx, ty);
        ctx.fillStyle = pin.color;
        ctx.shadowColor = pin.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        if (pin.kind === "extract") {
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
        } else {
          ctx.rotate(Math.PI / 4 - handles.camYaw);
          const k = pin.kind === "marker" ? 4.5 : 5.5;
          ctx.rect(-k, -k, k * 2, k * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      for (const d of drones) {
        if (d.state === "dead") continue;
        const [x, y] = map(d.pos.x, d.pos.z);
        const special = d.kind === "courier" ? "#ffd23d" : d.kind === "boss" ? "#ff7a1f" : d.kind === "zombie" ? "#7dff5a" : null;
        ctx.fillStyle = special ?? (d.state === "chase" ? "#ff1f3d" : "rgba(255, 31, 61, 0.55)");
        ctx.beginPath();
        ctx.arc(x, y, special ? 5 : d.state === "chase" ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Người chơi: mũi tên luôn hướng lên
      ctx.fillStyle = "#ff2a6d";
      ctx.beginPath();
      ctx.moveTo(size / 2, size / 2 - 6);
      ctx.lineTo(size / 2 + 4.5, size / 2 + 5);
      ctx.lineTo(size / 2 - 4.5, size / 2 + 5);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(5, 217, 232, 0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <canvas
      ref={canvas}
      className="minimap"
      style={{ width: size, height: size }}
      aria-label="Bản đồ nhỏ: chấm đỏ là drone, ô xanh là xe, ô vàng là chợ đen"
    />
  );
}
