// Giao diện Công thành: sảnh chờ (chọn phe, quy mô, mua Extra Coin), HUD trong trận (giai đoạn, đồng hồ, Vé quân hai
// phe, mục tiêu, bản đồ nhỏ, thông báo), bánh xe lệnh tiểu đội (phím 1–4 / Z), bảng kết quả & thưởng.

import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/store";
import { GEAR, type GearId } from "../level/gear";
import { SIEGE, type Order, type Phase } from "./siegeSim";
import { SIEGE_REWARD, SIEGE_SIZES, useSiege, type SiegeSize } from "./siegeSession";

const PHASES: { id: Phase; label: string }[] = [
  { id: "charge", label: "Xung phong" },
  { id: "shield", label: "Phá khiên" },
  { id: "gate", label: "Phá cổng" },
  { id: "courtyard", label: "Sân trong" },
  { id: "core", label: "Lõi Thành" },
];

const ORDERS: { id: Order; key: string; label: string; hint: string }[] = [
  { id: "follow", key: "1", label: "Theo tôi", hint: "Tiểu đội bám sát bạn" },
  { id: "hold", key: "2", label: "Giữ vị trí", hint: "Đứng chốt tại chỗ bạn đang đứng" },
  { id: "attack", key: "3", label: "Tấn công mục tiêu", hint: "Đánh mục tiêu của giai đoạn" },
  { id: "regroup", key: "4", label: "Thu quân", hint: "Chạy về bên bạn, không giao chiến" },
];

