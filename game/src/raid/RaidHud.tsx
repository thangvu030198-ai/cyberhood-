// Giao diện Cổng Sinh Vật Cổ Đại: sảnh (chọn sinh vật, độ khó, vai trò; Bảng Tuyển quân, Tìm đội, Thuê NPC Thợ Săn
// Quái, Lò rèn Thần binh; danh sách đội), HUD trong trận (thanh máu sinh vật + giai đoạn + giờ cuồng nộ, thanh choáng,
// bộ phận, cột thu lôi, khung đồng đội, kỹ năng, đồng bộ Mech, cảnh báo lên mái), bảng kết quả + chấm Uy tín.

import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/store";
import { GEAR } from "../level/gear";
import { CREATURES, RAID, ROLES, creatureHp, teamCheck, type CreatureId, type Difficulty, type Role, type Skill } from "./raidSim";
import { DIVINE, HIRE_COST, MATERIALS, useRaid, weekId, type RaidTab } from "./raidSession";
import { tr } from "../i18n/i18n";
import { MAT_ICON } from "./matIcons";

function useTick(fps: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), 1000 / fps);
    return () => clearInterval(id);
  }, [fps]);
}
const mmss = (t: number) => `${Math.floor(Math.max(0, t) / 60)}:${String(Math.floor(Math.max(0, t) % 60)).padStart(2, "0")}`;
const ROLE_IDS: Role[] = ["tank", "dps", "healer", "support"];
const DIFFS: Difficulty[] = ["normal", "nightmare", "legend"];

