// Nhiệm vụ ngày / tuần / tháng và Điểm Hunter (GDD mục 10 + thiết kế 9B "cơ chế có lợi cho người chơi").
// Thuần TypeScript: định nghĩa, ghi tiến độ, làm mới theo kỳ, nhận thưởng. Giao diện ở ui/MissionPanel.tsx.
// Điểm Hunter dùng để chia Quỹ thưởng tuần (40% doanh thu nền tảng, trả theo hoạt động, có trần mỗi tài khoản).
// Ở bản này chỉ tích điểm trong game; không hứa hẹn giá trị tiền.

export type Period = "daily" | "weekly" | "monthly";

/** Hành động trong game được đếm cho nhiệm vụ */
export type Metric = "kill" | "clear" | "boss" | "chest" | "epic" | "legendary" | "login" | "cred";

export type Reward = {
  cred?: number;
  hunterPoints?: number;
  chestKeys?: number;
  stims?: number;
  /** Rương tuần: luôn có một linh kiện Sử thi trở lên */
  epicChest?: number;
  /** Rương tháng: luôn có một linh kiện Huyền thoại trở lên */
  legendaryChest?: number;
};

export type MissionDef = { id: string; period: Period; metric: Metric; goal: number; title: string; reward: Reward };

export const MISSIONS: MissionDef[] = [
  // Ngày: 3 việc nhẹ chơi 10–15 phút là xong, cộng thưởng khi xong cả 3
  { id: "d_login", period: "daily", metric: "login", goal: 1, title: "Đăng nhập Cyberhood", reward: { cred: 20, hunterPoints: 5 } },
  { id: "d_kill", period: "daily", metric: "kill", goal: 25, title: "Hạ 25 địch sau cổng nhiệm vụ", reward: { cred: 40, hunterPoints: 20 } },
  { id: "d_clear", period: "daily", metric: "clear", goal: 1, title: "Qua 1 màn", reward: { cred: 60, hunterPoints: 20, chestKeys: 1 } },
  { id: "d_chest", period: "daily", metric: "chest", goal: 1, title: "Mở 1 rương", reward: { cred: 30, hunterPoints: 15 } },
  // Tuần
  { id: "w_clear", period: "weekly", metric: "clear", goal: 5, title: "Qua 5 màn", reward: { hunterPoints: 100, chestKeys: 2 } },
  { id: "w_boss", period: "weekly", metric: "boss", goal: 3, title: "Hạ trùm 3 lần", reward: { hunterPoints: 80, epicChest: 1 } },
  { id: "w_epic", period: "weekly", metric: "epic", goal: 2, title: "Nhặt 2 linh kiện Sử thi trở lên", reward: { cred: 150, hunterPoints: 60 } },
  { id: "w_chest", period: "weekly", metric: "chest", goal: 5, title: "Mở 5 rương", reward: { cred: 120, hunterPoints: 50, stims: 2 } },
  // Tháng
  { id: "m_login", period: "monthly", metric: "login", goal: 15, title: "Đăng nhập 15 ngày", reward: { hunterPoints: 300, chestKeys: 3 } },
  { id: "m_clear", period: "monthly", metric: "clear", goal: 20, title: "Qua 20 màn", reward: { hunterPoints: 400, legendaryChest: 1 } },
  { id: "m_kill", period: "monthly", metric: "kill", goal: 500, title: "Hạ 500 địch", reward: { cred: 500, hunterPoints: 250 } },
  { id: "m_legend", period: "monthly", metric: "legendary", goal: 1, title: "Nhặt 1 linh kiện Huyền thoại", reward: { cred: 400, hunterPoints: 200 } },
];

/** Thưởng thêm khi xong mọi nhiệm vụ của kỳ (trừ đăng nhập) */
export const PERIOD_BONUS: Record<Period, Reward> = {
  daily: { hunterPoints: 30, chestKeys: 1 },
  weekly: { hunterPoints: 150, epicChest: 1 },
  monthly: { hunterPoints: 600, legendaryChest: 1 },
};

export const HUNTER_POINTS = {
  /** Trần điểm tính thưởng mỗi tuần mỗi tài khoản; vượt ngưỡng `soft` thì chỉ tính một nửa (chống cày bằng bot) */
  weeklyCap: 2500,
  soft: 1200,
  aboveSoftRate: 0.5,
};

export type PeriodState = { key: string; progress: Record<string, number>; claimed: string[]; bonusClaimed: boolean };

