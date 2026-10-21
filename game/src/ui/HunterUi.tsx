import { useEffect, useMemo, useState } from "react";
import { GAME, MECH_SLOTS, RARITIES, rarityIndex, type MechSlot, type Rarity } from "../sim/config";
import { RARITY_COLOR, RARITY_LABEL, type MechPart } from "../sim/loot";
import { BASE_MECH_POWER, maxDurability, mechPower, mechRarity, repairCost, type Mech } from "../sim/mech";
import { msToNextEnergy } from "../sim/energy";
import { launchpadTier } from "../sim/season";
import { contractScore, missionsDone, timeLeft } from "../sim/contract";
import { abandonContract, EVENT_LABEL, runtime, startNewContract } from "../game/contracts";
import { useHunter } from "../game/hunter";
import { useGame } from "../game/store";

// Giao diện GameFi: thanh hợp đồng, thanh biến hình, bảng hợp đồng, kết quả, gara Mech.

const SLOT_LABEL: Record<MechSlot, string> = { core: "Lõi", armor: "Giáp", weapon: "Vũ khí", engine: "Động cơ" };
const MAP_LABEL: Record<string, string> = { neon_city: "Neon City", hollow_hotel: "Hollow Hotel", warzone: "Warzone" };
const KEY_LABEL: Record<string, string> = { copper: "Đồng", jade: "Ngọc Bích", crystal: "Pha Lê" };
const TIER_LABEL: Record<string, string> = { bronze: "Bronze", silver: "Silver", gold: "Gold", diamond: "Diamond" };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Cập nhật giao diện theo nhịp cố định cho các số chạy liên tục (đồng hồ, thanh biến hình) */
function useTicker(ms = 250) {
  const [, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function RarityTag({ r }: { r: Rarity }) {
  return (
    <span className="rarity" style={{ color: RARITY_COLOR[r], borderColor: RARITY_COLOR[r] }}>
      {RARITY_LABEL[r]}
    </span>
  );
}

/** Thanh hợp đồng ở giữa trên cùng: đồng hồ 7 phút, nhiệm vụ, điểm, sự kiện, việc đang làm */
export function ContractHud() {
  useTicker(250);
  const c = useHunter((s) => s.contract);
  if (!c) return null;
  const left = timeLeft(c);
  const m = runtime.mission;
  const ev = c.event;
  let doing = "Tới marker vàng gần nhất";
  if (m) {
    const remain = Math.max(0, Math.ceil(m.deadline - c.elapsed));
    if (m.type === "race") doing = `Đua xe: cổng ${m.stage + 1}/${m.points.length} · còn ${remain}s`;
    else if (m.type === "delivery") doing = `Giao hàng tới điểm xanh · còn ${remain}s`;
    else if (m.type === "carjack") doing = m.stage === 0 ? `Lên xe được đánh dấu · còn ${remain}s` : `Lái xe tới gara · còn ${remain}s`;
    else if (m.type === "chase") doing = `Hạ drone đưa thư · còn ${remain}s`;
  } else if (missionsDone(c) === c.markers.length) doing = c.extractVisible ? "Tới điểm thoát màu xanh" : "Chờ điểm thoát (phút 5)";
  return (
    <div className="contract-hud" aria-live="polite">
      <div className="contract-hud__row">
        <span className={`contract-hud__time${left < 60 ? " contract-hud__time--low" : ""}`}>{mmss(left)}</span>
        <span>
          Nhiệm vụ <b>{missionsDone(c)}/{c.markers.length}</b>
        </span>
        <span>
          Điểm <b>{contractScore(c)}</b>
        </span>
        <span>
          Đồ <b>{c.loot.length}</b> · Mảnh <b>{c.shards}</b>
        </span>
      </div>
      <div className="contract-hud__doing">{doing}</div>
      {ev && !ev.done && <div className="contract-hud__event">SỰ KIỆN · {EVENT_LABEL[ev.type]}</div>}
      {c.extractVisible && <div className="contract-hud__extract">Điểm thoát đã mở</div>}
    </div>
  );
}

/** Thanh biến hình: tích từ hạ Legion, nhiệm vụ; đầy thì bấm T */
export function MechMeter() {
  useTicker(200);
  const t = useHunter((s) => s.transform);
  const mech = useHunter((s) => s.mechs.find((m) => m.id === s.equipped) ?? null);
  const pct = Math.round((t.meter / GAME.transform.meterMax) * 100);
  let label = `BIẾN HÌNH ${pct}%`;
  if (t.phase === "transforming") label = "ĐANG BIẾN HÌNH…";
  else if (t.phase === "active") label = `TITAN FRAME · ${Math.ceil(t.timer)}s`;
  else if (t.phase === "reverting") label = "TRỞ LẠI…";
  else if (t.cooldown > 0) label = `HỒI CHIÊU ${Math.ceil(t.cooldown)}s`;
  else if (pct >= 100) label = mech && mech.durability > 0 ? "SẴN SÀNG · NHẤN T" : "HẾT ĐỘ BỀN MECH";
  const fill = t.phase === "active" ? t.mechHp / Math.max(1, t.mechMaxHp) : t.meter / GAME.transform.meterMax;
  return (
    <div className={`mech-meter${pct >= 100 && t.phase === "normal" ? " mech-meter--ready" : ""}${t.phase === "active" ? " mech-meter--active" : ""}`}>
      <span className="mech-meter__label">{label}</span>
      <span className="mech-meter__bar">
        <span style={{ width: `${Math.round(fill * 100)}%` }} />
      </span>
    </div>
  );
}

/** Banner khi rơi đồ Sử thi trở lên */
export function DropBanner() {
  const drop = useHunter((s) => s.lastDrop);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!drop || rarityIndex(drop.part.rarity) < rarityIndex("epic")) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(id);
  }, [drop]);
  if (!drop || !visible) return null;
  const c = RARITY_COLOR[drop.part.rarity];
  return (
    <div className="drop-banner" style={{ borderColor: c, boxShadow: `0 0 28px ${c}66` }} role="status">
      <span className="drop-banner__eyebrow" style={{ color: c }}>
        {RARITY_LABEL[drop.part.rarity].toUpperCase()}
      </span>
      <span className="drop-banner__name">{drop.part.name}</span>
      <span className="drop-banner__slot">
        {SLOT_LABEL[drop.part.slot]} · ×{drop.part.statMul.toFixed(2)}
      </span>
    </div>
  );
}

