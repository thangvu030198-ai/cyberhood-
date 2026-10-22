// Nối lớp nền tảng với trạng thái game (nạp sau game): đọc vị trí người chơi để phát cho người khác, bật lưu tự động.

import { useGame } from "../game/store";
import { handles } from "../game/refs";
import { startAutoSave } from "./save";
import { startNet, type NetState } from "./net";
import { sendToWeb } from "./bridge";
import { PROTOCOL_VERSION } from "./protocol";

let yaw = 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

function read(): NetState | null {
  const g = useGame.getState();
  const p = handles.player;
  if (!g.profile || !g.ready || !p) return null;
  const pos = p.currPos;
  const v = p.currLinVel;
  const sp = Math.hypot(v.x, v.z);
  if (sp > 0.4) yaw = Math.atan2(v.x, v.z);
  return {
    v: 1,
    n: g.profile.handle,
    h: g.profile.hunter ?? "racer",
    g: g.profile.glow,
    l: g.location,
    p: [r2(pos.x), r2(pos.y), r2(pos.z)],
    r: r2(yaw),
    a: !p.isOnGround ? 3 : sp < 0.4 ? 0 : sp < 4.5 ? 1 : 2,
    m: g.mode === "drive" ? "car" : handles.mechBlend > 0.5 ? "mech" : "foot",
  };
}

export function linkGame() {
  startAutoSave();
  void startNet(read);
  // Báo website tên + lớp nhân vật khi người chơi tạo xong hồ sơ
  let sent = "";
  useGame.subscribe((s) => {
    const key = s.profile ? `${s.profile.handle}|${s.profile.hunter}` : "";
    if (key && key !== sent) {
      sent = key;
      sendToWeb({ v: PROTOCOL_VERSION, type: "PROFILE", payload: { name: s.profile!.handle, hunter: s.profile!.hunter ?? "racer" } });
    }
  });
}
