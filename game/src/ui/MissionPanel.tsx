// Bảng nhiệm vụ ngày / tuần / tháng và Điểm Hunter. Mở bằng phím N hoặc bảng LED nhiệm vụ ở sảnh.

import { useEffect, useState } from "react";
import { MISSIONS, PERIOD_BONUS, HUNTER_POINTS, canClaimBonus, isClaimed, isDone, periodEnds, type Period, type Reward } from "../game/missions";
import { useMissions } from "../game/missionStore";

const TABS: { id: Period; label: string }[] = [
  { id: "daily", label: "Ngày" },
  { id: "weekly", label: "Tuần" },
  { id: "monthly", label: "Tháng" },
];

export function rewardText(r: Reward) {
  const out: string[] = [];
  if (r.cred) out.push(`${r.cred} CRED`);
  if (r.hunterPoints) out.push(`${r.hunterPoints} Điểm Hunter`);
  if (r.chestKeys) out.push(`${r.chestKeys} Chìa rương`);
  if (r.stims) out.push(`${r.stims} Stim`);
  if (r.epicChest) out.push("Rương Sử thi");
  if (r.legendaryChest) out.push("Rương Huyền thoại");
  return out.join(" · ");
}

function timeLeft(p: Period) {
  const ms = periodEnds(p, new Date()).getTime() - Date.now();
  const h = Math.floor(ms / 3.6e6);
  if (h >= 48) return `còn ${Math.floor(h / 24)} ngày`;
  return `còn ${h} giờ ${Math.floor((ms % 3.6e6) / 6e4)} phút`;
}

export function MissionPanel() {
  const open = useMissions((s) => s.open);
  const setOpen = useMissions((s) => s.setOpen);
  const state = useMissions((s) => s.state);
  const doClaim = useMissions((s) => s.claim);
  const doBonus = useMissions((s) => s.claimBonus);
  const [tab, setTab] = useState<Period>("daily");
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);
  if (!open) return null;
  const list = MISSIONS.filter((m) => m.period === tab);
  const hp = state.hunterPoints;
  return (
    <div className="hunter-panel mission-panel" role="dialog" aria-label="Nhiệm vụ">
      <header className="hunter-panel__head">
        <div>
          <p className="bag__eyebrow">CYBERHOOD · BẢNG NHIỆM VỤ</p>
          <h2 className="bag__title">Nhiệm vụ</h2>
        </div>
        <div className="mission-points" title="Điểm Hunter tuần dùng để chia Quỹ thưởng tuần theo hoạt động. Vượt ngưỡng thì chỉ tính một nửa, có trần mỗi tuần.">
          <span className="mission-points__value">{hp.points}</span>
          <span className="mission-points__label">
            Điểm Hunter tuần · trần {HUNTER_POINTS.weeklyCap}
          </span>
        </div>
      </header>
      <div className="mission-tabs" role="tablist">
        {TABS.map((t) => {
          const ready = MISSIONS.some((m) => m.period === t.id && isDone(state, m) && !isClaimed(state, m)) || canClaimBonus(state, t.id);
          return (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
              {t.label}
              {ready && <i className="mission-dot" aria-label="có thưởng chờ nhận" />}
            </button>
          );
        })}
        <span className="mission-reset">Làm mới {timeLeft(tab)}</span>
      </div>
      <ul className="mission-list">
        {list.map((m) => {
          const prog = state[m.period].progress[m.id] ?? 0;
          const done = isDone(state, m);
          const claimed = isClaimed(state, m);
          return (
            <li key={m.id} className={claimed ? "claimed" : done ? "done" : ""}>
              <div className="mission-list__text">
                <span className="mission-list__title">{m.title}</span>
                <span className="mission-list__reward">{rewardText(m.reward)}</span>
                <span className="mission-bar">
                  <i style={{ width: `${(prog / m.goal) * 100}%` }} />
                </span>
              </div>
              <span className="mission-list__count">
                {prog}/{m.goal}
              </span>
              <button className="mission-claim" disabled={!done || claimed} onClick={() => doClaim(m.id)}>
                {claimed ? "Đã nhận" : done ? "Nhận" : "Chưa xong"}
              </button>
            </li>
          );
        })}
        <li className={`mission-bonus ${state[tab].bonusClaimed ? "claimed" : ""}`}>
          <div className="mission-list__text">
            <span className="mission-list__title">{tab === "daily" ? "Thưởng hoàn thành cả ngày" : tab === "weekly" ? "Thưởng hoàn thành cả tuần" : "Thưởng hoàn thành cả tháng"}</span>
            <span className="mission-list__reward">{rewardText(PERIOD_BONUS[tab])}</span>
          </div>
          <span />
          <button className="mission-claim" disabled={!canClaimBonus(state, tab)} onClick={() => doBonus(tab)}>
            {state[tab].bonusClaimed ? "Đã nhận" : "Nhận"}
          </button>
        </li>
      </ul>
      <p className="mission-note">
        Điểm Hunter tổng: {hp.total}. Quỹ thưởng tuần chia theo Điểm Hunter của mọi người chơi; phần thưởng phụ thuộc hoạt động, không đảm bảo giá trị.
      </p>
      <footer className="bag__foot">
        <button className="lv__btn" onClick={() => setOpen(false)}>
          Đóng <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
