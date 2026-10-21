import { useEffect, useState } from "react";
import { Joystick, VirtualButton } from "ecctrl/input";
import { CARS } from "../game/Vehicles";
import { MAX_WANTED, SHOP_ITEMS, districtAt, gridRef, useGame, type Emote, type ShopItemId } from "../game/store";
import { Minimap } from "./Minimap";
import { pointer } from "../game/pointer";
import { loadProgress } from "../game/assets";
import { ContractHud, DropBanner, HunterPanels, MechMeter } from "./HunterUi";
import { useHunter } from "../game/hunter";
import { inSafeZone } from "../game/config";
import { CharacterCreator, DialoguePanel, InventoryPanel, QuestTracker, Toast, interactLabel } from "./Panels";

const EMOTE_KEYS: Record<string, Emote> = { Digit1: "wave", Digit2: "dance", Digit3: "thumbsUp" };

// Nút cảm ứng nằm trong cột flex ở góc phải thay vì vị trí fixed mặc định của ecctrl.
const TOUCH_BUTTON = {
  position: "relative",
  width: "64px",
  height: "64px",
  background: "rgba(13, 2, 33, 0.55)",
  border: "1px solid rgba(255, 42, 109, 0.7)",
} as const;
const TOUCH_CAP = {
  width: "52px",
  height: "52px",
  background: "rgba(255, 42, 109, 0.25)",
  color: "#e9e6f5",
  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
  fontSize: "11px",
} as const;
const FIRE_BUTTON = { ...TOUCH_BUTTON, width: "84px", height: "84px", border: "1px solid rgba(5, 217, 232, 0.8)" } as const;
const FIRE_CAP = { ...TOUCH_CAP, width: "70px", height: "70px", background: "rgba(5, 217, 232, 0.28)", fontSize: "13px" } as const;

function carName(id: number | null) {
  return CARS.find((c) => c.id === id)?.name ?? "";
}

