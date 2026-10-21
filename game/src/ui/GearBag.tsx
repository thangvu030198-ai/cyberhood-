// Túi đồ dạng lưới ô (kiểu Stardew Valley, màu neon cyberpunk): hai ô trang bị (vũ khí, giáp) và lưới ô vật phẩm. Bấm một ô để xem, bấm "Trang bị" để mặc.
// Trang bị dùng cho màn 2D sau cổng nhiệm vụ.

import { useEffect, useState } from "react";
import { GEAR, GEAR_IDS, WEAPONS, ARMORS, SLOTS, loadoutStats, type GearId, type Slot } from "../level/gear";
import { loadoutOf, useGear } from "../game/gearStore";
import { useHunter } from "../game/hunter";
import { useGame } from "../game/store";
import { RARITY_LABEL } from "../sim/loot";
import { RARITIES, type Rarity } from "../sim/config";

const RARITY_HEX: Record<Rarity, string> = { common: "#c9d0d8", rare: "#5ab4ff", epic: "#c27dff", legendary: "#ffc23d", mythic: "#ff4a64" };
const CELLS = 24;

const STYLE_LABEL: Record<string, string> = {
  buster: "Bắn thường, giữ để nạp",
  auto: "Liên thanh",
  spread: "Chùm đạn",
  rail: "Đạn xuyên",
  bow: "Kéo dây",
  blade: "Cận chiến + sóng kiếm",
};

type Cell =
  | { kind: "gear"; id: GearId; count: number }
  | { kind: "chestKey"; count: number }
  | { kind: "stim"; count: number }
  | { kind: "parts"; rarity: Rarity; count: number };

function icon(c: Cell) {
  if (c.kind === "gear") return <img src={`icons/gear/${c.id}.webp`} alt="" draggable={false} />;
  if (c.kind === "chestKey") return <span className="gbag__glyph" style={{ color: "#7dffb0" }}>⚿</span>;
  if (c.kind === "stim") return <span className="gbag__glyph" style={{ color: "#7dff9a" }}>✚</span>;
  return <span className="gbag__glyph" style={{ color: RARITY_HEX[c.rarity] }}>◆</span>;
}

function title(c: Cell) {
  if (c.kind === "gear") return GEAR[c.id].name;
  if (c.kind === "chestKey") return "Chìa rương";
  if (c.kind === "stim") return "Stim Pack";
  return `Linh kiện ${RARITY_LABEL[c.rarity]}`;
}

function detail(c: Cell) {
  if (c.kind === "gear") {
    const g = GEAR[c.id];
    const extra =
      g.slot === "weapon"
        ? `${STYLE_LABEL[WEAPONS[c.id as keyof typeof WEAPONS].style]} · sát thương ${WEAPONS[c.id as keyof typeof WEAPONS].dmg}`
        : g.slot === "armor"
          ? `+${ARMORS[c.id as keyof typeof ARMORS].hp} máu · giảm ${Math.round(ARMORS[c.id as keyof typeof ARMORS].reduce * 100)}% sát thương`
          : statText(g.stats ?? {});
    return `${g.blurb} (${extra})`;
  }
  if (c.kind === "chestKey") return "Mở rương giấu trong màn 2D. Rơi từ địch, trùm, thưởng nhiệm vụ.";
  if (c.kind === "stim") return "Hồi máu trong thành phố (phím Q).";
  return "Lắp vào mech ở Gara (phím G).";
}

const STAT_LABEL: Record<string, [string, boolean]> = {
  atk: ["Tấn công", true],
  hp: ["Máu", false],
  def: ["Giảm sát thương", true],
  speed: ["Tốc chạy", true],
  jump: ["Nhảy cao", true],
  charge: ["Nạp đạn", true],
  luck: ["May mắn", true],
};

/** "Tấn công +12% · Máu +4" */
export function statText(st: Partial<Record<string, number>>) {
  return Object.entries(st)
    .filter(([, v]) => v && Math.abs(v) > 1e-3)
    .map(([k, v]) => `${STAT_LABEL[k][0]} ${v! > 0 ? "+" : ""}${STAT_LABEL[k][1] ? Math.round(v! * 100) + "%" : Math.round(v!)}`)
    .join(" · ");
}

