import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PLAYER } from "./config";
import { handles } from "./refs";
import { useGame } from "./store";

const REGEN_DELAY = 6;
const REGEN_PER_SEC = 4;
const WANTED_COOLDOWN = 20;
const FLATLINE_TIME = 3.5;

/** Luật chung mỗi frame: hồi máu, hạ sao truy nã, hồi sinh sau khi flatline. */
export function GameRules() {
  const regen = useRef(0);
  useFrame((_, dt) => {
    const s = useGame.getState();
    const t = performance.now() / 1000;
    // Công thành tự quản lý máu / hồi sinh theo đợt (src/siege)
    if (s.location === "siege") return;

    if (s.flatlinedAt !== null) {
      if (t - s.flatlinedAt > FLATLINE_TIME) {
        s.respawn();
        // Đợi Player xử lý xong việc xuống xe rồi mới đưa về điểm xuất phát
        requestAnimationFrame(() => {
          const body = handles.player?.body;
          if (!body) return;
          body.setTranslation({ x: PLAYER.spawn[0], y: PLAYER.spawn[1], z: PLAYER.spawn[2] }, true);
          body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        });
      }
      return;
    }

    if (s.hp < s.maxHp && t - s.lastDamageAt > REGEN_DELAY) {
      regen.current += REGEN_PER_SEC * dt;
      if (regen.current >= 1) {
        const whole = Math.floor(regen.current);
        regen.current -= whole;
        s.heal(whole);
      }
    }

    if (s.wanted > 0 && t - s.lastCrimeAt > WANTED_COOLDOWN && t - s.lastDamageAt > WANTED_COOLDOWN / 2) {
      s.coolDownWanted();
    }
  });
  return null;
}