export function RaidLobby() {
  const S = useRaid();
  const seals = useGame((s) => s.inventory.summonSeal ?? 0);
  useTick(4);
  useEffect(() => {
    if (!S.recruiting) return;
    const id = setInterval(() => useRaid.getState().tickRecruit(), 700);
    return () => clearInterval(id);
  }, [S.recruiting]);
  if (!S.lobby) return null;
  const D = RAID.difficulty[S.diff];
  const err = S.canStart();
  const humans = S.team.filter((x) => x.kind !== "elite").length;
  const npcs = S.team.length - humans;
  const my = S.myPower();
  const wk = S.weekly[S.creature] === weekId();
  const tabs: { id: RaidTab; label: string }[] = [
    { id: "recruit", label: "Tuyển quân" },
    { id: "find", label: "Tìm đội" },
    { id: "hire", label: "Thuê NPC Thợ Săn Quái" },
    { id: "forge", label: "Lò rèn Thần binh" },
  ];
  return (
    <div className="rd-lobby" onClick={(e) => e.target === e.currentTarget && S.setLobby(false)}>
      <div className="rd-lobby__box">
        <p className="rd-tag">CỔNG SINH VẬT CỔ ĐẠI · RAID 4–10 NGƯỜI</p>
        <h2>Sinh vật cổ đại ngủ dưới Neon City</h2>
        <div className="rd-creatures">
          {(Object.keys(CREATURES) as CreatureId[]).map((id) => {
            const c = CREATURES[id];
            return (
              <button key={id} className={`rd-creature${S.creature === id ? " is-on" : ""}${c.open ? "" : " is-locked"}`} style={{ borderColor: c.color }} disabled={!c.open} onClick={() => S.set({ creature: id })}>
                <b style={{ color: c.color }}>{c.name}</b>
                <small>{c.zone}</small>
                <span>{c.shape}</span>
                <em>{c.open ? c.mechanic : `🔒 ${c.season}`}</em>
              </button>
            );
          })}
        </div>
        <div className="rd-row">
          <span className="rd-label">Độ khó</span>
          {DIFFS.map((d) => (
            <button key={d} className={`rd-chip${S.diff === d ? " is-on" : ""}`} onClick={() => S.set({ diff: d })}>
              {RAID.difficulty[d].label}
              <small>
                ≥{RAID.difficulty[d].minHumans} người thật · ≤{RAID.difficulty[d].maxNpc} NPC
              </small>
            </button>
          ))}
        </div>
        <div className="rd-row">
          <span className="rd-label">Vai trò của bạn</span>
          {ROLE_IDS.map((r) => (
            <button key={r} className={`rd-chip${S.role === r ? " is-on" : ""}`} style={S.role === r ? { borderColor: ROLES[r].color, color: ROLES[r].color } : undefined} onClick={() => S.set({ role: r, team: S.team.map((x, i) => (i === 0 ? { ...x, role: r } : x)) })}>
              {ROLES[r].icon} {ROLES[r].label}
              <small>{ROLES[r].hint}</small>
            </button>
          ))}
        </div>
        <div className="rd-stats">
          <span>
            Ấn Triệu Hồi: <b>{seals}</b>
          </span>
          <span>
            Sức mạnh: <b>{my}</b>
          </span>
          <span>
            Uy tín: <b>{S.rep}</b>
          </span>
          <span>
            Rương tuần: <b>{wk ? "đã nhận" : "còn"}</b>
          </span>
          <span>
            Máu sinh vật: <b>{creatureHp(Math.max(4, S.team.length), S.diff).toLocaleString()}</b>
          </span>
          {S.title && (
            <span className="rd-title">
              Danh hiệu: <b>{S.title}</b>
            </span>
          )}
        </div>
        <div className="rd-tabs">
          {tabs.map((t) => (
            <button key={t.id} className={S.tab === t.id ? "is-on" : ""} onClick={() => S.set({ tab: t.id })}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="rd-cols">
          <div className="rd-pane">
            {S.tab === "recruit" && (
              <>
                <p className="rd-note">Bạn là trưởng nhóm: chọn số chỗ cho từng vai trò và sức mạnh tối thiểu rồi đăng lên Bảng Tuyển quân. Trưởng nhóm dùng 1 Ấn Triệu Hồi, được +5% nguyên liệu khi hạ thành công.</p>
                {ROLE_IDS.map((r) => (
                  <div key={r} className="rd-slot">
                    <span style={{ color: ROLES[r].color }}>
                      {ROLES[r].icon} {ROLES[r].label}
                    </span>
                    <button onClick={() => S.set({ want: { ...S.want, [r]: Math.max(0, S.want[r] - 1) } })}>−</button>
                    <b>{S.want[r]}</b>
                    <button onClick={() => S.set({ want: { ...S.want, [r]: Math.min(5, S.want[r] + 1) } })}>+</button>
                  </div>
                ))}
                <div className="rd-slot">
                  <span>Sức mạnh tối thiểu</span>
                  <button onClick={() => S.set({ minPower: Math.max(0, S.minPower - 100) })}>−</button>
                  <b>{S.minPower}</b>
                  <button onClick={() => S.set({ minPower: S.minPower + 100 })}>+</button>
                </div>
                <button className="rd-go rd-go--sm" disabled={S.recruiting} onClick={() => S.startRecruit()}>
                  {S.recruiting ? "Đang tuyển… người chơi đang xin vào" : "Đăng tuyển"}
                </button>
              </>
            )}
            {S.tab === "find" && (
              <>
                <p className="rd-note">Tìm đội: hệ thống ghép bạn vào một phòng đang tuyển theo vai trò bạn chọn và độ khó. Bạn vào miễn phí (không cần Ấn), nhưng không phải trưởng nhóm.</p>
                <button className="rd-go rd-go--sm" onClick={() => S.findTeam()}>
                  Tìm đội ngay
                </button>
              </>
            )}
            {S.tab === "hire" && (
              <>
                <p className="rd-note">NPC Thợ Săn Quái: sức mạnh 70–85% người chơi (lính đánh thuê thường chỉ 55–65%), biết né đòn báo trước, tự đứng / phá cột, tự dồn sát thương khi sinh vật ngã. Người thật vào sau có thể thay chỗ NPC.</p>
                <p className="rd-note">
                  Phí: {HIRE_COST[S.diff].cred} CRED mỗi NPC{HIRE_COST[S.diff].token ? " (bản mạng: Coin + token)" : ""} · {D.label} tối đa {D.maxNpc} NPC
                </p>
                <div className="rd-hire">
                  {ROLE_IDS.map((r) => (
                    <button
                      key={r}
                      style={{ borderColor: ROLES[r].color }}
                      onClick={() => {
                        const e = S.hire(r);
                        if (e) useGame.getState().showToast(e);
                      }}
                    >
                      {ROLES[r].icon} Thuê {ROLES[r].label}
                    </button>
                  ))}
                </div>
              </>
            )}
            {S.tab === "forge" && (
              <>
                <p className="rd-note">Nguyên liệu cổ đại chế bộ Thần binh – trang bị mạnh nhất game, hàng VIP trên chợ NFT.</p>
                <div className="rd-mats">
                  {(Object.keys(MATERIALS) as (keyof typeof MATERIALS)[]).map((k) => (
                    <span key={k} className="rd-mat" style={{ color: MATERIALS[k].color }}>
                      <img src={MAT_ICON[k]} alt="" />
                      {MATERIALS[k].name}: <b>{S.materials[k]}</b>
                    </span>
                  ))}
                </div>
                {DIVINE.map((d) => (
                  <div key={d.id} className="rd-recipe">
                    <div>
                      <b>{GEAR[d.id].name}</b>
                      <small>{GEAR[d.id].blurb}</small>
                      <small>
                        {Object.entries(d.cost)
                          .map(([k, v]) => `${v} ${tr(MATERIALS[k as keyof typeof MATERIALS].name)}`)
                          .join(" · ")}{" "}
                        · {d.cred} CRED
                      </small>
                    </div>
                    <button
                      onClick={() => {
                        const e = S.craft(d.id);
                        useGame.getState().showToast(e ?? `Chế tạo thành công: ${GEAR[d.id].name}`);
                      }}
                    >
                      Chế tạo
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className="rd-pane rd-team">
            <p className="rd-label">
              Đội ({S.team.length}/{RAID.maxTeam}) · Người thật {humans} · NPC {npcs}
            </p>
            <ul>
              {S.team.map((m, i) => (
                <li key={m.name + i}>
                  <span style={{ color: ROLES[i === 0 ? S.role : m.role].color }}>{ROLES[i === 0 ? S.role : m.role].icon}</span>
                  <b>{m.name}</b>
                  <small className={m.kind === "elite" ? "is-npc" : "is-human"}>{m.kind === "player" ? (S.leader ? "Trưởng nhóm" : "Bạn") : m.kind === "human" ? "Người thật" : "NPC tinh anh"}</small>
                  <small>{Math.round(m.power * my)}</small>
                  {i > 0 && S.leader && (
                    <button className="rd-x" onClick={() => S.kick(i)}>
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className={`rd-check${err ? " is-bad" : ""}`}>{err ?? teamCheck(S.team, S.diff) ?? "Đội hợp lệ · sẵn sàng"}</p>
            <button
              className="rd-go"
              disabled={!!err}
              onClick={() => {
                const e = S.start();
                if (e) useGame.getState().showToast(e);
              }}
            >
              VÀO TRẬN {S.leader ? "· dùng 1 Ấn" : ""}
            </button>
            <button className="rd-ghost" onClick={() => S.setLobby(false)}>
              Rời sảnh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD trong trận

const SKILLS: Skill[] = ["grenade", "missiles", "orbital", "role"];
const SKILL_ICON: Record<Skill, string> = { grenade: "✹", missiles: "➶", orbital: "◎", role: "★" };
const PHASE_LABEL = { awaken: "Thức tỉnh", frenzy: "Cuồng hoả", despair: "Tuyệt vọng", end: "Kết thúc" } as const;

export function RaidHud() {
  const sim = useRaid((s) => s.sim);
  const [confirm, setConfirm] = useState(false);
  useTick(10);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useRaid.getState();
      if (!s.sim || e.code !== "Escape") return;
      if (s.sim.phase === "end") s.leave();
      else setConfirm((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!sim) return null;
  const P = sim.player;
  const f = sim.hp / sim.maxHp;
  const pend = sim.warns.find((w) => !w.done && (w.kind === "discharge" || w.kind === "tsunami"));
  const inDanger = pend && sim.inWarn(pend, P.x, P.z, P);
  const call = [...sim.events].reverse().find((e) => e.kind === "callout");
  const showCall = call && call.kind === "callout" && sim.time - call.at < 3.5;
  const mechs = sim.members.filter((m) => m.alive && m.inMech).length;
  const roleSkill = RAID.roleSkill[P.role].label;
  return (
    <div className="rd-hud">
      <div className="rd-boss">
        <div className="rd-boss__name">
          <b>LEVIATHAN ĐIỆN</b>
          <span>
            {PHASE_LABEL[sim.phase]} · {RAID.difficulty[sim.diff].label}
          </span>
          <span className={sim.enraged ? "is-bad" : ""}>Cuồng nộ sau {mmss(sim.enrageAt - sim.time)}</span>
        </div>
        <div className="rd-bar">
          <i style={{ width: `${f * 100}%` }} />
          <em style={{ left: "70%" }} />
          <em style={{ left: "30%" }} />
          <span>
            {Math.ceil(sim.hp).toLocaleString()} / {sim.maxHp.toLocaleString()}
          </span>
        </div>
        <div className="rd-stagger">
          <i style={{ width: `${sim.stagger * 100}%` }} />
          <span>{sim.exposed() ? "NGÃ QUỴ · LỘ LÕI TIM ×2,5" : "CHOÁNG"}</span>
        </div>
        <div className="rd-parts">
          {sim.parts.map((p) => (
            <span key={p.id} className={p.broken ? "is-off" : ""}>
              {RAID.parts[p.id].label} <small>{p.broken ? "VỠ" : `${Math.ceil((p.hp / p.maxHp) * 100)}%`}</small>
            </span>
          ))}
          <span className="rd-rods">
            Cột thu lôi:{" "}
            {sim.rods.map((r) => (
              <i key={r.i} className={r.alive ? "" : "is-off"}>
                ⚡
              </i>
            ))}
          </span>
        </div>
      </div>
      <div className="rd-frames">
        {sim.members.map((m) => (
          <div key={m.id} className={`rd-frame${m.alive ? "" : " is-dead"}${m.kind === "player" ? " is-me" : ""}`}>
            <span style={{ color: ROLES[m.role].color }}>{ROLES[m.role].icon}</span>
            <b>{m.name}</b>
            <small>{m.kind === "elite" ? "NPC" : m.kind === "human" ? "P" : ""}</small>
            {m.inMech && <small className="rd-mech">MECH</small>}
            <div className="rd-hp">
              <i style={{ width: `${(m.hp / m.maxHp) * 100}%`, background: ROLES[m.role].color }} />
            </div>
          </div>
        ))}
      </div>
      <RaidMap />
      <div className="rd-sync">
        Đồng bộ Mech: <b>{mechs}</b>/{RAID.mechSync} · <kbd>T</kbd>
      </div>
      {inDanger && <div className="rd-danger">{pend!.kind === "tsunami" ? "LÊN MÁI CÓ CỘT THU LÔI!" : "LÊN MÁI NHÀ – NƯỚC SẮP PHÓNG ĐIỆN!"}</div>}
      {showCall && call.kind === "callout" && (
        <div className="rd-callout" key={call.at} style={{ color: call.color, textShadow: `0 0 18px ${call.color}` }}>
          {call.text}
        </div>
      )}
      {!P.alive && sim.phase !== "end" && (
        <div className="rd-dead">
          <b>BẠN ĐÃ GỤC</b>
          <span>Chờ Kỹ sư y tế hồi sinh hoặc về bãi tập kết sau {Math.max(0, Math.ceil(RAID.player.respawn - (sim.time - P.downAt)))}s</span>
        </div>
      )}
      <div className="rd-skills">
        {SKILLS.map((k) => {
          const K = RAID.skills[k];
          const left = Math.max(0, sim.cds[k] - sim.time);
          return (
            <div key={k} className={`sg-skill${left > 0 ? " is-cd" : ""}`}>
              <i>{SKILL_ICON[k]}</i>
              <kbd>{K.key}</kbd>
              {left > 0 && (
                <>
                  <span className="sg-skill__mask" style={{ height: `${(left / K.cd) * 100}%` }} />
                  <b>{Math.ceil(left)}</b>
                </>
              )}
              <small>{k === "role" ? roleSkill : K.label}</small>
            </div>
          );
        })}
      </div>
      <p className="sg-keys">
        Chuột bắn · <kbd>Q</kbd>
        <kbd>E</kbd>
        <kbd>R</kbd>
        <kbd>F</kbd> kỹ năng · <kbd>T</kbd> Mech (3 người cùng biến → ngã quỵ) · mái nhà tránh phóng điện · <kbd>Esc</kbd> rời trận
      </p>
      {confirm && sim.phase !== "end" && (
        <div className="rd-confirm">
          <p>Rời trận giữa chừng sẽ khoá Cổng Sinh Vật 30 phút và trừ Uy tín.</p>
          <button className="rd-go rd-go--sm" onClick={() => setConfirm(false)}>
            Ở lại chiến đấu
          </button>
          <button
            className="rd-ghost"
            onClick={() => {
              setConfirm(false);
              useRaid.getState().leave(true);
            }}
          >
            Bỏ trận
          </button>
        </div>
      )}
      {sim.phase === "end" && <Result />}
    </div>
  );
}


/** Bản đồ nhỏ đấu trường: mái nhà, cao ốc, cột thu lôi, thân Leviathan, lươn máy, đồng đội, vùng nguy hiểm */
function RaidMap() {
  const sim = useRaid((s) => s.sim);
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let id = 0;
    const draw = () => {
      id = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c || !sim) return;
      const g = c.getContext("2d")!;
      const W = c.width;
      const k = W / (RAID.arena.half * 2 + 8);
      const X = (x: number) => W / 2 + x * k;
      const Z = (z: number) => W / 2 + z * k;
      g.clearRect(0, 0, W, W);
      g.fillStyle = "rgba(4,14,24,0.85)";
      g.fillRect(0, 0, W, W);
      g.strokeStyle = "#36e7ff55";
      g.strokeRect(1, 1, W - 2, W - 2);
      for (const r of RAID.roofs) {
        g.fillStyle = r.rod ? "#1f4f60" : "#2a3442";
        g.fillRect(X(r.x - r.half), Z(r.z - r.half), r.half * 2 * k, r.half * 2 * k);
      }
      g.fillStyle = "#56607a";
      for (const T of RAID.towers) {
        g.beginPath();
        g.arc(X(T.x), Z(T.z), T.r * k, 0, Math.PI * 2);
        g.fill();
      }
      for (const w of sim.warns) {
        if (w.done || w.byPlayer || w.kind === "discharge" || w.kind === "tsunami") continue;
        g.strokeStyle = "#ff3d5a";
        g.beginPath();
        if (w.kind === "breath" || w.kind === "bite") {
          g.lineWidth = Math.max(2, w.kind === "breath" ? w.r * 2 * k : 3);
          g.moveTo(X(w.x0), Z(w.z0));
          g.lineTo(X(w.x1), Z(w.z1));
        } else {
          g.lineWidth = 1.5;
          g.arc(X(w.x0), Z(w.z0), w.r * k, 0, Math.PI * 2);
        }
        g.stroke();
      }
      for (const r of sim.rods) {
        g.fillStyle = r.alive ? "#36e7ff" : "#333a44";
        g.fillRect(X(r.x) - 3, Z(r.z) - 3, 6, 6);
      }
      // Thân rắn
      g.strokeStyle = sim.exposed() ? "#ffd166" : "#2fd8f0";
      g.lineWidth = 4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(X(sim.head.x), Z(sim.head.z));
      for (const b of sim.body) g.lineTo(X(b.x), Z(b.z));
      g.stroke();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(X(sim.head.x), Z(sim.head.z), 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#ff4fd8";
      for (const e of sim.eels) if (e.alive) g.fillRect(X(e.x) - 2, Z(e.z) - 2, 4, 4);
      for (const m of sim.members) {
        if (m.kind === "player") continue;
        g.fillStyle = m.alive ? ROLES[m.role].color : "#555";
        g.beginPath();
        g.arc(X(m.x), Z(m.z), 3, 0, Math.PI * 2);
        g.fill();
      }
      const P = sim.player;
      g.save();
      g.translate(X(P.x), Z(P.z));
      g.rotate(-P.yaw + Math.PI);
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.moveTo(0, -6);
      g.lineTo(4, 5);
      g.lineTo(-4, 5);
      g.closePath();
      g.fill();
      g.restore();
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, [sim]);
  return <canvas ref={ref} className="rd-map" width={180} height={180} />;
}

function Result() {
  const r = useRaid((s) => s.result);
  const rated = useRaid((s) => s.rated);
  const rate = useRaid((s) => s.rate);
  if (!r) return null;
  return (
    <div className="sg-result rd-result">
      <p className="sg-result__tag">{r.won ? "HẠ GỤC SINH VẬT" : "THẤT BẠI"}</p>
      <h2>{r.won ? "Leviathan Điện chìm xuống đáy Neon City" : "Leviathan vẫn cuộn mình quanh các cao ốc"}</h2>
      <div className="sg-rank">
        Hạng <b className={`r-${r.rank}`}>{r.rank}</b> · {Math.round(r.share * 100)}% sát thương · {mmss(r.time)}
      </div>
      <ul>
        <li>+{r.cred} CRED</li>
        <li>+{r.points} Điểm Hunter</li>
        {Object.entries(r.mats).map(([k, v]) => (
          <li key={k} className="rd-mat" style={{ color: MATERIALS[k as keyof typeof MATERIALS].color }}>
            <img src={MAT_ICON[k]} alt="" />+{v} {MATERIALS[k as keyof typeof MATERIALS].name}
          </li>
        ))}
        {r.chestNote && <li>{r.chestNote}</li>}
        {r.leader && r.won && <li>Thưởng trưởng nhóm: +5% nguyên liệu</li>}
        {r.firstKill && <li className="rd-gold">HẠ ĐẦU TIÊN · Cúp NFT độc nhất + danh hiệu "Kẻ Diệt Leviathan" + tượng ở khu an toàn</li>}
        {r.pet && <li className="rd-gold">Cực hiếm: thú cưng Leviathan con đi theo bạn ở khu an toàn!</li>}
      </ul>
      {r.mates.length > 0 && (
        <div className="rd-rate">
          <p>Chấm Uy tín đồng đội</p>
          {r.mates.map((m) => (
            <div key={m.name}>
              <span>
                {ROLES[m.role].icon} {m.name}
              </span>
              <button className={rated[m.name] === 1 ? "is-on" : ""} disabled={!!rated[m.name]} onClick={() => rate(m.name, 1)}>
                👍
              </button>
              <button className={rated[m.name] === -1 ? "is-on" : ""} disabled={!!rated[m.name]} onClick={() => rate(m.name, -1)}>
                👎
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="sg-go" onClick={() => useRaid.getState().leave()}>
        Về khu an toàn <kbd>Esc</kbd>
      </button>
    </div>
  );
}