function SeasonBlock() {
  const season = useHunter((s) => s.season);
  const mech = useHunter((s) => s.mechs.find((m) => m.id === s.equipped) ?? null);
  const tier = launchpadTier(season, { legendaryMech: !!mech && rarityIndex(mechRarity(mech.parts)) >= rarityIndex("legendary") });
  return (
    <div className="hunter-season">
      <div className="hunter-season__head">
        <span>MÙA {season.season}</span>
        <span>
          Điểm mùa <b>{season.points.toLocaleString("vi-VN")}</b>
        </span>
        <span>Tier: {tier ? <b>{TIER_LABEL[tier]}</b> : "chưa đạt"}</span>
      </div>
      {GAME.season.maps
        .filter((m) => m.key)
        .map((m) => {
          const shards = season.shards[m.id as keyof typeof season.shards] ?? 0;
          const has = season.keys.includes(m.key as never);
          return (
            <div key={m.id} className="hunter-season__map">
              <span>
                {MAP_LABEL[m.id]} · Chìa {KEY_LABEL[m.key!]}
              </span>
              <span className="hunter-season__bar">
                <span style={{ width: `${(shards / GAME.season.shardsPerKey) * 100}%` }} />
              </span>
              <span>{has ? "✓ Có Chìa" : `${shards}/${GAME.season.shardsPerKey}`}</span>
            </div>
          );
        })}
    </div>
  );
}