function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/** Trạng thái hiển thị ngắn hạn (vừa trúng đích, vừa bị bắn, vừa nhặt CRED) theo đồng hồ */
function useNow(hz = 20) {
  const [t, setT] = useState(() => performance.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setT(performance.now() / 1000), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return t;
}

export function LoadingScreen() {
  // Theo dõi số byte model lớn đã tải (model nhỏ nhúng sẵn trong bundle)
  const [p, setP] = useState({ ...loadProgress });
  useEffect(() => {
    const id = setInterval(() => setP({ ...loadProgress }), 150);
    return () => clearInterval(id);
  }, []);
  const pct = p.total ? Math.min(100, (p.loaded / p.total) * 100) : 0;
  return (
    <div className="screen">
      <p className="screen__tag">{p.error ? "SIGNAL LOST" : "JACKING IN…"}</p>
      <h1 className="screen__title glitch">CYBERHOOD</h1>
      <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className="bar__fill" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <p className="screen__body">
        {p.error
          ? `${p.error}. Tải lại trang để thử lần nữa.`
          : `Đang tải thành phố · ${(p.loaded / 1e6).toFixed(1)} / ${(p.total / 1e6).toFixed(1)} MB`}
      </p>
    </div>
  );
}

function Vitals() {
  const hp = useGame((s) => s.hp);
  const maxHp = useGame((s) => s.maxHp);
  const cred = useGame((s) => s.cred);
  const lastLoot = useGame((s) => s.lastLoot);
  const now = useNow(8);
  const low = hp / maxHp < 0.3;
  return (
    <div className="vitals">
      <div className="vitals__row">
        <span className="vitals__label">HP</span>
        <div className={`hpbar${low ? " hpbar--low" : ""}`} role="meter" aria-valuenow={hp} aria-valuemax={maxHp} aria-label="Máu">
          <div className="hpbar__fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
        </div>
        <span className="vitals__num">{Math.ceil(hp)}</span>
      </div>
      <div className="vitals__row">
        <span className="vitals__label">CRED</span>
        <span className="cred">{cred.toLocaleString("vi-VN")}</span>
        {lastLoot && now - lastLoot.at < 1.6 && <span className="loot">+{lastLoot.amount}</span>}
      </div>
    </div>
  );
}

function Wanted() {
  const wanted = useGame((s) => s.wanted);
  if (wanted === 0) return null;
  return (
    <div className="wanted" aria-label={`Mức truy nã ${wanted} trên ${MAX_WANTED}`}>
      <span className="wanted__label">OMNI-DYNE SECURITY</span>
      <span className="wanted__stars">
        {Array.from({ length: MAX_WANTED }, (_, i) => (
          <span key={i} className={i < wanted ? "star star--on" : "star"}>
            ◆
          </span>
        ))}
      </span>
    </div>
  );
}

/** Nhãn Vùng An toàn khi đứng trong Hub */
function SafeZoneTag() {
  const x = useGame((s) => s.x);
  const z = useGame((s) => s.z);
  const location = useGame((s) => s.location);
  if (location !== "city" || !inSafeZone(x, z)) return null;
  return <div className="safe-tag">VÙNG AN TOÀN · Legion không vào được</div>;
}

function Crosshair() {
  const mode = useGame((s) => s.mode);
  const aiming = useGame((s) => s.aiming);
  const lastHitAt = useGame((s) => s.lastHitAt);
  const now = useNow(30);
  if (mode !== "foot") return null;
  const hit = now - lastHitAt < 0.18;
  return <div className={`crosshair${aiming ? " crosshair--aim" : ""}${hit ? " crosshair--hit" : ""}`} aria-hidden="true" />;
}

function DamageFlash() {
  const lastDamageAt = useGame((s) => s.lastDamageAt);
  const hp = useGame((s) => s.hp);
  const maxHp = useGame((s) => s.maxHp);
  const now = useNow(20);
  const fresh = Math.max(0, 1 - (now - lastDamageAt) / 0.5);
  const low = hp / maxHp < 0.3 ? 0.35 : 0;
  const opacity = Math.max(fresh * 0.7, low);
  if (opacity <= 0.01) return null;
  return <div className="damage" style={{ opacity }} aria-hidden="true" />;
}

function Flatline() {
  const flatlinedAt = useGame((s) => s.flatlinedAt);
  if (flatlinedAt === null) return null;
  return (
    <div className="flatline" role="alert">
      <p className="flatline__title">FLATLINED</p>
      <p className="flatline__body">Mất 10% CRED. Đang tái tạo cơ thể tại điểm xuất phát…</p>
    </div>
  );
}

const BUY_MESSAGES = {
  poor: "Không đủ CRED.",
  owned: "Bạn đã có món này.",
  full: "Máu đang đầy.",
} as const;

function ShopPanel() {
  const open = useGame((s) => s.shopOpen);
  const cred = useGame((s) => s.cred);
  const upgrades = useGame((s) => s.upgrades);
  const buy = useGame((s) => s.buy);
  const close = useGame((s) => s.setShopOpen);
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => setNote(null), [open]);
  if (!open) return null;

  const onBuy = (id: ShopItemId, name: string) => {
    const result = buy(id);
    setNote(result === "ok" ? `Đã mua ${name}.` : BUY_MESSAGES[result]);
  };

  return (
    <div className="shop" role="dialog" aria-label="Chợ đen Neon Bazaar">
      <header className="shop__head">
        <div>
          <p className="shop__eyebrow">NEON BAZAAR · CHỢ ĐEN</p>
          <h2 className="shop__title">Ripperdoc Kiosk</h2>
        </div>
        <p className="shop__wallet">
          <span>CRED</span> {cred.toLocaleString("vi-VN")}
        </p>
      </header>
      <ul className="shop__list">
        {SHOP_ITEMS.map((item) => {
          const owned = item.id !== "medkit" && upgrades[item.id];
          return (
            <li key={item.id} className="shop__item">
              <div className="shop__info">
                <span className="shop__name">{item.name}</span>
                <span className="shop__desc">{item.desc}</span>
              </div>
              <button
                type="button"
                className="shop__buy"
                disabled={owned || cred < item.price}
                onClick={() => onBuy(item.id, item.name)}
              >
                {owned ? "Đã có" : `${item.price} CRED`}
              </button>
            </li>
          );
        })}
      </ul>
      <footer className="shop__foot">
        <span className="shop__note" aria-live="polite">
          {note ?? "Hạ drone OMNI-DYNE để nhặt chip CRED."}
        </span>
        <button type="button" className="shop__close" onClick={() => close(false)}>
          Đóng (Esc)
        </button>
      </footer>
    </div>
  );
}

