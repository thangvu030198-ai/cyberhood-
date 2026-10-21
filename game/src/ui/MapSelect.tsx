// Bảng chọn map ở cổng nhiệm vụ: 4 map theo kế hoạch mùa, mỗi map một dạng 2D và kiểu chơi riêng.

import { useEffect } from "react";
import { LEVELS, isUnlocked } from "../level/registry";
import { playLevel, useLevel } from "../level/session";
import { viewById } from "../level/views";
import { useHunter } from "../game/hunter";

const MODE_LABEL = { platform: "Đi ngang", climb: "Leo tháp", shmup: "Bay bắn" } as const;

export function MapSelect() {
  const selecting = useLevel((s) => s.selecting);
  const cleared = useLevel((s) => s.cleared);
  const setSelecting = useLevel((s) => s.setSelecting);
  const inContract = useHunter((s) => s.contract !== null);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setSelecting(false);
      const n = Number(e.key);
      if (n >= 1 && n <= LEVELS.length && isUnlocked(n - 1, useLevel.getState().cleared)) playLevel(LEVELS[n - 1].def.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, setSelecting]);
  if (!selecting) return null;
  return (
    <div className="hunter-panel map-select" role="dialog" aria-label="Chọn map">
      <header className="hunter-panel__head">
        <div>
          <p className="bag__eyebrow">CỔNG NHIỆM VỤ · MÙA S1</p>
          <h2 className="bag__title">Chọn map</h2>
        </div>
        <p className="map-select__note">{inContract ? "Đang có hợp đồng: qua màn để hoàn thành" : "Vào màn sẽ mở hợp đồng mới (tốn 1 năng lượng)"}</p>
      </header>
      <ol className="map-select__list">
        {LEVELS.map((l, i) => {
          const open = isUnlocked(i, cleared);
          const done = cleared.includes(l.def.id);
          const v = viewById(l.view);
          return (
            <li key={l.def.id} className={open ? "" : "locked"}>
              <button disabled={!open} onClick={() => playLevel(l.def.id)}>
                <span className="map-select__num">{i + 1}</span>
                <span className="map-select__body">
                  <b>
                    {l.def.name} {done && <em>ĐÃ QUA</em>}
                  </b>
                  <span>{l.blurb}</span>
                  <small>
                    {MODE_LABEL[l.def.mode ?? "platform"]} · {v.label} (học từ {v.inspired}) · rơi đồ ×{l.mapMultiplier} · {l.keyLabel} · trùm {l.bossName}
                  </small>
                </span>
                <span className="map-select__state">{open ? "VÀO" : i === LEVELS.length - 1 ? "Qua đủ 3 map" : `Qua ${LEVELS[i - 1].def.name}`}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <footer className="bag__foot">
        <button className="lv__btn lv__btn--ghost" onClick={() => setSelecting(false)}>
          Đóng <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
