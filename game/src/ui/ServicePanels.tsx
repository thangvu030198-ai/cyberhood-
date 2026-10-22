// Bảng dịch vụ của NPC ở sảnh: lò rèn (đập đồ +1…+10), vòng quay may mắn, kho vũ khí, biên niên sử.
// Phòng thay đồ mở thẳng Túi đồ (6 ô trang bị).

import { gearIcon } from "../level/gearIcon";
import { useEffect, useRef, useState } from "react";
import { GEAR, GEAR_IDS, FORGE, MAX_ENHANCE, type GearId } from "../level/gear";
import { SHOP_GEAR, SPIN_COST, SPIN_PRIZES, useGear } from "../game/gearStore";
import { serviceById, STORY_PROLOGUE, useService } from "../game/services";
import { useGame } from "../game/store";
import { LEVELS } from "../level/registry";
import { useLevel } from "../level/session";
import { RARITY_LABEL } from "../sim/loot";
import { statText } from "./GearBag";

const RARITY_HEX: Record<string, string> = { common: "#c9d0d8", rare: "#5ab4ff", epic: "#c27dff", legendary: "#ffc23d", mythic: "#ff4a64" };

function Head({ id }: { id: Parameters<typeof serviceById>[0] }) {
  const s = serviceById(id);
  return (
    <header className="hunter-panel__head">
      <div>
        <p className="bag__eyebrow" style={{ color: s.color }}>
          {s.npc.toUpperCase()} · {s.title}
        </p>
        <h2 className="bag__title">{s.title}</h2>
        <p className="svc__greet">“{s.greet}”</p>
      </div>
    </header>
  );
}