function Help({ mode }: { mode: "foot" | "drive" }) {
  return (
    <aside className="help" aria-label="Điều khiển">
      {mode === "foot" ? (
        <dl>
          <dt>W A S D</dt>
          <dd>Di chuyển · Shift chạy · Space nhảy</dd>
          <dt>Rê chuột</dt>
          <dd>Xoay camera · đẩy lên để ngửa nhìn toà nhà</dd>
          <dt>Chuột trái</dt>
          <dd>Bắn (giữ để bắn liên tục)</dd>
          <dt>Giữ chuột phải</dt>
          <dd>Ngắm qua vai</dd>
          <dt>Esc</dt>
          <dd>Thả chuột ra khỏi game</dd>
          <dt>E</dt>
          <dd>Nói chuyện · tương tác (mua đồ: nói với Vex)</dd>
          <dt>F</dt>
          <dd>Lên/xuống xe</dd>
          <dt>T</dt>
          <dd>Biến hình Mech khi thanh đầy 100%</dd>
          <dt>G</dt>
          <dd>Gara Mech: ráp, ghép, sửa linh kiện</dd>
          <dt>Q · Tab</dt>
          <dd>Dùng Stim Pack · Túi đồ, cài đặt đồ hoạ</dd>
          <dt>1 2 3</dt>
          <dd>Gật đầu · Gật đầu · Lắc đầu</dd>
          <dt>H</dt>
          <dd>Ẩn/hiện bảng này</dd>
        </dl>
      ) : (
        <dl>
          <dt>W / S</dt>
          <dd>Ga / Lùi</dd>
          <dt>A / D</dt>
          <dd>Đánh lái</dd>
          <dt>Space</dt>
          <dd>Phanh</dd>
          <dt>F</dt>
          <dd>Xuống xe</dd>
          <dt>R</dt>
          <dd>Lật xe lại</dd>
          <dt>H</dt>
          <dd>Ẩn/hiện bảng này</dd>
        </dl>
      )}
    </aside>
  );
}

