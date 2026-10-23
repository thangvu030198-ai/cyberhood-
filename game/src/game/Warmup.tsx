// Chống khựng:
// 1) Biên dịch shader của cả cảnh ngay khi sảnh vừa tải xong (thay vì lần đầu nhìn thấy vật thể / bắn hiệu ứng).
// 2) Khi người chơi đã đứng ở sảnh một lúc, tải ngầm (độ ưu tiên thấp, lần lượt từng file) model của các chế độ chơi
//    vào cache trình duyệt, để vào Công thành / Raid / Kart / Võ đài gần như không phải chờ.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { extraModelUrl } from "./assets";
import { PRELOAD } from "./preloadList";
import { useGame } from "./store";

type Conn = { saveData?: boolean; effectiveType?: string };

/** Biên dịch shader của toàn cảnh một lần (gắn cuối cùng trong Suspense chính) */
export function ShaderWarmup() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const r = gl as unknown as { compileAsync?: (s: unknown, c: unknown) => Promise<unknown>; compile: (s: unknown, c: unknown) => void };
    // compileAsync không chặn luồng chính khi trình duyệt hỗ trợ biên dịch song song
    if (r.compileAsync) r.compileAsync(scene, camera).catch(() => {});
    else r.compile(scene, camera);
  }, [gl, scene, camera]);
  return null;
}

let started = false;
/** Tải ngầm model các chế độ chơi sau khi vào sảnh */
export function prefetchModes() {
  if (started || typeof window === "undefined") return;
  const conn = (navigator as unknown as { connection?: Conn }).connection;
  if (conn?.saveData || /(^|-)2g|3g/.test(conn?.effectiveType ?? "")) return;
  started = true;
  // Chế độ người chơi hay vào trước: Công thành, Raid, Kart, Võ đài
  const queue = [...new Set([...PRELOAD.siege, ...PRELOAD.raid, ...PRELOAD.kart, ...PRELOAD.duel])];
  const next = () => {
    // Đang ở trong một chế độ chơi thì nhường băng thông cho nó
    if (useGame.getState().location !== "city") return void setTimeout(next, 5000);
    const name = queue.shift();
    if (!name) return;
    fetch(extraModelUrl(name), { priority: "low" } as RequestInit)
      .then((r) => r.arrayBuffer())
      .catch(() => {})
      .finally(() => setTimeout(next, 150));
  };
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: unknown) => void }).requestIdleCallback;
  // Đợi sảnh chạy ổn định vài giây rồi mới bắt đầu
  setTimeout(() => (idle ? idle(next, { timeout: 4000 }) : next()), 8000);
}

/** Gắn trong sảnh: bắt đầu tải ngầm khi sảnh đã sẵn sàng */
export function ModePrefetch() {
  const ready = useGame((s) => s.ready);
  useEffect(() => {
    if (ready) prefetchModes();
  }, [ready]);
  return null;
}
