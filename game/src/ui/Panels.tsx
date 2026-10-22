import { useEffect, useState } from "react";
import { GearBag } from "./GearBag";
import { serviceById } from "../game/services";
import { PALETTE } from "../game/config";
import { chooseDialogue, currentStep } from "../game/quests";
import { useGame } from "../game/store";
import type { HunterSkin } from "../game/skins";
import { SkinPicker } from "./SkinPicker";
import { LanguagePicker } from "./LanguagePicker";
import { ITEMS, NPCS, questById, type ItemId } from "../game/story";

// Các bảng giao diện của giai đoạn 3: tạo nhân vật, theo dõi nhiệm vụ, hội thoại, túi đồ, thông báo.

const BODY_COLORS = ["#3a1a4a", "#0b2a33", "#2a2410", "#1a1a1f", "#0f2a1a", "#3a0f18"];
const GLOW_COLORS = [PALETTE.pink, PALETTE.cyan, PALETTE.amber, "#39ff88", PALETTE.purple, "#ff1f3d"];

export const CREDITS = [
  "Nhân vật: Soldier, Xbot · Mixamo (Adobe)",
  "Xe: “Car Concept” · Eric Chadwick, Darmstadt Graphics Group · CC-BY 4.0",
  "Server Vault: “Space Ship Hallway” · yeeyeeman (sketchfab.com/yeeyeeman) · CC-BY 4.0",
  "Phố, biển neon, tàu điện: Polygonal Mind · CC0",
  "Nóc nhà: KayKit Space Base · Kay Lousberg · CC0",
  "Drone, súng, âm thanh: Kenney · CC0",
  "Titan Frame, trùm robot đỏ, xe nâng bay: Godot TPS Demo · Juan Linietsky, Fernando Calabró · CC-BY 3.0",
  "“Littlest Tokyo” · Glen Fox · CC-BY 4.0",
  "“Lulaby city” · jemepousse · CC-BY 4.0",
  "“Old Computers” · Rafael Rodrigues · CC-BY 4.0",
  "“Love neon sign 02” · daysena · CC-BY 4.0",
  "“Black Honey - Robotic Arm” (Sketchfab) · CC-BY 4.0",
  "“Primary Ion Drive” · Mike Murdock · CC-BY 4.0",
  "Commercial Refrigerator · Eric Chadwick, Darmstadt Graphics Group, Sean Thomas · CC-BY 4.0",
  "Low Poly Spaceship · EdwinRC · CC-BY 2.0",
  "UFO, cổng dịch chuyển, cây holo: Polygonal Mind · CC0 · Thùng sci-fi: Sara Vieira · CC0",
  "Drone “S2WT Kamdo” · Hansalex · CC-BY 4.0",
  "UFO lớn · Babylon.js Assets · CC-BY 4.0",
  "“SciFi Platform Stage Scene” (Sketchfab) · CC-BY 4.0",
  "Traffic Cone · hinndia · CC-BY 4.0",
  "Người đi bộ: 100Avatars · Polygonal Mind · CC0 · Robot: Tomás Laulhé · CC0",
  "Trực thăng: sriniwasjha · CC0",
  "Lính Legion, nhân vật, dân thường, xe cộ, nhà cửa, công trình bản đồ, mech, vật phẩm: tạo bằng Meshy AI (animation từ thư viện Meshy)",
];

export function CharacterCreator() {
  const profile = useGame((s) => s.profile);
  const setProfile = useGame((s) => s.setProfile);
  const [handle, setHandle] = useState("");
  const [body, setBody] = useState(BODY_COLORS[0]);
  const [glow, setGlow] = useState(GLOW_COLORS[0]);
  const [hunter, setHunter] = useState<HunterSkin>("soldier");

  if (profile) return null;
  const clean = handle.trim();
  const valid = /^[\p{L}\p{N}_ -]{3,16}$/u.test(clean);

  return (
    <form
      className="creator"
      aria-label="Tạo Netrunner ID"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setProfile({ handle: clean, body, glow, hunter });
      }}
    >
      <LanguagePicker compact />
      <p className="creator__eyebrow">CYBERHOOD · ĐĂNG KÝ CƯ DÂN</p>
      <h2 className="creator__title">Tạo Netrunner ID</h2>
      <label className="creator__field" htmlFor="handle">
        <span>Biệt danh (3–16 ký tự)</span>
        <input
          id="handle"
          autoFocus
          maxLength={16}
          value={handle}
          placeholder="Ví dụ: Parzival"
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </label>
      <SkinPicker value={hunter} onChange={setHunter} tint={body} />
      <fieldset className="creator__swatches">
        <legend>Màu vỏ</legend>
        {BODY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${c === body ? " swatch--on" : ""}`}
            style={{ background: c }}
            aria-label={`Màu vỏ ${c}`}
            aria-pressed={c === body}
            onClick={() => setBody(c)}
          />
        ))}
      </fieldset>
      <fieldset className="creator__swatches">
        <legend>Màu đèn neon</legend>
        {GLOW_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${c === glow ? " swatch--on" : ""}`}
            style={{ background: c, boxShadow: c === glow ? `0 0 12px ${c}` : undefined }}
            aria-label={`Màu đèn ${c}`}
            aria-pressed={c === glow}
            onClick={() => setGlow(c)}
          />
        ))}
      </fieldset>
      <button type="submit" className="creator__go" disabled={!valid}>
        Jack in
      </button>
      <p className="creator__credits">{CREDITS.map((c, i) => (
          <span key={i}>{(i ? " · " : "") + c}</span>
        ))}</p>
    </form>
  );
}