export function Hud() {
  const x = useGame((s) => s.x);
  const z = useGame((s) => s.z);
  const setEmote = useGame((s) => s.setEmote);
  const ready = useGame((s) => s.ready);
  const mode = useGame((s) => s.mode);
  const carId = useGame((s) => s.carId);
  const nearCarId = useGame((s) => s.nearCarId);
  const nearInteract = useGame((s) => s.nearInteract);
  const dialogue = useGame((s) => s.dialogue);
  const inventoryOpen = useGame((s) => s.inventoryOpen);
  const profile = useGame((s) => s.profile);
  const location = useGame((s) => s.location);
  const setInventoryOpen = useGame((s) => s.setInventoryOpen);
  const shopOpen = useGame((s) => s.shopOpen);
  const speed = useGame((s) => s.speed);
  const kills = useGame((s) => s.kills);
  const pointerLocked = useGame((s) => s.pointerLocked);
  const hunterPanel = useGame((s) => s.panelOpen);
  const [help, setHelp] = useState(true);
  const touch = isTouchDevice();

  // Bảng hướng dẫn tự thu gọn sau một lúc để không che màn hình chơi
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => setHelp(false), 15000);
    return () => clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const emote = EMOTE_KEYS[e.code];
      if (emote) setEmote(emote);
      if (e.code === "KeyH") setHelp((h) => !h);
      if (e.code === "KeyG") {
        const g = useGame.getState();
        if (g.profile && !g.dialogue && !g.shopOpen && !g.inventoryOpen) {
          const h = useHunter.getState();
          if (h.panel === "garage") h.setPanel(null);
          else if (!g.panelOpen) {
            document.exitPointerLock?.();
            h.setPanel("garage");
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setEmote]);

  if (!ready) return <LoadingScreen />;
  const panelOpen = shopOpen || !!dialogue || inventoryOpen || !profile || hunterPanel;

  return (
    <div className="hud">
      <DamageFlash />
      <header className="hud__top">
        <div className="brand">
          <span className="brand__name">CYBERHOOD</span>
          <span className="brand__build">{profile ? `${profile.handle} · ` : ""}build 0.3 · hạ gục {kills}</span>
        </div>
        <Wanted />
        <SafeZoneTag />
        <div className="hud__right">
          <div className="loc">
            <span className="loc__label">DISTRICT</span>
            <span className="loc__value">{location === "vault" ? "Server Vault" : districtAt(x, z)}</span>
            <span className="loc__grid">{location === "vault" ? "B-0" : gridRef(x, z)}</span>
          </div>
          {location === "city" && <Minimap size={touch ? 104 : 148} />}
        </div>
      </header>

      <Crosshair />
      {!touch && !pointerLocked && !panelOpen && pointer.supported && (
        <div className="lock-hint">Nhấp vào màn hình để điều khiển bằng chuột</div>
      )}
      <Vitals />
      {location === "city" && <ContractHud />}
      {!panelOpen && <MechMeter />}
      <DropBanner />

      {mode === "foot" && !panelOpen && (nearCarId !== null || nearInteract) && (
        <div className="prompt">
          {nearInteract ? (
            <>
              <kbd>{touch ? "TALK" : "E"}</kbd> {interactLabel(nearInteract)}
            </>
          ) : (
            <>
              <kbd>{touch ? "ENTER" : "F"}</kbd> Lên xe <strong>{carName(nearCarId)}</strong>
            </>
          )}
        </div>
      )}

      {mode === "drive" && (
        <div className="speedo" aria-label="Tốc độ">
          <span className="speedo__car">{carName(carId)}</span>
          <span className="speedo__value">{speed}</span>
          <span className="speedo__unit">km/h</span>
        </div>
      )}

      {!touch && !panelOpen && (help ? <Help mode={mode} /> : <div className="help-chip"><kbd>H</kbd> Hướng dẫn</div>)}

      {touch && !panelOpen && (
        <>
          <Joystick
            className="touch-stick"
            joystickWrapperStyle={{
              left: "max(12px, env(safe-area-inset-left, 0px))",
              bottom: "max(24px, env(safe-area-inset-bottom, 0px))",
            }}
            joystickBaseStyle={{ border: "2px solid #ff2a6d", background: "rgba(13, 2, 33, 0.45)" }}
            joystickKnobStyle={{ width: "56px", height: "56px", background: "rgba(5, 217, 232, 0.75)" }}
          />
          <div className="touch-buttons">
            {mode === "foot" && nearInteract && (
              <VirtualButton id="talk" label="TALK" buttonWrapperStyle={TOUCH_BUTTON} buttonCapStyle={TOUCH_CAP} />
            )}
            {(mode === "drive" || nearCarId !== null) && (
              <VirtualButton
                id="enter"
                label={mode === "drive" ? "EXIT" : "ENTER"}
                buttonWrapperStyle={TOUCH_BUTTON}
                buttonCapStyle={TOUCH_CAP}
              />
            )}
            {mode === "foot" && (
              <VirtualButton id="run" label="RUN" buttonWrapperStyle={TOUCH_BUTTON} buttonCapStyle={TOUCH_CAP} />
            )}
            <VirtualButton
              id="jump"
              label={mode === "drive" ? "BRAKE" : "JUMP"}
              buttonWrapperStyle={TOUCH_BUTTON}
              buttonCapStyle={TOUCH_CAP}
            />
            {mode === "foot" && (
              <VirtualButton id="fire" label="FIRE" buttonWrapperStyle={FIRE_BUTTON} buttonCapStyle={FIRE_CAP} />
            )}
          </div>
        </>
      )}

      {touch && !panelOpen && (
        <button type="button" className="bag-btn" onClick={() => setInventoryOpen(true)}>
          Túi đồ
        </button>
      )}
      <QuestTracker />
      <Toast />
      <ShopPanel />
      <DialoguePanel />
      <InventoryPanel />
      <HunterPanels />
      <CharacterCreator />
      <Flatline />
    </div>
  );
}
