// Khi game chạy như artifact trên claude.ai, host cung cấp vài năng lực runtime (window.claude.use):
// `room` (ai đang mở game lúc này — dùng cho chơi chung), `db` (lưu hồ sơ theo từng người), `user` (danh tính, tên).
// Chạy ở play.cyberhood.xyz thì không có window.claude: mọi hàm trả null và game dùng Platform API / lưu cục bộ.

type HostUse = (name: string) => Promise<unknown>;

export function hostUse<T>(name: "room" | "db" | "user"): Promise<T | null> {
  const c = (typeof window !== "undefined" ? (window as unknown as { claude?: { use?: HostUse } }).claude : undefined) ?? null;
  if (!c?.use) return Promise.resolve(null);
  return c.use(name).then(
    (ns) => (ns ?? null) as T | null,
    () => null,
  );
}

/** Kiểu tối thiểu của các namespace game dùng (bản đầy đủ: định nghĩa kiểu của host) */
export type HostUser = { id(): Promise<string | null>; name(): Promise<string> };
export type HostDocSnap = { exists?: boolean; data(): Record<string, unknown> | undefined };
export type HostDb = {
  doc(path: string): { get(): Promise<HostDocSnap>; set(data: Record<string, unknown>): Promise<void> };
};
export type HostPeer = {
  peer: string;
  by: string | null;
  isMe: boolean;
  sameTab: boolean;
  kind: "viewer" | "agent";
  presence: Readonly<Record<string, unknown>>;
  updatedAt: number;
};
export type HostRoom = {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly HostPeer[];
  onPeers(fn: (c: { peers: readonly HostPeer[] }) => void, onError?: (e: { code: string }) => void): () => void;
  connected(): boolean;
};
