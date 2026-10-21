// HUD kiểu Rockman X: thanh máu dọc bên trái, thanh máu trùm bên phải, READY / MISSION COMPLETE,
// menu tạm dừng (Esc) và nút cảm ứng trên điện thoại.

import { useEffect, useState } from "react";
import { GEAR } from "./gear";
import { LEVEL_TUNING as T } from "./levelTuning";
import { DIFFICULTIES } from "../game/difficulty";
import { bindLevelKeys, levelInput } from "./levelInput";
import { LEVEL_REWARD, useLevel } from "./session";
import type { Input } from "./platformer";
import { viewById } from "./views";
import { levelById } from "./registry";

const touchDevice = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

/** Vẽ lại HUD ~20 lần/giây, đọc thẳng từ mô phỏng */
function useTicker(hz: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
}

const bossSeenRef: { sim: unknown; at: number } = { sim: null, at: 0 };

export function LevelHud() {
  const sim = useLevel((s) => s.sim);
  const contract = useLevel((s) => s.contract);
  const leave = useLevel((s) => s.leave);
  const feed = useLevel((s) => s.feed);

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
  // Qua màn: Enter để về thành phố; V đổi góc nhìn
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
  const cred = Math.round((LEVEL_REWARD.clear + sim.kills * LEVEL_REWARD.perKill) * T.difficulty[sim.difficulty].reward * (1 + T.score.rankBonus[sim.rank]));
  const entry = levelById(sim.def.id);
  const v = viewById(entry.view);
  // Lúc trùm vừa thức dậy: hiện câu thoại của trùm vài giây
  if (sim.bossActive && bossSeenRef.sim !== sim) bossSeenRef.sim = sim, bossSeenRef.at = sim.time;
  if (!sim.bossActive && bossSeenRef.sim === sim) bossSeenRef.sim = null;
  const bossSeen = bossSeenRef.at;
  const showView = sim.time < 5;
  return (
    <div className={`lv lv--${v.post}`}>
      {v.post === "cinema" && (
        <>
          <div className="lv__bars lv__bars--top" />
          <div className="lv__bars lv__bars--bottom" />
        </>
      )}
      {sim.time < 7 && (
        <div className="lv__story">
          <small>{entry.story.chapter}</small>
          <p>{entry.story.intro}</p>
        </div>
      )}
      {sim.bossActive && boss && boss.alive && boss.awake && sim.time - bossSeen < 4.5 && <div className="lv__bossline">{entry.story.boss}</div>}
      {showView && (
        <div className="lv__view">
          <b>{entry.howTo}</b>
          <span>
            Dạng 2D: {v.label} · học từ {v.inspired}
          </span>
        </div>
      )}
      <div className="lv__hp" aria-label={`Máu ${p.hp}/${sim.maxHp}`}>
        <span className="lv__hp-tag">X</span>
        <div className="lv__bar">
          {Array.from({ length: sim.maxHp }, (_, i) => (
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
          {boss.cue && <div className={`lv__cue ${boss.guard ? "" : "lv__cue--open"}`}>{boss.cue}</div>}
        </div>
      )}
      <div className="lv__top">
        <span className="lv__stage">{sim.def.name}</span>
        <span>
          Hạ {sim.kills} · Checkpoint {sim.checkpointIndex + 1}/{sim.def.checkpoints.length}
          {!contract && " · Luyện tập"}
        </span>
        <span className="lv__loot">
          Chìa rương ×{sim.chestKeys} · Linh kiện {sim.collected.filter((d) => d.kind === "part").length}
          {sim.collected.some((d) => d.kind === "gear") && ` · Trang bị ${sim.collected.filter((d) => d.kind === "gear").length}`}
        </span>
        <span className="lv__score">
          {sim.score.toLocaleString("vi-VN")} điểm
          {sim.combo > 1 && sim.time - sim.comboAt < 3 && <b className="lv__combo"> COMBO ×{sim.combo}</b>}
        </span>
        <span className="lv__weapon">
          {sim.weapon === "buster" ? "Súng tay X-Buster" : GEAR[sim.weapon].name}
          {sim.armor !== "none" && ` · ${GEAR[sim.armor].name}`}
        </span>
      </div>
      <ul className="lv__feed">
        {feed
          .filter((f) => sim.time - f.at < 4)
          .map((f, i) => (
            <li key={`${f.at}-${i}`} style={{ color: f.color, opacity: Math.min(1, 4 - (sim.time - f.at)) }}>
              {f.text}
            </li>
          ))}
      </ul>

      {sim.status === "intro" && <div className="lv__banner lv__banner--ready">READY</div>}
      {sim.status === "dead" && <div className="lv__banner lv__banner--dead">HỒI SINH Ở CHECKPOINT…</div>}
      {sim.status === "cleared" && (
        <div className="lv__panel">
          <p className="lv__panel-tag">MISSION COMPLETE</p>
          <div className={`lv__rank lv__rank--${sim.rank}`}>{sim.rank}</div>
          <h2>Đã hạ trùm {entry.bossName}</h2>
          <p className="lv__outro">{entry.story.outro}</p>
          <p>
            {sim.score.toLocaleString("vi-VN")} điểm · combo dài nhất ×{sim.bestCombo} · {Math.round(sim.clearedAt)} giây (chuẩn {Math.round(sim.parTime)}) · độ khó {DIFFICULTIES.find((d) => d.id === sim.difficulty)!.label}
          </p>
          <p>
            +{cred} CRED · {sim.kills} địch bị hạ · chết {sim.deaths} lần
          </p>
          <p>
            Nhặt được {sim.collected.filter((d) => d.kind === "part").length} linh kiện · {sim.chests.filter((c) => c.opened).length}/
            {sim.chests.length} rương
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
        <TouchPad flying={sim.mode === "shmup" || sim.mode === "topdown"} onPause={() => setPaused((x) => !x)} />
      ) : (
        <div className="lv__help">
          {sim.mode === "topdown" ? (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> đi 8 hướng · <kbd>J</kbd> bắn theo hướng nhìn (giữ J để khoá hướng) · <kbd>K</kbd> lướt · <kbd>Esc</kbd> tạm dừng
            </>
          ) : sim.mode === "shmup" ? (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> bay · <kbd>J</kbd> bắn, giữ để nạp · <kbd>K</kbd> tăng tốc · <kbd>Esc</kbd> tạm dừng
            </>
          ) : (
            <>
              <kbd>A</kbd>
              <kbd>D</kbd> chạy · <kbd>Space</kbd> nhảy (giữ Space sát tường để leo) · <kbd>J</kbd> bắn, giữ để nạp · <kbd>K</kbd> lướt · <kbd>Esc</kbd> tạm dừng
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TouchPad({ onPause, flying }: { onPause: () => void; flying: boolean }) {
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
        {flying && (
          <>
            <button {...hold("up")}>▲</button>
            <button {...hold("down")}>▼</button>
          </>
        )}
      </div>
      <div className="lv__pad lv__pad--right">
        <button {...hold("dash")}>LƯỚT</button>
        <button {...hold("shoot")}>BẮN</button>
        {!flying && (
          <button className="lv__jump" {...hold("jump")}>
            NHẢY
          </button>
        )}
      </div>
      <button className="lv__pause" onClick={onPause}>
        II
      </button>
    </>
  );
}