function useTick(fps: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / fps);
    return () => clearInterval(id);
  }, [fps]);
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** Sảnh chờ ở Cổng Công Thành */
export function SiegeLobby() {
  const lobby = useSiege((s) => s.lobby);
  const side = useSiege((s) => s.side);
  const size = useSiege((s) => s.size);
  const coins = useGame((s) => s.inventory.extraCoin ?? 0);
  const cred = useGame((s) => s.cred);
  if (!lobby) return null;
  const S = useSiege.getState();
  const buyCoin = () => {
    const g = useGame.getState();
    if (g.cred < SIEGE_REWARD.extraCoinPrice) return g.showToast("Không đủ CRED");
    g.addCred(-SIEGE_REWARD.extraCoinPrice);
    g.addItem("extraCoin", 1);
  };
  return (
    <div className="sg-lobby" onClick={(e) => e.target === e.currentTarget && S.setLobby(false)}>
      <div className="sg-lobby__box">
        <p className="sg-lobby__tag">CỔNG CÔNG THÀNH · 3D</p>
        <h2>Đại chiến Thành Băng IXO</h2>
        <p className="sg-lobby__lead">
          Hàng trăm quân xung phong qua cánh đồng tuyết. Phá 3 Máy phát để sập khiên năng lượng, húc tung cổng thành, chiếm 2 tháp canh rồi giữ Lõi Thành 60 giây. Phe thủ có Boss Mech và một quả Bom Nova.
        </p>
        <div className="sg-lobby__row">
          <button className={`sg-side sg-side--hunter${side === 0 ? " is-on" : ""}`} onClick={() => S.setSide(0)}>
            <b>PHE HUNTER</b>
            <span>Tấn công · cùng 99 đồng đội (30% tay súng tinh nhuệ)</span>
          </button>
          <button className={`sg-side sg-side--ixo${side === 1 ? " is-on" : ""}`} onClick={() => S.setSide(1)}>
            <b>PHE IXO (phe ác)</b>
            <span>Thủ thành · Boss Mech, pháo tường · thưởng +10% phe yếu</span>
          </button>
        </div>
        <div className="sg-lobby__row">
          {(Object.keys(SIEGE_SIZES) as SiegeSize[]).map((k) => (
            <button key={k} className={`sg-size${size === k ? " is-on" : ""}`} onClick={() => S.setSize(k)}>
              {SIEGE_SIZES[k].label}
            </button>
          ))}
        </div>
        <ul className="sg-lobby__rules">
          <li>Thắng ×1,5 thưởng · thua vẫn nhận 60% · hạng S/A/B/C theo đóng góp</li>
          <li>30–80 Điểm Hunter mỗi trận · Rương Công thành (đồ Sử thi+)</li>
          <li>
            Extra Coin: sống sót qua Bom Nova · đang có <b>{coins}</b>{" "}
            <button className="sg-mini" onClick={buyCoin}>
              Mua ({SIEGE_REWARD.extraCoinPrice} CRED · có {cred})
            </button>
          </li>
          <li>Phím: chuột bắn · T biến hình Mech · 1–4 ra lệnh tiểu đội · Z mở bánh xe lệnh</li>
        </ul>
        <div className="sg-lobby__row">
          <button className="sg-go" onClick={() => S.start()}>
            VÀO TRẬN
          </button>
          <button className="sg-ghost" onClick={() => S.setLobby(false)}>
            Để sau
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bản đồ nhỏ: chấm quân hai phe, máy phát, cổng, tháp, lõi, người chơi */
function MiniMap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      const sim = useSiege.getState().sim;
      if (!c || !sim) return;
      const g = c.getContext("2d")!;
      const W = c.width;
      const H = c.height;
      // Khung bản đồ: x −170…170, z −140…250 (phía trại Hunter ở dưới)
      const px = (x: number) => ((x + 170) / 340) * W;
      const pz = (z: number) => ((z + 140) / 390) * H;
      g.clearRect(0, 0, W, H);
      g.fillStyle = "rgba(220,232,245,0.9)";
      g.fillRect(0, 0, W, H);
      g.fillStyle = "#3a6c96";
      g.fillRect(0, pz(SIEGE.moat.z0), W, pz(SIEGE.moat.z1) - pz(SIEGE.moat.z0));
      g.fillStyle = "#cfe4f5";
      for (const b of SIEGE.moat.bridges) g.fillRect(px(b - 4), pz(SIEGE.moat.z0), px(8) - px(0), pz(SIEGE.moat.z1) - pz(SIEGE.moat.z0));
      if (sim.shieldUp) {
        g.strokeStyle = "rgba(60,200,255,0.8)";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(px(0), pz(0), px(SIEGE.dome.r) - px(0), 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = "#5a6a86";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(px(0), pz(0), px(SIEGE.wall.r) - px(0), Math.PI / 2 + 0.12, Math.PI / 2 - 0.12 + Math.PI * 2);
      g.stroke();
      for (const u of sim.units) {
        if (!u.alive) continue;
        g.fillStyle = u.side === 0 ? (u.squad ? "#00c87a" : "#0aa6c8") : "#d63aa8";
        g.fillRect(px(u.x) - 1, pz(u.z) - 1, 2.2, 2.2);
      }
      for (const o of sim.objectives) {
        if (!o.alive) continue;
        g.fillStyle = o.kind === "gen" ? "#00e6ff" : o.kind === "gate" ? "#ffd23d" : o.kind === "boss" ? "#ff2050" : "#ff7a3a";
        g.beginPath();
        g.arc(px(o.x), pz(o.z), o.kind === "boss" ? 5 : 3.5, 0, Math.PI * 2);
        g.fill();
      }
      SIEGE.towers.forEach((t, i) => {
        g.strokeStyle = sim.towerTaken[i] ? "#00e6ff" : "#ff4fd8";
        g.lineWidth = 2;
        g.strokeRect(px(t.x) - 4, pz(t.z) - 4, 8, 8);
      });
      g.strokeStyle = "#ff2fd0";
      g.beginPath();
      g.arc(px(SIEGE.core.x), pz(SIEGE.core.z), 5, 0, Math.PI * 2);
      g.stroke();
      if (sim.player.alive) {
        g.fillStyle = "#ffffff";
        g.strokeStyle = "#000";
        g.beginPath();
        g.arc(px(sim.player.x), pz(sim.player.z), 4, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="sg-map" width={170} height={195} />;
}

export function SiegeHud() {
  const sim = useSiege((s) => s.sim);
  const result = useSiege((s) => s.result);
  const wheel = useSiege((s) => s.wheel);
  useTick(10);
  // Phím lệnh tiểu đội: 1–4 ra lệnh ngay, giữ Z mở bánh xe lệnh
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useSiege.getState();
      if (!s.sim || e.repeat) return;
      const o = ORDERS.find((o) => e.code === `Digit${o.key}`);
      if (o) giveOrder(o.id);
      if (e.code === "KeyZ") s.setWheel(e.type === "keydown");
      if (e.code === "Escape" && s.sim.phase === "end") s.leave();
    };
    const up = (e: KeyboardEvent) => e.code === "KeyZ" && useSiege.getState().setWheel(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", up);
    };
  }, []);
  if (!sim) return null;
  const att = sim.playerSide === 0;
  const phaseIdx = PHASES.findIndex((p) => p.id === sim.phase);
  const callout = [...sim.events].reverse().find((e) => e.kind === "callout");
  const showCall = callout && callout.kind === "callout" && sim.time - callout.at < 4;
  const goal = sim.currentGoal();
  const gens = sim.objectives.filter((o) => o.kind === "gen");
  const gate = sim.obj("gate", 0)!;
  const boss = sim.boss;
  const T0 = sim.perSide * SIEGE.ticketsPerUnit;
  const dead = !sim.player.alive;
  const nextWave = SIEGE.respawnWave - (sim.time % SIEGE.respawnWave);
  return (
    <div className="sg-hud">
      <div className="sg-top">
        <div className="sg-team sg-team--hunter">
          <b>HUNTER</b>
          <i style={{ width: `${(sim.tickets[0] / T0) * 100}%` }} />
          <span>
            {sim.tickets[0]} vé · {sim.alive(0) + (att && sim.player.alive ? 1 : 0)} quân
          </span>
        </div>
        <div className="sg-clock">
          <b>{mmss(sim.timeLeft)}</b>
          <small>{att ? "TẤN CÔNG" : "THỦ THÀNH"}</small>
        </div>
        <div className="sg-team sg-team--ixo">
          <b>IXO</b>
          <i style={{ width: `${(sim.tickets[1] / T0) * 100}%` }} />
          <span>
            {sim.tickets[1]} vé · {sim.alive(1) + (!att && sim.player.alive ? 1 : 0)} quân
          </span>
        </div>
      </div>
      <ol className="sg-phases">
        {PHASES.map((p, i) => (
          <li key={p.id} className={i < phaseIdx || sim.phase === "end" ? "is-done" : i === phaseIdx ? "is-now" : ""}>
            {p.label}
          </li>
        ))}
      </ol>
      <div className="sg-obj">
        <p className="sg-obj__goal">▸ {goal.label}</p>
        <div className="sg-obj__row">
          {gens.map((g) => (
            <span key={g.i} className={`sg-pill${g.alive ? "" : " is-off"}`}>
              Máy phát {["Trái", "Giữa", "Phải"][g.i]} <em style={{ width: `${(g.hp / g.maxHp) * 100}%` }} />
            </span>
          ))}
        </div>
        <div className="sg-obj__row">
          <span className={`sg-pill sg-pill--gate${gate.alive ? "" : " is-off"}`}>
            Cổng thành {sim.shieldUp ? "(khiên che)" : ""} <em style={{ width: `${(gate.hp / gate.maxHp) * 100}%` }} />
          </span>
          {SIEGE.towers.map((_, i) => (
            <span key={i} className={`sg-pill${sim.towerTaken[i] ? " is-off" : ""}`}>
              Tháp {i ? "Phải" : "Trái"} <em style={{ width: `${sim.towerProgress[i] * 100}%` }} />
            </span>
          ))}
        </div>
        {sim.phase === "core" && (
          <div className="sg-core">
            LÕI THÀNH {Math.floor(sim.coreHold)}/{SIEGE.core.hold}s
            <em style={{ width: `${(sim.coreHold / SIEGE.core.hold) * 100}%` }} />
          </div>
        )}
        {boss && boss.alive && (
          <div className="sg-boss">
            BOSS MECH IXO <em style={{ width: `${(boss.hp / boss.maxHp) * 100}%` }} />
          </div>
        )}
      </div>
      <MiniMap />
      <div className="sg-squad">
        Tiểu đội: <b>{ORDERS.find((o) => o.id === sim.order)?.label}</b> <small>1–4 · Z</small>
        {sim.player.extraCoin && <span className="sg-coin">● Extra Coin</span>}
      </div>
      {showCall && callout.kind === "callout" && (
        <div className="sg-callout" key={callout.at} style={{ color: callout.color, textShadow: `0 0 18px ${callout.color}` }}>
          {callout.text}
        </div>
      )}
      {dead && sim.phase !== "end" && (
        <div className="sg-dead">
          <b>BẠN ĐÃ GỤC</b>
          <span>Hồi sinh theo đợt sau {Math.ceil(nextWave)}s · Vé quân phe bạn: {sim.tickets[sim.playerSide]}</span>
        </div>
      )}
      {wheel && (
        <div className="sg-wheel">
          {ORDERS.map((o) => (
            <button key={o.id} className={sim.order === o.id ? "is-on" : ""} onMouseEnter={() => giveOrder(o.id)} onClick={() => giveOrder(o.id)}>
              <kbd>{o.key}</kbd>
              <b>{o.label}</b>
              <small>{o.hint}</small>
            </button>
          ))}
        </div>
      )}
      {sim.phase === "end" && <Result />}
      <p className="sg-keys">
        Chuột bắn · <kbd>T</kbd> biến hình Mech (húc cổng ×) · <kbd>1</kbd>–<kbd>4</kbd> lệnh tiểu đội · <kbd>Z</kbd> bánh xe lệnh · <kbd>I</kbd> tủ đồ
        {result ? "" : ""}
      </p>
    </div>
  );
}

function giveOrder(o: Order) {
  const sim = useSiege.getState().sim;
  if (!sim) return;
  sim.order = o;
  if (o === "hold") sim.holdAt = { x: sim.player.x, z: sim.player.z };
  useGame.getState().showToast(`Lệnh tiểu đội: ${ORDERS.find((x) => x.id === o)?.label}`);
}

function Result() {
  const r = useSiege((s) => s.result);
  const sim = useSiege((s) => s.sim)!;
  if (!r) return null;
  return (
    <div className="sg-result">
      <p className="sg-result__tag">{r.won ? "CHIẾN THẮNG" : "THẤT BẠI"}</p>
      <h2>{sim.winner === 0 ? "Phe Hunter chiếm Thành Băng" : "Thành Băng IXO đứng vững"}</h2>
      <div className="sg-rank">
        Hạng <b className={`r-${r.rank}`}>{r.rank}</b> · {r.pts} điểm đóng góp · hạ {r.kills}
      </div>
      <ul>
        <li>+{r.cred} CRED {r.won ? "(×1,5 phe thắng)" : "(60% phe thua)"}</li>
        <li>+{r.points} Điểm Hunter</li>
        {r.gear && <li>Rương Công thành: {GEAR[r.gear as GearId]?.name ?? r.gear}</li>}
      </ul>
      <button className="sg-go" onClick={() => useSiege.getState().leave()}>
        Về khu an toàn <kbd>Esc</kbd>
      </button>
    </div>
  );
}
