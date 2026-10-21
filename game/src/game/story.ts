import { CITY } from "./config";

// Toàn bộ nội dung cốt truyện viết dưới dạng dữ liệu: thêm NPC, vật phẩm, nhiệm vụ mới
// chỉ cần sửa file này, không phải đụng vào code gameplay.

const Y = CITY.SIDEWALK_HEIGHT;

// ---------------------------------------------------------------------------
// Địa điểm

/** Hầm Server Vault nằm ngoài bản đồ thành phố; vào bằng cửa ở The Undergrid */
export const VAULT_ORIGIN: [number, number, number] = [0, 0, 1500];
export const VAULT_DOOR: [number, number, number] = [-65, Y, -70];
export const SHARD_SPOTS: [number, number, number][] = [
  [-28, 1.1, 56],
  [-56, 1.1, 92],
  [-96, 1.1, 56],
];

// ---------------------------------------------------------------------------
// NPC

export type NpcId = "rook" | "vex" | "echo" | "ghost";

export type Npc = {
  id: NpcId;
  name: string;
  role: string;
  /** Vị trí trong thành phố; GHOST_0 nằm trong vault nên toạ độ tính từ VAULT_ORIGIN */
  pos: [number, number, number];
  yaw: number;
  body: string;
  glow: string;
  inVault?: boolean;
  hologram?: boolean;
  /** Câu chào khi không có việc gì liên quan nhiệm vụ */
  idle: string[];
};

export const NPCS: Record<NpcId, Npc> = {
  rook: {
    id: "rook",
    name: "Rook",
    role: "Fixer",
    pos: [-10.2, Y, 13],
    yaw: Math.PI / 2,
    body: "#2a2410",
    glow: "#ffb000",
    idle: ["Thành phố này trả công cho kẻ dám làm, Runner.", "Cần việc thì quay lại. Tôi luôn có việc."],
  },
  vex: {
    id: "vex",
    name: "Vex",
    role: "Ripperdoc",
    pos: [11.1, Y, 13],
    yaw: -Math.PI / 2,
    body: "#0b2a33",
    glow: "#05d9e8",
    idle: ["Cần nâng cấp thì cứ nói. Giá chợ đen, không hỏi han."],
  },
  echo: {
    id: "echo",
    name: "Echo",
    role: "Netrunner",
    pos: [-65.6, Y, 65.6],
    yaw: Math.PI * 0.75,
    body: "#0f2a1a",
    glow: "#39ff88",
    idle: ["Dữ liệu không bao giờ nói dối. Chỉ có người đọc sai.", "Tôi đang lắng nghe mạng lưới. Đừng làm ồn."],
  },
  ghost: {
    id: "ghost",
    name: "GHOST_0",
    role: "Hologram",
    pos: [0, 0, 0],
    yaw: Math.PI,
    body: "#05d9e8",
    glow: "#05d9e8",
    inVault: true,
    hologram: true,
    idle: ["Root Protocol đang chờ, Runner. Ba Firewall. Ba chìa khoá."],
  },
};

// ---------------------------------------------------------------------------
// Vật phẩm

export type ItemId = "stim" | "shard" | "ghostKey" | "chestKey";

export const ITEMS: Record<ItemId, { name: string; desc: string; usable: boolean; quest?: boolean }> = {
  stim: { name: "Stim Pack", desc: "Hồi 60 máu. Nhấn Q để dùng nhanh.", usable: true },
  chestKey: { name: "Chìa rương", desc: "Mở rương giấu trong các màn sau cổng nhiệm vụ. Rơi từ địch, chỉ kiếm được bằng chơi.", usable: false },
  shard: { name: "Data Shard", desc: "Mảnh dữ liệu mã hoá, phát tín hiệu lạ.", usable: false, quest: true },
  ghostKey: {
    name: "Ghost Fragment",
    desc: "Mảnh mã của GHOST_0. Mở đường tới Firewall đầu tiên.",
    usable: false,
    quest: true,
  },
};

// ---------------------------------------------------------------------------
// Nhiệm vụ

export type Step =
  | { kind: "talk"; npc: NpcId; text: string; line: string }
  | { kind: "kill"; count: number; text: string }
  | { kind: "collect"; item: ItemId; count: number; text: string }
  | { kind: "reach"; target: [number, number, number]; radius: number; text: string }
  | { kind: "enterVault"; text: string }
  | { kind: "terminal"; text: string; line: string };