export function QuestTracker() {
  const quest = useGame((s) => s.quest);
  const q = questById(quest.active);
  const step = q ? currentStep() : null;
  if (!q || !step) {
    if (quest.done.length >= 5) {
      return (
        <div className="tracker">
          <span className="tracker__title">Root Protocol</span>
          <span className="tracker__step">Firewall 1 sẽ mở ở bản cập nhật sau</span>
        </div>
      );
    }
    return null;
  }
  const count = step.kind === "kill" || step.kind === "collect" ? ` (${quest.progress}/${step.count})` : "";
  return (
    <div className="tracker" aria-live="polite">
      <span className="tracker__title">{q.title}</span>
      <span className="tracker__step">
        {step.text}
        {count}
      </span>
    </div>
  );
}

export function DialoguePanel() {
  const dialogue = useGame((s) => s.dialogue);
  useEffect(() => {
    if (!dialogue) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= dialogue.choices.length) {
        e.stopPropagation();
        chooseDialogue(n - 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dialogue]);
  if (!dialogue) return null;
  const npc = NPCS[dialogue.npc];
  return (
    <div className="dialogue" role="dialog" aria-label={`Hội thoại với ${npc.name}`} style={{ borderColor: npc.glow }}>
      <p className="dialogue__who">
        <span style={{ color: npc.glow }}>{npc.name}</span> · {npc.role}
      </p>
      <p className="dialogue__text">{dialogue.text}</p>
      <div className="dialogue__choices">
        {dialogue.choices.map((c, i) => (
          <button key={c.label} type="button" className="dialogue__choice" onClick={() => chooseDialogue(i)}>
            <kbd>{i + 1}</kbd> {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function InventoryPanel() {
  const open = useGame((s) => s.inventoryOpen);
  const inventory = useGame((s) => s.inventory);
  const profile = useGame((s) => s.profile);
  const kills = useGame((s) => s.kills);
  const done = useGame((s) => s.quest.done.length);
  const upgrades = useGame((s) => s.upgrades);
  const quality = useGame((s) => s.quality);
  const setQuality = useGame((s) => s.setQuality);
  const close = useGame((s) => s.setInventoryOpen);
  const useStim = useGame((s) => s.useStim);
  if (!open) return null;
  const items = (Object.keys(ITEMS) as ItemId[]).filter((id) => (inventory[id] ?? 0) > 0);
  const owned = [
    upgrades.repeater && "Blaster Repeater",
    upgrades.armor && "Dermal Plating",
    upgrades.overclock && "Neural Overclock",
  ].filter(Boolean);

  return (
    <div className="bag" role="dialog" aria-label="Túi đồ">
      <header className="bag__head">
        <div>
          <p className="bag__eyebrow">NETRUNNER ID</p>
          <h2 className="bag__title" style={{ color: profile?.glow }}>
            {profile?.handle ?? "—"}
          </h2>
        </div>
        <dl className="bag__stats">
          <dt>Hạ gục</dt>
          <dd>{kills}</dd>
          <dt>Nhiệm vụ</dt>
          <dd>{done}/5</dd>
        </dl>
      </header>
      <h3 className="bag__section">Trang bị · Túi đồ</h3>
      <GearBag />
      <h3 className="bag__section">Vật phẩm</h3>
      {items.length === 0 ? (
        <p className="bag__empty">Trống. Mua Stim Pack ở quầy của Vex.</p>
      ) : (
        <ul className="bag__list">
          {items.map((id) => (
            <li key={id} className="bag__item">
              <div className="bag__info">
                <span className="bag__name">
                  {ITEMS[id].name} <span className="bag__count">×{inventory[id]}</span>
                </span>
                <span className="bag__desc">{ITEMS[id].desc}</span>
              </div>
              {ITEMS[id].usable && (
                <button type="button" className="bag__use" onClick={() => useStim()}>
                  Dùng
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <h3 className="bag__section">
        <span aria-hidden>🌐 </span>Ngôn ngữ
      </h3>
      <LanguagePicker />
      <h3 className="bag__section">Cấy ghép</h3>
      <p className="bag__empty">{owned.length ? owned.join(" · ") : "Chưa có. Ghé chợ đen Neon Bazaar."}</p>
      <footer className="bag__foot">
        <button
          type="button"
          className="bag__toggle"
          onClick={() => setQuality(quality === "high" ? "low" : "high")}
        >
          Đồ hoạ: {quality === "high" ? "Cao" : "Thấp"}
        </button>
        <button type="button" className="bag__close" onClick={() => close(false)}>
          Đóng (Tab)
        </button>
      </footer>
      <p className="bag__credits">{CREDITS.map((c, i) => (
          <span key={i}>{(i ? " · " : "") + c}</span>
        ))}</p>
    </div>
  );
}

export function Toast() {
  const toast = useGame((s) => s.toast);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3600);
    return () => clearTimeout(id);
  }, [toast]);
  if (!toast || !visible) return null;
  return (
    <div className="toast" role="status">
      {toast.text}
    </div>
  );
}

const INTERACT_LABEL = {
  door: "Vào Server Vault",
  exit: "Rời Server Vault",
  terminal: "Kích hoạt terminal GHOST_0",
  board: "Mở bảng hợp đồng",
  gate: "Qua cổng nhiệm vụ: chọn map",
  missions: "Xem nhiệm vụ ngày · tuần · tháng",
  siege: "Qua Cổng Công Thành: Đại chiến Thành Băng",
  raid: "Cổng Sinh Vật Cổ Đại: raid 4–10 người",
} as const;

export function interactLabel(i: NonNullable<ReturnType<typeof useGame.getState>["nearInteract"]>) {
  if (i.kind === "npc") return `Nói chuyện với ${NPCS[i.id].name}`;
  if (i.kind === "service") return `${serviceById(i.id).npc} · ${serviceById(i.id).title}`;
  return INTERACT_LABEL[i.kind];
}
