// Chơi chung: mỗi người chơi phát trạng thái của mình (vị trí, hướng, dáng đi, tên, lớp nhân vật) ~10 lần/giây,
// nhận trạng thái người khác để vẽ họ trong Hub. Hai đường truyền cùng một giao diện:
//  - "host": phòng realtime của host artifact (claude.ai) — ai đang mở game là thấy nhau, không cần server;
//  - "ws":   WebSocket tới game server (Colyseus / Nakama, hoặc server tham chiếu trong /server) khi có VITE_WS_URL.
// Trạng thái người khác là dữ liệu không tin cậy: kiểm tra kiểu, cắt độ dài, kẹp toạ độ.

import { create } from "zustand";
import { PLATFORM } from "./config";
import { useAuth } from "./auth";
import { hostUse, type HostPeer, type HostRoom } from "./host";
import { usePlatform } from "./state";

/** Trạng thái một người chơi gửi đi (giữ gọn: mỗi lần gửi vài chục byte) */
export type NetState = {
  v: 1;
  /** tên hiển thị */
  n: string;
  /** lớp nhân vật (skin) */
  h: string;
  /** màu nhận diện */
  g: string;
  /** khu vực: city / level / siege / raid / vault */
  l: string;
  p: [number, number, number];
  /** hướng (rad) */
  r: number;
  /** dáng: 0 đứng, 1 đi, 2 chạy, 3 nhảy */
  a: number;
  /** foot / car / mech */
  m: string;
};

export type RemotePlayer = NetState & { id: string; at: number };

/** Danh sách id người chơi khác (đổi khi có người vào / ra) — component React đọc cái này */
export const usePeers = create<{ ids: string[] }>(() => ({ ids: [] }));
/** Trạng thái mới nhất của từng người — đọc mỗi frame, không qua React */
export const peerStates = new Map<string, RemotePlayer>();

const HUNTERS = new Set(["soldier", "racer", "engineer", "samurai", "ninja", "hacker"]);
const LOCS = new Set(["city", "vault", "level", "siege", "raid"]);
const MODES = new Set(["foot", "car", "mech"]);
const clampN = (v: unknown, lim: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);

/** Làm sạch trạng thái nhận được */
export function sanitize(raw: unknown): NetState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<NetState>;
  if (s.v !== 1 || !Array.isArray(s.p) || s.p.length !== 3) return null;
  const name = typeof s.n === "string" ? s.n.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, "").slice(0, 16) : "";
  return {
    v: 1,
    n: name || "Hunter",
    h: typeof s.h === "string" && HUNTERS.has(s.h) ? s.h : "racer",
    g: typeof s.g === "string" && /^#[0-9a-f]{6}$/i.test(s.g) ? s.g : "#05d9e8",
    l: typeof s.l === "string" && LOCS.has(s.l) ? s.l : "city",
    p: [clampN(s.p[0], 5000), clampN(s.p[1], 500), clampN(s.p[2], 5000)],
    r: clampN(s.r, 10),
    a: Math.round(clampN(s.a, 3)),
    m: typeof s.m === "string" && MODES.has(s.m) ? s.m : "foot",
  };
}

function setPeers(list: { id: string; state: unknown }[]) {
  const now = performance.now();
  const seen = new Set<string>();
  for (const { id, state } of list) {
    const s = sanitize(state);
    if (!s) continue;
    seen.add(id);
    peerStates.set(id, { ...s, id, at: now });
  }
  for (const id of [...peerStates.keys()]) if (!seen.has(id)) peerStates.delete(id);
  const ids = [...seen].sort();
  const prev = usePeers.getState().ids;
  if (ids.length !== prev.length || ids.some((x, i) => x !== prev[i])) usePeers.setState({ ids });
  usePlatform.setState({ online: ids.length });
}

interface Transport {
  publish(s: NetState): void;
}

function hostTransport(room: HostRoom): Transport {
  const sync = (peers: readonly HostPeer[]) =>
    setPeers(peers.filter((p) => !p.isMe && p.kind === "viewer").map((p) => ({ id: p.peer, state: p.presence.s })));
  room.onPeers((c) => sync(c.peers));
  return {
    publish: (s) => {
      room.presence({ s }).catch(() => {});
    },
  };
}

/** Giao thức WebSocket JSON (xem server/README): client gửi {t:"hello",token,room} rồi {t:"state",s};
 *  server gửi {t:"peers", peers:[{id,s}]} ~10 lần/giây. */
function wsTransport(url: string): Transport {
  let ws: WebSocket | null = null;
  let last: NetState | null = null;
  let retry = 1000;
  const open = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 1000;
      ws!.send(JSON.stringify({ t: "hello", token: useAuth.getState().token, room: "hub" }));
      if (last) ws!.send(JSON.stringify({ t: "state", s: last }));
    };
    ws.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data.length > 256_000) return;
      try {
        const m = JSON.parse(e.data) as { t?: string; peers?: { id?: unknown; s?: unknown }[] };
        if (m.t === "peers" && Array.isArray(m.peers))
          setPeers(m.peers.filter((p) => typeof p.id === "string").map((p) => ({ id: p.id as string, state: p.s })));
      } catch {
        // bỏ tin hỏng
      }
    };
    ws.onclose = () => {
      setPeers([]);
      setTimeout(open, retry);
      retry = Math.min(retry * 2, 30000);
    };
  };
  open();
  return {
    publish: (s) => {
      last = s;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "state", s }));
    },
  };
}

let transport: Transport | null = null;

/** Mở kết nối chơi chung; `read` trả trạng thái hiện tại của người chơi (null = chưa vào game, không phát) */
export async function startNet(read: () => NetState | null) {
  if (transport) return;
  if (PLATFORM.wsUrl) {
    transport = wsTransport(PLATFORM.wsUrl);
    usePlatform.setState({ net: "ws" });
  } else {
    const room = await hostUse<HostRoom>("room");
    if (!room) return;
    transport = hostTransport(room);
    usePlatform.setState({ net: "host" });
  }
  let lastJson = "";
  let lastAt = 0;
  setInterval(() => {
    const s = read();
    if (!s || !transport) return;
    const json = JSON.stringify(s);
    // Đứng yên thì chỉ nhắc lại mỗi 3 giây
    const now = performance.now();
    if (json === lastJson && now - lastAt < 3000) return;
    lastJson = json;
    lastAt = now;
    transport.publish(s);
  }, 100);
}