function Forge() {
  const owned = useGear((s) => s.owned);
  const enh = useGear((s) => s.enh);
  const forge = useGear((s) => s.forge);
  const cred = useGame((s) => s.cred);
  const ids = GEAR_IDS.filter((id) => owned[id]);
  const [pick, setPick] = useState<GearId | null>(ids[0] ?? null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [hammer, setHammer] = useState(0);
  if (!ids.length) return <p className="bag__empty">Chưa có trang bị nào. Nhặt trong màn 2D, quay số hoặc mua ở Kho Vũ Khí.</p>;
  const lvl = pick ? enh[pick] ?? 0 : 0;
  return (
    <div className="svc">
      <ul className="svc__list">
        {ids.map((id) => (
          <li key={id}>
            <button className={pick === id ? "is-on" : ""} onClick={() => setPick(id)} style={{ borderColor: RARITY_HEX[GEAR[id].rarity] }}>
              <img src={gearIcon(id)} alt="" />
              <span>
                {GEAR[id].name} <b>+{enh[id] ?? 0}</b>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {pick && (
        <div className={`svc__forge ${hammer ? "is-hit" : ""}`} key={hammer}>
          <img src={gearIcon(pick)} alt="" />
          <h3 style={{ color: RARITY_HEX[GEAR[pick].rarity] }}>
            {GEAR[pick].name} +{lvl}
          </h3>
          {lvl < MAX_ENHANCE ? (
            <>
              <p>
                Lên +{lvl + 1}: tỉ lệ <b>{Math.round(FORGE.chance[lvl] * 100)}%</b> · giá <b>{FORGE.cost(lvl)} CRED</b>
                {FORGE.needsPart(lvl) && " · 1 linh kiện Hiếm+"}
                {lvl >= FORGE.dropFrom && " · thất bại tụt 1 cấp"}
              </p>
              <p className="svc__stat">{GEAR[pick].stats ? statText(GEAR[pick].stats!) : GEAR[pick].slot === "weapon" ? "Mỗi cấp +8% sát thương" : "Mỗi cấp +8% máu giáp"}</p>
              <button
                className="lv__btn"
                disabled={cred < FORGE.cost(lvl)}
                onClick={() => {
                  const r = forge(pick);
                  setHammer((n) => n + 1);
                  setMsg(r.error ? { text: r.error, ok: false } : r.ok ? { text: `THÀNH CÔNG! Lên +${r.level}`, ok: true } : { text: `Thất bại… còn +${r.level}`, ok: false });
                }}
              >
                ĐẬP ĐỒ ⚒
              </button>
            </>
          ) : (
            <p>Đã đạt +10 tối đa.</p>
          )}
          {msg && <p className={msg.ok ? "svc__ok" : "svc__fail"}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}

function Spin() {
  const spin = useGear((s) => s.spin);
  const freeSpin = useGear((s) => s.freeSpin);
  const free = freeSpin !== new Date().toISOString().slice(0, 10);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const n = SPIN_PRIZES.length;
  const seg = 360 / n;
  const grad = SPIN_PRIZES.map((p, i) => `${p.color}${i % 2 ? "cc" : "88"} ${i * seg}deg ${(i + 1) * seg}deg`).join(",");
  return (
    <div className="svc svc--spin">
      <div className="spin">
        <div className="spin__pointer">▼</div>
        <div className="spin__wheel" style={{ background: `conic-gradient(${grad})`, transform: `rotate(${angle}deg)` }}>
          {SPIN_PRIZES.map((p, i) => (
            <span key={p.id} style={{ transform: `rotate(${i * seg + seg / 2}deg) translateY(-112px) rotate(90deg)` }}>
              {p.label}
            </span>
          ))}
        </div>
      </div>
      <div className="svc__side">
        <p>{free ? "Hôm nay còn 1 lượt MIỄN PHÍ" : `Mỗi lượt ${SPIN_COST} CRED`}</p>
        <button
          className="lv__btn"
          disabled={busy}
          onClick={() => {
            const r = spin();
            if ("error" in r) return setResult(r.error);
            const i = SPIN_PRIZES.findIndex((p) => p.id === r.prize.id);
            // Quay vài vòng rồi dừng đúng ô thưởng (kim ở đỉnh)
            const target = 360 * 5 + (360 - (i * seg + seg / 2));
            setBusy(true);
            setResult(null);
            setAngle((a) => a - (a % 360) + target);
            timer.current = window.setTimeout(() => {
              setBusy(false);
              setResult(r.prize.id === "jackpot" ? "JACKPOT! +1000 CRED và đồ Huyền thoại!" : `Trúng: ${r.prize.label}`);
            }, 3200);
          }}
        >
          QUAY!
        </button>
        {result && <p className="svc__ok">{result}</p>}
        <small>Phần thưởng: CRED, Chìa rương, Stim, trang bị ngẫu nhiên, đồ Sử thi+, Jackpot.</small>
      </div>
    </div>
  );
}

function Armory() {
  const buy = useGear((s) => s.buy);
  const owned = useGear((s) => s.owned);
  const cred = useGame((s) => s.cred);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="svc">
      <ul className="svc__shop">
        {SHOP_GEAR.map(({ id, price }) => (
          <li key={id} style={{ borderColor: RARITY_HEX[GEAR[id].rarity] }}>
            <img src={gearIcon(id)} alt="" />
            <div>
              <b>{GEAR[id].name}</b> <small style={{ color: RARITY_HEX[GEAR[id].rarity] }}>{RARITY_LABEL[GEAR[id].rarity]}</small>
              <p>{GEAR[id].blurb}</p>
              {owned[id] ? <small>Đang có ×{owned[id]}</small> : null}
            </div>
            <button className="bag__use" disabled={cred < price} onClick={() => setMsg(buy(id) ?? `Đã mua ${GEAR[id].name} (vào Túi đồ)`)}>
              {price} CRED
            </button>
          </li>
        ))}
      </ul>
      {msg && <p className="svc__ok">{msg}</p>}
    </div>
  );
}

function Story() {
  const cleared = useLevel((s) => s.cleared);
  return (
    <div className="svc svc--story">
      <p className="svc__prologue">{STORY_PROLOGUE}</p>
      <ol>
        {LEVELS.map((l) => {
          const done = cleared.includes(l.def.id);
          return (
            <li key={l.def.id} className={done ? "is-done" : ""}>
              <b>{l.story.chapter}</b>
              <p>{l.story.intro}</p>
              {done ? <p className="svc__ok">{l.story.outro}</p> : <small>Qua màn {l.def.name} để mở phần kết chương.</small>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function ServicePanels() {
  const open = useService((s) => s.open);
  const setOpen = useService((s) => s.setOpen);
  useEffect(() => {
    if (!open) return;
    useGame.setState({ panelOpen: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      useGame.setState({ panelOpen: false });
    };
  }, [open, setOpen]);
  useEffect(() => {
    if (open === "wardrobe") {
      setOpen(null);
      useGame.getState().setInventoryOpen(true);
    }
  }, [open, setOpen]);
  if (!open || open === "wardrobe") return null;
  return (
    <div className="hunter-panel svc-panel" role="dialog" aria-label={serviceById(open).title}>
      <Head id={open} />
      {open === "forge" && <Forge />}
      {open === "spin" && <Spin />}
      {open === "armory" && <Armory />}
      {open === "story" && <Story />}
      <footer className="bag__foot">
        <button className="lv__btn lv__btn--ghost" onClick={() => setOpen(null)}>
          Đóng <kbd>Esc</kbd>
        </button>
      </footer>
    </div>
  );
}
