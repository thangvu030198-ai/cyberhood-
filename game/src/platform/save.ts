// Lưu hồ sơ người chơi lên server. Mọi tiến trình game vẫn ghi vào localStorage như cũ (khoá "cyberhood.*");
// lớp này chụp lại các khoá đó, đẩy lên server định kỳ và kéo về khi mở game trên máy khác.
// Thứ tự ưu tiên: Platform API (có token) → db của host artifact → chỉ lưu cục bộ.

import { PLATFORM } from "./config";
import { api } from "./auth";
import { hostUse, type HostDb, type HostUser } from "./host";
import { usePlatform } from "./state";

const PREFIX = "cyberhood.";
/** Không đồng bộ: ngôn ngữ là theo từng máy, META là dấu thời gian đồng bộ */
const LOCAL_ONLY = new Set(["cyberhood.lang.v1", "cyberhood.sync.v1"]);
const META = "cyberhood.sync.v1";

export type SaveBlob = { savedAt: number; data: Record<string, string> };

interface SaveBackend {
  kind: "api" | "host";
  load(): Promise<SaveBlob | null>;
  store(blob: SaveBlob): Promise<void>;
}

function snapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.startsWith(PREFIX) && !LOCAL_ONLY.has(k)) out[k] = localStorage.getItem(k) ?? "";
  }
  return out;
}

function localSavedAt() {
  try {
    return (JSON.parse(localStorage.getItem(META) ?? "{}") as { savedAt?: number }).savedAt ?? 0;
  } catch {
    return 0;
  }
}

function apply(blob: SaveBlob) {
  for (const k of Object.keys(snapshot())) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(blob.data)) if (k.startsWith(PREFIX) && !LOCAL_ONLY.has(k)) localStorage.setItem(k, v);
  localStorage.setItem(META, JSON.stringify({ savedAt: blob.savedAt }));
}

const valid = (b: unknown): b is SaveBlob =>
  !!b && typeof (b as SaveBlob).savedAt === "number" && typeof (b as SaveBlob).data === "object" && (b as SaveBlob).data !== null;

function apiBackend(): SaveBackend {
  return {
    kind: "api",
    load: async () => {
      const b = await api<SaveBlob>(PLATFORM.apiBase, "/me/save");
      return valid(b) ? b : null;
    },
    store: async (blob) => {
      await api(PLATFORM.apiBase, "/me/save", { method: "PUT", body: JSON.stringify(blob) });
    },
  };
}

function hostBackend(db: HostDb, id: string): SaveBackend {
  // Nhánh data/users/<id>/ là riêng tư của từng người (kể cả với chủ artifact)
  const ref = db.doc(`data/users/${id}/save`);
  return {
    kind: "host",
    load: async () => {
      const snap = await ref.get();
      const d = snap.data();
      if (!d || typeof d.json !== "string") return null;
      try {
        const b = JSON.parse(d.json);
        return valid(b) ? b : null;
      } catch {
        return null;
      }
    },
    // Lưu dạng một chuỗi JSON để khoá có dấu chấm ("cyberhood.save.v1") không bị hiểu là đường dẫn trường
    store: (blob) => ref.set({ json: JSON.stringify(blob), savedAt: blob.savedAt }),
  };
}

let backend: SaveBackend | null = null;
let lastSent = "";

/** Gọi trước khi nạp game: chọn nơi lưu, kéo bản lưu mới hơn về localStorage */
export async function bootSave() {
  const user = await hostUse<HostUser>("user");
  if (user) {
    const name = await user.name().catch(() => "");
    if (name) usePlatform.setState({ accountName: name });
  }
  if (PLATFORM.apiBase && (await import("./auth")).useAuth.getState().token) backend = apiBackend();
  else {
    const [db, id] = await Promise.all([hostUse<HostDb>("db"), user ? user.id().catch(() => null) : null]);
    if (db && id) backend = hostBackend(db, id);
  }
  if (!backend) return;
  try {
    const remote = await backend.load();
    if (remote && remote.savedAt > localSavedAt()) apply(remote);
    lastSent = JSON.stringify(snapshot());
    usePlatform.setState({ save: backend.kind === "api" ? "account" : "cloud" });
  } catch {
    usePlatform.setState({ save: "local" });
  }
}

async function flush() {
  if (!backend) return;
  const data = snapshot();
  const json = JSON.stringify(data);
  if (json === lastSent) return;
  const blob = { savedAt: Date.now(), data };
  try {
    await backend.store(blob);
    lastSent = json;
    localStorage.setItem(META, JSON.stringify({ savedAt: blob.savedAt }));
    usePlatform.setState({ lastCloudSave: blob.savedAt });
  } catch {
    // Viewer chỉ có quyền xem không ghi được: giữ lưu cục bộ, thử lại lần sau
    usePlatform.setState({ save: "local" });
  }
}

/** Đẩy bản lưu mỗi 15 giây khi có thay đổi, và khi người chơi rời trang */
export function startAutoSave() {
  if (!backend) return;
  setInterval(flush, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
