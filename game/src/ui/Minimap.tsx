import { useEffect, useRef } from "react";
import { BUILDINGS } from "../game/City";
import { drones } from "../game/Enemies";
import { fx } from "../game/Effects";
import { handles } from "../game/refs";
import { SHOP_POS } from "../game/Shop";
import { useGame } from "../game/store";

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

      for (const d of drones) {
        if (d.state === "dead") continue;
        const [x, y] = map(d.pos.x, d.pos.z);
        ctx.fillStyle = d.state === "chase" ? "#ff1f3d" : "rgba(255, 31, 61, 0.55)";
        ctx.beginPath();
        ctx.arc(x, y, d.state === "chase" ? 3.5 : 2.5, 0, Math.PI * 2);
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