export function GearBag() {
  const owned = useGear((s) => s.owned);
  const weapon = useGear((s) => s.weapon);
  const armor = useGear((s) => s.armor);
  const head = useGear((s) => s.head);
  const hands = useGear((s) => s.hands);
  const feet = useGear((s) => s.feet);
  const chip = useGear((s) => s.chip);
  const enh = useGear((s) => s.enh);
  const unequip = useGear((s) => s.unequip);
  const fresh = useGear((s) => s.fresh);
  const equip = useGear((s) => s.equip);
  const seen = useGear((s) => s.seen);
  const parts = useHunter((s) => s.parts);
  const inventory = useGame((s) => s.inventory);
  const [pick, setPick] = useState<number | null>(null);
  // Mở túi là coi như đã xem đồ mới
  useEffect(() => {
    if (fresh.length) {
      const t = setTimeout(seen, 2500);
      return () => clearTimeout(t);
    }
  }, [fresh, seen]);

  const cells: Cell[] = [
    ...GEAR_IDS.filter((id) => owned[id]).map((id) => ({ kind: "gear" as const, id, count: owned[id]! })),
    ...((inventory.chestKey ?? 0) > 0 ? [{ kind: "chestKey" as const, count: inventory.chestKey! }] : []),
    ...((inventory.stim ?? 0) > 0 ? [{ kind: "stim" as const, count: inventory.stim! }] : []),
    ...RARITIES.map((r) => ({ kind: "parts" as const, rarity: r, count: parts.filter((p) => p.rarity === r).length })).filter((c) => c.count > 0),
  ];
  const sel = pick !== null ? cells[pick] : null;
  const worn: Record<Slot, GearId | null> = { weapon: weapon === "buster" ? null : weapon, armor: armor === "none" ? null : armor, head, hands, feet, chip };
  const equipped = (id: GearId) => Object.values(worn).includes(id);
  const total = loadoutStats(loadoutOf({ weapon, armor, head, hands, feet, chip }), enh);
  const plus = (id: GearId) => (enh[id] ? ` +${enh[id]}` : "");

  return (
    <section className="gbag" aria-label="Trang bị">
      {/* Búp bê trang bị: 6 ô quanh nhân vật, bấm ô đang mặc để tháo */}
      <div className="gbag__equip">
        {SLOTS.map((sl) => {
          const id = worn[sl.id];
          return (
            <button type="button" key={sl.id} className={`gbag__slot gbag__slot--eq gbag__slot--${sl.id}`} title={id ? `${GEAR[id].name}${plus(id)} · bấm để tháo` : sl.label} onClick={() => id && unequip(sl.id)}>
              {id ? <img src={`icons/gear/${id}.webp`} alt="" /> : <span className="gbag__glyph">{sl.id === "weapon" ? "✦" : "▢"}</span>}
              <small>{id ? `${GEAR[id].name}${plus(id)}` : sl.id === "weapon" ? "X-Buster" : sl.label}</small>
            </button>
          );
        })}
        <p className="gbag__total">{statText(total) || "Chưa có chỉ số cộng thêm"}</p>
      </div>
      <div className="gbag__grid">
        {Array.from({ length: Math.max(CELLS, Math.ceil(cells.length / 8) * 8) }, (_, i) => {
          const c = cells[i];
          const rarity = c?.kind === "gear" ? GEAR[c.id].rarity : c?.kind === "parts" ? c.rarity : null;
          return (
            <button
              type="button"
              key={i}
              className={`gbag__slot${pick === i ? " is-picked" : ""}${c?.kind === "gear" && equipped(c.id) ? " is-equipped" : ""}`}
              style={rarity ? { borderColor: RARITY_HEX[rarity] } : undefined}
              onClick={() => c && setPick(i)}
              disabled={!c}
              aria-label={c ? title(c) : "Ô trống"}
            >
              {c && icon(c)}
              {c && c.count > 1 && <span className="gbag__count">{c.count}</span>}
              {c?.kind === "gear" && enh[c.id] ? <span className="gbag__enh">+{enh[c.id]}</span> : null}
              {c?.kind === "gear" && fresh.includes(c.id) && <span className="gbag__new">MỚI</span>}
            </button>
          );
        })}
      </div>
      <div className="gbag__info">
        {sel ? (
          <>
            <b style={{ color: sel.kind === "gear" ? RARITY_HEX[GEAR[sel.id].rarity] : sel.kind === "parts" ? RARITY_HEX[sel.rarity] : undefined }}>
              {title(sel)}
              {sel.kind === "gear" && `${plus(sel.id)} · ${RARITY_LABEL[GEAR[sel.id].rarity]}`}
            </b>
            <span>{detail(sel)}</span>
            {sel.kind === "gear" &&
              (equipped(sel.id) ? (
                <button type="button" className="bag__use" onClick={() => unequip(GEAR[sel.id].slot)}>
                  Tháo
                </button>
              ) : (
                <button type="button" className="bag__use" onClick={() => equip(sel.id)}>
                  Trang bị
                </button>
              ))}
          </>
        ) : (
          <span>
            Vũ khí và giáp rơi từ địch, trùm và rương trong màn 2D (đồ càng hiếm càng ít rơi). Bấm một ô để xem và trang bị.
          </span>
        )}
      </div>
    </section>
  );
}