function ContractBoardPanel() {
  useTicker(1000);
  const h = useHunter();
  const energy = h.energyNow();
  const mech = h.equippedMech();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="hunter-panel" role="dialog" aria-label="Bảng hợp đồng">
      <header className="hunter-panel__head">
        <div>
          <p className="bag__eyebrow">NEXUS · NEON CITY · VÙNG AN TOÀN</p>
          <h2 className="bag__title">Bảng hợp đồng</h2>
        </div>
        <div className="hunter-energy" title="Năng lượng hồi 1 mỗi giờ">
          {Array.from({ length: GAME.energy.max }, (_, i) => (
            <span key={i} className={i < energy.value ? "on" : ""} />
          ))}
          <small>
            {energy.value}/{GAME.energy.max}
            {energy.value < GAME.energy.max && ` · +1 sau ${Math.ceil(msToNextEnergy(energy, Date.now()) / 60000)} phút`}
          </small>
        </div>
      </header>
      <ul className="hunter-rules">
        <li>
          <b>7 phút</b>, <b>{GAME.match.missionMarkers} nhiệm vụ</b> trên bản đồ: đua xe, cướp xe, giao hàng, rượt đuổi.
        </li>
        <li>
          Mỗi nhiệm vụ: +{GAME.match.score.mission} điểm, +{GAME.transform.gain.mission}% biến hình, 1 lượt rơi linh kiện,{" "}
          {Math.round(GAME.match.shardChancePerMission * 100)}% ra Mảnh Chìa.
        </li>
        <li>Phút 4 có sự kiện ngẫu nhiên. Từ phút 5 điểm thoát hiện ra: tới đó để giữ 100% đồ.</li>
        <li>Chết hoặc hết giờ: mất 50% mảnh và 50% đồ từ Hiếm trở xuống. Đồ Huyền thoại trở lên không bao giờ mất.</li>
      </ul>
      <SeasonBlock />
      <div className="hunter-panel__mech">
        {mech ? (
          <>
            Mech đang dùng: <RarityTag r={mechRarity(mech.parts)} /> Sức mạnh <b>{mechPower(mech.parts)}</b> · Độ bền{" "}
            <b>
              {mech.durability}/{maxDurability(mechRarity(mech.parts))}
            </b>
          </>
        ) : (
          "Chưa trang bị Mech: vào Gara để ráp từ 4 linh kiện"
        )}
      </div>
      {msg && <p className="hunter-panel__msg">{msg}</p>}
      <footer className="bag__foot">
        <button type="button" className="bag__close" onClick={() => h.setPanel(null)}>
          Đóng (Esc)
        </button>
        <button type="button" className="bag__toggle" onClick={() => h.setPanel("garage")}>
          Gara Mech
        </button>
        <button
          type="button"
          className="bag__use"
          disabled={energy.value < 1}
          onClick={() => {
            const err = startNewContract();
            if (err) setMsg(err);
          }}
        >
          Nhận hợp đồng (−1 ⚡)
        </button>
      </footer>
    </div>
  );
}

function ResultPanel() {
  const h = useHunter();
  const r = h.result;
  if (!r) return null;
  const title = r.status === "extracted" ? "THOÁT THÀNH CÔNG" : r.status === "dead" ? "HY SINH" : "HẾT GIỜ";
  const color = r.status === "extracted" ? "#39ff88" : "#ff1f3d";
  const sorted = [...r.keptLoot].sort((a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity));
  return (
    <div className="hunter-panel" role="dialog" aria-label="Kết quả hợp đồng">
      <header className="hunter-panel__head">
        <div>
          <p className="bag__eyebrow">KẾT QUẢ HỢP ĐỒNG</p>
          <h2 className="bag__title" style={{ color }}>
            {title}
          </h2>
        </div>
        <div className="hunter-stars" aria-label={`${r.stars} sao`}>
          {[1, 2, 3].map((i) => (
            <span key={i} className={i <= r.stars ? "on" : ""}>
              ★
            </span>
          ))}
        </div>
      </header>
      <dl className="hunter-result">
        <dt>Điểm</dt>
        <dd>{r.score}</dd>
        <dt>Điểm mùa</dt>
        <dd>+{r.seasonPoints}</dd>
        <dt>Mảnh Chìa</dt>
        <dd>
          +{r.shards}
          {r.lostShards > 0 && <span className="lost"> (mất {r.lostShards})</span>}
        </dd>
      </dl>
      <h3 className="bag__section">Linh kiện nhận được ({sorted.length})</h3>
      {sorted.length === 0 ? <p className="bag__empty">Không có.</p> : <PartList parts={sorted} />}
      {r.lostLoot.length > 0 && (
        <>
          <h3 className="bag__section lost">Bị mất ({r.lostLoot.length})</h3>
          <PartList parts={r.lostLoot} dim />
        </>
      )}
      <footer className="bag__foot">
        <button type="button" className="bag__close" onClick={() => h.setPanel(null)}>
          Đóng
        </button>
        <button type="button" className="bag__use" onClick={() => h.setPanel("garage")}>
          Mở Gara
        </button>
      </footer>
    </div>
  );
}

