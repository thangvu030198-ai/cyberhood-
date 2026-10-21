// HUD kiểu Rockman X: thanh máu dọc bên trái, thanh máu trùm bên phải, READY / MISSION COMPLETE,
// menu tạm dừng (Esc) và nút cảm ứng trên điện thoại.

import { useEffect, useState } from "react";
import { LEVEL_TUNING as T } from "./levelTuning";
import { bindLevelKeys, levelInput } from "./levelInput";
import { LEVEL_REWARD, useLevel } from "./session";
import type { Input } from "./platformer";

const touchDevice = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** Vẽ lại HUD ~20 lần/giây, đọc thẳng từ mô phỏng */
function useTicker(hz: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
}

export function LevelHud() {
  const sim = useLevel((s) => s.sim);
  const contract = useLevel((s) => s.contract);
  const leave = useLevel((s) => s.leave);
  const [paused, setPaused] = useState(false);
  useTicker(20);

  useEffect(() => {
    levelInput.paused = paused;
  }, [paused]);
  useEffect(() => {
    const unbind = bindLevelKeys(() => {
      const s = useLevel.getState().sim;
      if (s?.status === "cleared") useLevel.getState().leave();
      else setPaused((p) => !p);
    });
    return () => {
      unbind();
      levelInput.paused = false;
    };
  }, []);
  // Qua màn: Enter để về thành phố
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Enter" && useLevel.getState().sim?.status === "cleared") useLevel.getState().leave();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!sim) return null;
  const p = sim.player;
  const boss = sim.boss;
  const cred = LEVEL_REWARD.clear + sim.kills * LEVEL_REWARD.perKill;
  return (
    <div className="lv">
      <div className="lv__hp" aria-label={`Máu ${p.hp}/${T.player.maxHp}`}>
        <span className="lv__hp-tag">X</span>
        <div className="lv__bar">
          {Array.from({ length: T.player.maxHp }, (_, i) => (
            <i key={i} className={i < p.hp ? "on" : ""} />
          ))}
        </div>
      </div>
      {sim.bossActive && boss && boss.alive && (
        <div className="lv__hp lv__hp--boss" aria-label="Máu trùm">
          <span className="lv__hp-tag">Ω</span>
          <div className="lv__bar">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} className={i < Math.ceil((boss.hp / boss.maxHp) * 28) ? "on" : ""} />
            ))}
          </div>
        </div>
      )}
      <div className="lv__top">
        <span className="lv__stage">{sim.def.name}</span>
        <span>
          Hạ {sim.kills} · Checkpoint {sim.checkpointIndex + 1}/{sim.def.checkpoints.length}
          {!contract && " · Luyện tập"}
        </span>
      </div>

      {sim.status === "intro" && <div className="lv__banner lv__banner--ready">READY</div>}
      {sim.status === "dead" && <div className="lv__banner lv__banner--dead">HỒI SINH Ở CHECKPOINT…</div>}
      {sim.status === "cleared" && (
        <div className="lv__panel">
          <p className="lv__panel-tag">MISSION COMPLETE</p>
          <h2>Đã hạ trùm Redbot Reaper</h2>
          <p>
            +{cred} CRED · {sim.kills} địch bị hạ · chết {sim.deaths} lần
          </p>
          {contract && <p>Hợp đồng hoàn thành: đồ rơi đã vào kho (xem bảng kết quả trong thành phố)</p>}
          <button className="lv__btn" onClick={leave}>
            Về thành phố <kbd>Enter</kbd>
          </button>
        </div>
      )}
      {paused && sim.status !== "cleared" && (
        <div className="lv__panel">
          <p className="lv__panel-tag">TẠM DỪNG</p>
          <button className="lv__btn" onClick={() => setPaused(false)}>
            Chơi tiếp <kbd>Esc</kbd>
          </button>
          <button
            className="lv__btn lv__btn--ghost"
            onClick={() => {
              setPaused(false);
              leave();
            }}
          >
            Bỏ nhiệm vụ, về thành phố
          </button>
          {contract && <p className="lv__note">Bỏ dở thì hợp đồng tính là thất bại.</p>}
        </div>
      )}

      {touchDevice ? (
        <TouchPad onPause={() => setPaused((x) => !x)} />
      ) : (
        <div className="lv__help">
          <kbd>A</kbd>
          <kbd>D</kbd> chạy · <kbd>Space</kbd> nhảy (bám tường + nhảy tiếp) · <kbd>J</kbd> bắn, giữ để nạp · <kbd>K</kbd> lướt · <kbd>Esc</kbd> tạm dừng
        </div>
      )}
    </div>
  );
}

function TouchPad({ onPause }: { onPause: () => void }) {
  const hold = (name: keyof Input) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      levelInput.setTouch(name, true);
    },
    onPointerUp: () => levelInput.setTouch(name, false),
    onPointerCancel: () => levelInput.setTouch(name, false),
  });
  return (
    <>
      <div className="lv__pad lv__pad--left">
        <button {...hold("left")}>◀</button>
        <button {...hold("right")}>▶</button>
      </div>
      <div className="lv__pad lv__pad--right">
        <button {...hold("dash")}>LƯỚT</button>
        <button {...hold("shoot")}>BẮN</button>
        <button className="lv__jump" {...hold("jump")}>
          NHẢY
        </button>
      </div>
      <button className="lv__pause" onClick={onPause}>
        II
      </button>
    </>
  );
}
