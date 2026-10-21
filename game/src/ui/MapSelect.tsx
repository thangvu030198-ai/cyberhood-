// Bảng chọn map ở cổng nhiệm vụ: 4 map theo kế hoạch mùa, mỗi map một dạng 2D và kiểu chơi riêng.

import { useEffect } from "react";
import { LEVELS, isUnlocked } from "../level/registry";
import { playLevel, useLevel } from "../level/session";
import { viewById } from "../level/views";
import { useDuel } from "../level/duelSession";
import { RIVALS } from "../level/duel";
import { DIFFICULTIES, useDifficulty } from "../game/difficulty";
import { useKart } from "../level/KartScene";
import { useHunter } from "../game/hunter";

const MODE_LABEL = { platform: "Đi ngang", climb: "Leo tháp", shmup: "Bay bắn", topdown: "Đi 8 hướng" } as const;

export function MapSelect() {
  const selecting = useLevel((s) => s.selecting);
  const cleared = useLevel((s) => s.cleared);
  const setSelecting = useLevel((s) => s.setSelecting);
  const inContract = useHunter((s) => s.contract !== null);
  const beaten = useDuel((s) => s.beaten);
  const diff = useDifficulty((s) => s.level);
  const setDiff = useDifficulty((s) => s.set);
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
        <div className="map-select__diff" role="radiogroup" aria-label="Độ khó">
          {DIFFICULTIES.map((d) => (
            <button key={d.id} role="radio" aria-checked={diff === d.id} className={diff === d.id ? "is-on" : ""} title={d.note} onClick={() => setDiff(d.id)}>
              {d.label}
            </button>
          ))}
          <small>{DIFFICULTIES.find((d) => d.id === diff)!.note}</small>
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
                <span className="map-select__num">{l.side ? "★" : i + 1}</span>
                <img className="map-select__art" src={`icons/maps/${l.def.id}.webp`} alt="" />
                <span className="map-select__body">
                  <b>
                    {l.def.name} {done && <em>ĐÃ QUA</em>}
                  </b>
                  <span>{l.blurb}</span>
                  <small>
                    {MODE_LABEL[l.def.mode ?? "platform"]} · {v.label} (học từ {v.inspired}) · rơi đồ ×{l.mapMultiplier} · {l.keyLabel} · trùm {l.bossName}
                  </small>
                </span>
                <span className="map-select__state">{open ? "VÀO" : l.side ? `Qua ${LEVELS[0].def.name}` : l.mapId === "citadel_raid" ? "Qua đủ 3 map" : `Qua ${LEVELS[i - 1].def.name}`}</span>
              </button>
            </li>
          );
        })}
        <li className={cleared.includes(LEVELS[0].def.id) ? "" : "locked"}>
          <button
            disabled={!cleared.includes(LEVELS[0].def.id)}
            onClick={() => {
              setSelecting(false);
              useKart.getState().start();
            }}
          >
            <span className="map-select__num">★</span>
            <img className="map-select__art" src="icons/maps/kart.webp" alt="" />
            <span className="map-select__body">
              <b>ĐƯỜNG ĐUA NEON LOOP</b>
              <span>Đua 3 vòng với 5 tay đua Legion. Tấm tăng tốc, hộp turbo / tên lửa. Về nhất nhận Chìa rương.</span>
              <small>Đua kart · camera sau lưng (học từ Chocobo Racing · Crash Team Racing PS1) · không tốn năng lượng</small>
            </span>
            <span className="map-select__state">{cleared.includes(LEVELS[0].def.id) ? "VÀO" : `Qua ${LEVELS[0].def.name}`}</span>
          </button>
        </li>
        <li className={cleared.includes(LEVELS[0].def.id) ? "" : "locked"}>
          <button
            disabled={!cleared.includes(LEVELS[0].def.id)}
            onClick={() => {
              setSelecting(false);
              useDuel.getState().start();
            }}
          >
            <span className="map-select__num">★</span>
            <img className="map-select__art" src="icons/maps/duel.webp" alt="" />
            <span className="map-select__body">
              <b>
                ĐẤU TRƯỜNG NGAI SẮT · bậc {Math.min(beaten + 1, RIVALS.length)}/{RIVALS.length}
              </b>
              <span>
                Thang 8 đối thủ: goblin, hiệp sĩ, chiến binh sói, Thần Đá… tới nhà vô địch {RIVALS[RIVALS.length - 1].name}. Hạ nhà vô địch nhận trang bị Sử thi trở lên.
                Trận tới: <b>{RIVALS[Math.min(beaten, RIVALS.length - 1)].name}</b>.
              </span>
              <small>Đối kháng · nhìn ngang sàn đấu 3D (học từ Bloody Roar 2 · Tekken PS1) · không tốn năng lượng</small>
            </span>
            <span className="map-select__state">{cleared.includes(LEVELS[0].def.id) ? "VÀO" : `Qua ${LEVELS[0].def.name}`}</span>
          </button>
        </li>
      </ol>
      <footer className="bag__foot">
        <button className="lv__btn lv__btn--ghost" onClick={() => setSelecting(false)}>
          Đóng <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