function PartList({
  parts,
  dim,
  selected,
  onToggle,
}: {
  parts: MechPart[];
  dim?: boolean;
  selected?: Set<string>;
  onToggle?: (p: MechPart) => void;
}) {
  return (
    <ul className={`parts${dim ? " parts--dim" : ""}`}>
      {parts.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className={`part${selected?.has(p.id) ? " part--on" : ""}`}
            style={{ borderColor: RARITY_COLOR[p.rarity] }}
            disabled={!onToggle}
            onClick={() => onToggle?.(p)}
          >
            <span className="part__slot">{SLOT_LABEL[p.slot]}</span>
            <span className="part__name" style={{ color: RARITY_COLOR[p.rarity] }}>
              {p.name}
            </span>
            <span className="part__stat">×{p.statMul.toFixed(2)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MechCard({ mech, equipped }: { mech: Mech; equipped: boolean }) {
  const h = useHunter();
  const r = mechRarity(mech.parts);
  const max = maxDurability(r);
  const power = mechPower(mech.parts);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <li className={`mech-card${equipped ? " mech-card--on" : ""}`} style={{ borderColor: RARITY_COLOR[r] }}>
      <div className="mech-card__head">
        <b>Titan Frame</b> <RarityTag r={r} />
        <span className="mech-card__power">
          Sức mạnh {power} <small>(+{Math.round((power / BASE_MECH_POWER - 1) * 100)}%)</small>
        </span>
      </div>
      <div className="mech-card__parts">
        {MECH_SLOTS.map((s) => (
          <span key={s} style={{ color: RARITY_COLOR[mech.parts[s].rarity] }}>
            {SLOT_LABEL[s]}: {mech.parts[s].name}
          </span>
        ))}
      </div>
      <div className="mech-card__dur">
        Độ bền {mech.durability}/{max}
        <span className="hunter-season__bar">
          <span style={{ width: `${(mech.durability / max) * 100}%`, background: mech.durability > 0 ? undefined : "#ff1f3d" }} />
        </span>
      </div>
      <div className="mech-card__actions">
        {!equipped && (
          <button type="button" className="bag__toggle" onClick={() => h.equipMech(mech.id)}>
            Trang bị
          </button>
        )}
        {mech.durability < max && (
          <button
            type="button"
            className="bag__toggle"
            onClick={() => {
              const r2 = h.repair(mech.id);
              setMsg(r2 === "poor" ? "Không đủ $CRED" : r2 === "ok" ? "Đã sửa đầy" : null);
            }}
          >
            Sửa ({Math.ceil(repairCost(mech))} $CRED)
          </button>
        )}
        <button type="button" className="bag__toggle" onClick={() => h.dismantle(mech.id)}>
          Tháo rời
        </button>
        {mech.durability === 0 && (
          <button type="button" className="bag__toggle" onClick={() => setMsg(h.smeltMech(mech.id))}>
            Nung chảy
          </button>
        )}
      </div>
      {msg && <p className="hunter-panel__msg">{msg}</p>}
    </li>
  );
}

function GaragePanel() {
  const h = useHunter();
  const cred = useGame((s) => s.cred);
  const [mode, setMode] = useState<"assemble" | "craft">("assemble");
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const parts = useMemo(
    () => [...h.parts].sort((a, b) => rarityIndex(b.rarity) - rarityIndex(a.rarity) || a.slot.localeCompare(b.slot)),
    [h.parts],
  );
  const picked = parts.filter((p) => pick.has(p.id));

  const toggle = (p: MechPart) => {
    const next = new Set(pick);
    if (next.has(p.id)) next.delete(p.id);
    else if (mode === "assemble") {
      // Mỗi khe chỉ chọn 1 món
      for (const q of picked) if (q.slot === p.slot) next.delete(q.id);
      next.add(p.id);
    } else {
      if (picked.length && picked[0].rarity !== p.rarity) return setMsg("Ghép cần 5 món cùng độ hiếm");
      if (next.size >= GAME.craft.inputCount) return;
      next.add(p.id);
    }
    setMsg(null);
    setPick(next);
  };

  const preview = Object.fromEntries(picked.map((p) => [p.slot, p])) as Partial<Record<MechSlot, MechPart>>;
  const recipe =
    picked[0] && picked[0].rarity !== "legendary" && picked[0].rarity !== "mythic"
      ? GAME.craft.recipes[
          (["common_to_rare", "rare_to_epic", "epic_to_legendary"] as const)[rarityIndex(picked[0].rarity)]
        ]
      : null;

  return (
    <div className="hunter-panel hunter-panel--wide" role="dialog" aria-label="Gara Mech">
      <header className="hunter-panel__head">
        <div>
          <p className="bag__eyebrow">GARA · RÁP · GHÉP · SỬA</p>
          <h2 className="bag__title">Gara Mech</h2>
        </div>
        <div className="hunter-cred">
          {cred} <small>$CRED</small>
        </div>
      </header>
      <h3 className="bag__section">Mech của bạn ({h.mechs.length})</h3>
      {h.mechs.length === 0 ? (
        <p className="bag__empty">Chưa có Mech. Chọn 4 linh kiện (Lõi, Giáp, Vũ khí, Động cơ) bên dưới để ráp.</p>
      ) : (
        <ul className="mech-list">
          {h.mechs.map((m) => (
            <MechCard key={m.id} mech={m} equipped={m.id === h.equipped} />
          ))}
        </ul>
      )}
      <div className="garage-tabs" role="tablist">
        {(["assemble", "craft"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            className={mode === m ? "on" : ""}
            onClick={() => {
              setMode(m);
              setPick(new Set());
              setMsg(null);
            }}
          >
            {m === "assemble" ? "Ráp Mech" : "Ghép 5 → 1"}
          </button>
        ))}
      </div>
      <p className="garage-hint">
        {mode === "assemble"
          ? `Chọn 1 món mỗi khe. Sức mạnh dự kiến: ${mechPower(preview)} (${Object.keys(preview).length}/4 khe)`
          : recipe
            ? `Đã chọn ${picked.length}/5 · Phí ${recipe.costToken} $CRED · Thành công ${Math.round(recipe.successRate * 100)}%`
            : "Chọn 5 linh kiện cùng độ hiếm (Thường, Hiếm hoặc Sử thi)"}
      </p>
      <h3 className="bag__section">
        Kho linh kiện ({parts.length}){" "}
        <small className="garage-count">
          {RARITIES.map((r) => {
            const n = parts.filter((p) => p.rarity === r).length;
            return n ? (
              <span key={r} style={{ color: RARITY_COLOR[r] }}>
                {RARITY_LABEL[r]} {n}
              </span>
            ) : null;
          })}
        </small>
      </h3>
      {parts.length === 0 ? (
        <p className="bag__empty">Trống. Làm hợp đồng ở Bảng hợp đồng để nhặt linh kiện.</p>
      ) : (
        <PartList parts={parts} selected={pick} onToggle={toggle} />
      )}
      {msg && <p className="hunter-panel__msg">{msg}</p>}
      <footer className="bag__foot">
        <button type="button" className="bag__close" onClick={() => h.setPanel(null)}>
          Đóng (Esc)
        </button>
        {mode === "assemble" ? (
          <button
            type="button"
            className="bag__use"
            disabled={Object.keys(preview).length < 4}
            onClick={() => {
              const err = h.assemble(Object.fromEntries(picked.map((p) => [p.slot, p.id])) as Record<MechSlot, string>);
              setMsg(err ?? "Đã ráp Mech mới");
              if (!err) setPick(new Set());
            }}
          >
            Ráp Mech
          </button>
        ) : (
          <button
            type="button"
            className="bag__use"
            disabled={picked.length !== GAME.craft.inputCount}
            onClick={() => {
              setMsg(h.craftParts(picked.map((p) => p.id)));
              setPick(new Set());
            }}
          >
            Ghép
          </button>
        )}
      </footer>
    </div>
  );
}

/** Bảng đang mở của Hunter, Esc để đóng */
export function HunterPanels() {
  const panel = useHunter((s) => s.panel);
  const setPanel = useHunter((s) => s.setPanel);
  const inContract = useHunter((s) => s.contract !== null);
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, setPanel]);
  if (panel === "contracts") return inContract ? <AbandonPanel /> : <ContractBoardPanel />;
  if (panel === "result") return <ResultPanel />;
  if (panel === "garage") return <GaragePanel />;
  return null;
}

function AbandonPanel() {
  const setPanel = useHunter((s) => s.setPanel);
  return (
    <div className="hunter-panel" role="dialog" aria-label="Hợp đồng đang chạy">
      <p className="bag__eyebrow">HỢP ĐỒNG ĐANG CHẠY</p>
      <p className="bag__empty">Bỏ hợp đồng sẽ tính như hy sinh: mất 50% mảnh và đồ từ Hiếm trở xuống.</p>
      <footer className="bag__foot">
        <button type="button" className="bag__close" onClick={() => setPanel(null)}>
          Tiếp tục chơi
        </button>
        <button type="button" className="bag__toggle" onClick={abandonContract}>
          Bỏ hợp đồng
        </button>
      </footer>
    </div>
  );
}