export type MissionState = {
  daily: PeriodState;
  weekly: PeriodState;
  monthly: PeriodState;
  /** Điểm Hunter tuần này (đã áp trần) và tổng từ trước tới nay */
  hunterPoints: { week: string; points: number; total: number };
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Khoá kỳ theo giờ máy người chơi: ngày YYYY-MM-DD, tuần bắt đầu thứ Hai, tháng YYYY-MM */
export function periodKey(period: Period, now: Date): string {
  if (period === "daily") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  if (period === "monthly") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return `W${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lúc kỳ hiện tại kết thúc (để hiện đồng hồ đếm ngược) */
export function periodEnds(period: Period, now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "daily") d.setDate(d.getDate() + 1);
  else if (period === "weekly") d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7);
  else return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return d;
}

const freshPeriod = (key: string): PeriodState => ({ key, progress: {}, claimed: [], bonusClaimed: false });

export function freshMissions(now: Date): MissionState {
  return {
    daily: freshPeriod(periodKey("daily", now)),
    weekly: freshPeriod(periodKey("weekly", now)),
    monthly: freshPeriod(periodKey("monthly", now)),
    hunterPoints: { week: periodKey("weekly", now), points: 0, total: 0 },
  };
}

/** Sang kỳ mới thì làm mới tiến độ kỳ đó. Trả về state mới (không sửa state cũ) */
export function refresh(s: MissionState, now: Date): MissionState {
  const next = { ...s };
  for (const p of ["daily", "weekly", "monthly"] as Period[]) {
    const key = periodKey(p, now);
    if (s[p].key !== key) next[p] = freshPeriod(key);
  }
  const week = periodKey("weekly", now);
  if (s.hunterPoints.week !== week) next.hunterPoints = { week, points: 0, total: s.hunterPoints.total };
  return next;
}

/** Ghi một hành động. "login" chỉ đếm một lần mỗi ngày */
export function track(s: MissionState, metric: Metric, amount: number, now: Date): MissionState {
  let next = refresh(s, now);
  if (metric === "login") {
    if ((next.daily.progress.__login ?? 0) > 0) return next;
    next = { ...next, daily: { ...next.daily, progress: { ...next.daily.progress, __login: 1 } } };
  }
  for (const p of ["daily", "weekly", "monthly"] as Period[]) {
    const st = next[p];
    const progress = { ...st.progress };
    for (const m of MISSIONS) if (m.period === p && m.metric === metric) progress[m.id] = Math.min(m.goal, (progress[m.id] ?? 0) + amount);
    next = { ...next, [p]: { ...st, progress } };
  }
  return next;
}

export const isDone = (s: MissionState, m: MissionDef) => (s[m.period].progress[m.id] ?? 0) >= m.goal;
export const isClaimed = (s: MissionState, m: MissionDef) => s[m.period].claimed.includes(m.id);

/** Nhận thưởng một nhiệm vụ đã xong. Trả về state mới + phần thưởng, hoặc null nếu chưa nhận được */
export function claim(s: MissionState, id: string, now: Date): { state: MissionState; reward: Reward } | null {
  const fresh = refresh(s, now);
  const m = MISSIONS.find((x) => x.id === id);
  if (!m || !isDone(fresh, m) || isClaimed(fresh, m)) return null;
  const st = fresh[m.period];
  let state: MissionState = { ...fresh, [m.period]: { ...st, claimed: [...st.claimed, m.id] } };
  state = addHunterPoints(state, m.reward.hunterPoints ?? 0);
  return { state, reward: m.reward };
}

/** Thưởng xong cả kỳ: mọi nhiệm vụ (trừ đăng nhập ngày) đã nhận */
export function canClaimBonus(s: MissionState, p: Period) {
  const list = MISSIONS.filter((m) => m.period === p && !(p === "daily" && m.metric === "login"));
  return !s[p].bonusClaimed && list.every((m) => isClaimed(s, m));
}

export function claimBonus(s: MissionState, p: Period, now: Date): { state: MissionState; reward: Reward } | null {
  const fresh = refresh(s, now);
  if (!canClaimBonus(fresh, p)) return null;
  let state: MissionState = { ...fresh, [p]: { ...fresh[p], bonusClaimed: true } };
  state = addHunterPoints(state, PERIOD_BONUS[p].hunterPoints ?? 0);
  return { state, reward: PERIOD_BONUS[p] };
}

/** Cộng Điểm Hunter có lợi suất giảm dần và trần tuần */
export function addHunterPoints(s: MissionState, raw: number): MissionState {
  const H = HUNTER_POINTS;
  let pts = s.hunterPoints.points;
  let left = raw;
  while (left > 0 && pts < H.weeklyCap) {
    const step = Math.min(left, pts < H.soft ? H.soft - pts : left);
    pts += pts < H.soft ? step : step * H.aboveSoftRate;
    left -= step;
  }
  pts = Math.min(H.weeklyCap, Math.round(pts));
  const gained = pts - s.hunterPoints.points;
  return { ...s, hunterPoints: { ...s.hunterPoints, points: pts, total: s.hunterPoints.total + gained } };
}