export type Quest = {
  id: string;
  title: string;
  giver: NpcId;
  /** Lời mời nhận việc trong hội thoại */
  pitch: string;
  steps: Step[];
  reward: { cred: number; items?: Partial<Record<ItemId, number>> };
  /** Vật phẩm nhiệm vụ bị lấy đi khi hoàn thành */
  consume?: Partial<Record<ItemId, number>>;
};

export const QUESTS: Quest[] = [
  {
    id: "jack-in",
    title: "Jack In",
    giver: "rook",
    pitch:
      "Runner mới hả? Muốn sống ở Cyberhood thì cần đồ chơi. Qua quầy của Vex bên kia đường, nói là Rook gửi tới.",
    steps: [
      {
        kind: "talk",
        npc: "vex",
        text: "Gặp Vex ở quầy Neon Bazaar",
        line: "Rook gửi cậu tới à? Được. Tôi bán đồ, cậu kiếm CRED. Giữ mạng để còn quay lại mua.",
      },
      {
        kind: "talk",
        npc: "rook",
        text: "Quay lại báo cho Rook",
        line: "Tốt. Giờ cậu đã có mối. Bước tiếp theo mới là việc thật.",
      },
    ],
    reward: { cred: 60, items: { stim: 1 } },
  },
  {
    id: "static-noise",
    title: "Static Noise",
    giver: "rook",
    pitch:
      "Drone của OMNI-DYNE quét khu này suốt đêm, làm khách của tôi sợ. Hạ ba con cho chúng biết ai đang cai quản phố này.",
    steps: [
      { kind: "kill", count: 3, text: "Hạ drone OMNI-DYNE" },
      {
        kind: "talk",
        npc: "rook",
        text: "Báo cáo với Rook",
        line: "Ba con. Sạch sẽ. Trong lúc cậu bận, tôi bắt được một tín hiệu lạ từ Data Haven...",
      },
    ],
    reward: { cred: 120 },
  },
  {
    id: "ghost-signal",
    title: "Ghost Signal",
    giver: "rook",
    pitch:
      "Tín hiệu ký tên GHOST_0. Người sáng lập Cyberhood, chết từ mười năm trước. Có ba mảnh dữ liệu rơi ở Data Haven. Lấy chúng về. Đi xe cho nhanh.",
    steps: [
      { kind: "collect", item: "shard", count: 3, text: "Thu thập Data Shard ở Data Haven" },
      {
        kind: "talk",
        npc: "echo",
        text: "Mang các mảnh tới Netrunner Echo",
        line: "Ba mảnh này là một khoá. Ai đó muốn chúng ta tìm thấy thứ gì đó dưới The Undergrid.",
      },
    ],
    reward: { cred: 150 },
    consume: { shard: 3 },
  },
  {
    id: "the-courier",
    title: "The Courier",
    giver: "echo",
    pitch:
      "Toạ độ giải mã chỉ tới một cánh cửa bỏ hoang ở The Undergrid. Server Vault. Tôi sẽ mở khoá từ xa, cậu tới đó và vào trong.",
    steps: [
      { kind: "reach", target: VAULT_DOOR, radius: 6, text: "Tới cửa Server Vault ở The Undergrid" },
      { kind: "enterVault", text: "Vào Server Vault (nhấn E ở cửa)" },
    ],
    reward: { cred: 100 },
  },
  {
    id: "root-access",
    title: "Root Access",
    giver: "ghost",
    pitch: "...tín hiệu... yếu... Runner, cậu tới rồi. Kết nối thần kinh vào terminal. Tôi có một thông điệp, chỉ phát một lần.",
    steps: [
      {
        kind: "terminal",
        text: "Kích hoạt terminal của GHOST_0",
        line:
          "Nếu cậu nghe thấy lời này, tôi đã chết. Cyberhood là di sản của tôi, và OMNI-DYNE muốn nuốt trọn nó. Tôi giấu Root Protocol sau ba Firewall. Ai vượt qua cả ba sẽ nắm quyền điều hành thành phố. Mảnh mã này mở Firewall đầu tiên. Đừng để chúng lấy được nó.",
      },
    ],
    reward: { cred: 300, items: { ghostKey: 1 } },
  },
];

export function questById(id: string | null) {
  return QUESTS.find((q) => q.id === id) ?? null;
}

/** Nhiệm vụ kế tiếp chưa làm, theo thứ tự cốt truyện */
export function nextQuest(done: string[]) {
  return QUESTS.find((q) => !done.includes(q.id)) ?? null;
}
