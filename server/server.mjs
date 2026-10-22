// Server realtime tham chiếu cho Hub CYBERHOOD — đủ để dev/staging chạy nhiều người chơi thật.
// Giao thức JSON qua WebSocket (game: src/platform/net.ts):
//   client → server  {t:"hello", token, room}   rồi   {t:"state", s:NetState}  (~10 lần/giây)
//   server → client  {t:"peers", peers:[{id, s}]}                              (10 lần/giây, không gồm chính mình)
// Xác thực: VERIFY_URL (Platform API) kiểm tra JWT ngắn hạn; không đặt thì chấp nhận khách (chỉ dùng ở dev).
// Production: Colyseus/Nakama giữ đúng các tin nhắn trên, game không phải sửa.

import { WebSocketServer } from "ws";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const VERIFY_URL = process.env.VERIFY_URL ?? ""; // ví dụ https://api.cyberhood.xyz/v1/auth/verify
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const MAX_PER_ROOM = Number(process.env.MAX_PER_ROOM ?? 100);
const TICK_MS = 100;

/** room -> Map<id, {ws, s, at}> */
const rooms = new Map();

async function verify(token) {
  if (!VERIFY_URL) return { id: null };
  if (typeof token !== "string" || !token) return null;
  try {
    const res = await fetch(VERIFY_URL, { headers: { authorization: `Bearer ${token}` } });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** Kiểm tra gói trạng thái: đúng kiểu, giới hạn kích thước (giống sanitize() phía game) */
export function validState(s) {
  if (!s || typeof s !== "object" || s.v !== 1 || !Array.isArray(s.p) || s.p.length !== 3) return false;
  if (!s.p.every((n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 5000)) return false;
  return typeof s.n === "string" && s.n.length <= 16 && JSON.stringify(s).length < 512;
}

export function createServer(port = PORT) {
  const wss = new WebSocketServer({
    port,
    maxPayload: 4096,
    verifyClient: ({ origin }) => !ORIGINS.length || ORIGINS.includes(origin),
  });
  wss.on("connection", (ws) => {
    const id = randomUUID().slice(0, 12);
    let room = null;
    // Trạng thái tới trước khi xác thực xong (hello là bất đồng bộ): giữ lại, gắn vào khi vào phòng
    let pending = null;
    ws.on("message", async (buf) => {
      let m;
      try {
        m = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (m.t === "hello" && !room) {
        const who = await verify(m.token);
        if (!who) return ws.close(4001, "unauthorized");
        const name = typeof m.room === "string" && /^[a-z0-9-]{1,32}$/.test(m.room) ? m.room : "hub";
        const r = rooms.get(name) ?? new Map();
        if (r.size >= MAX_PER_ROOM) return ws.close(4002, "room full");
        rooms.set(name, r);
        r.set(id, { ws, s: pending, at: Date.now() });
        room = name;
      } else if (m.t === "state" && validState(m.s)) {
        if (!room) {
          pending = m.s;
          return;
        }
        const me = rooms.get(room)?.get(id);
        if (me) {
          me.s = m.s;
          me.at = Date.now();
        }
      }
    });
    ws.on("close", () => {
      const r = room && rooms.get(room);
      if (!r) return;
      r.delete(id);
      if (!r.size) rooms.delete(room);
    });
  });
  // Phát danh sách người chơi cho từng phòng; người im lặng quá 10 giây bị bỏ khỏi danh sách
  const timer = setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      const live = [...r.entries()].filter(([, p]) => p.s && now - p.at < 10000);
      for (const [id, p] of r) {
        if (p.ws.readyState !== 1) continue;
        p.ws.send(JSON.stringify({ t: "peers", peers: live.filter(([pid]) => pid !== id).map(([pid, q]) => ({ id: pid, s: q.s })) }));
      }
    }
  }, TICK_MS);
  wss.on("close", () => clearInterval(timer));
  return wss;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer();
  console.log(`CYBERHOOD realtime ref server on ws://localhost:${PORT}`);
}
