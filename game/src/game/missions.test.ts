import { describe, expect, it } from "vitest";
import { HUNTER_POINTS, MISSIONS, addHunterPoints, canClaimBonus, claim, claimBonus, freshMissions, periodEnds, periodKey, track } from "./missions";

const MON = new Date(2026, 9, 19, 10); // thứ Hai 19/10/2026
const TUE = new Date(2026, 9, 20, 9);
const NEXT_MON = new Date(2026, 9, 26, 0, 5);
const NOV = new Date(2026, 10, 1, 8);

describe("nhiệm vụ ngày / tuần / tháng", () => {
  it("khoá kỳ: tuần bắt đầu thứ Hai, tháng theo lịch", () => {
    expect(periodKey("daily", MON)).toBe("2026-10-19");
    expect(periodKey("weekly", new Date(2026, 9, 25, 23))).toBe("W2026-10-19");
    expect(periodKey("weekly", NEXT_MON)).toBe("W2026-10-26");
    expect(periodKey("monthly", NOV)).toBe("2026-11");
    expect(periodEnds("weekly", TUE).getDate()).toBe(26);
  });

  it("đếm tiến độ cho cả ba kỳ, không vượt mục tiêu", () => {
    let s = freshMissions(MON);
    s = track(s, "kill", 40, MON);
    expect(s.daily.progress.d_kill).toBe(25);
    expect(s.monthly.progress.m_kill).toBe(40);
  });

  it("đăng nhập chỉ tính một lần mỗi ngày", () => {
    let s = freshMissions(MON);
    s = track(s, "login", 1, MON);
    s = track(s, "login", 1, MON);
    expect(s.monthly.progress.m_login).toBe(1);
    s = track(s, "login", 1, TUE);
    expect(s.monthly.progress.m_login).toBe(2);
  });

  it("nhận thưởng một lần; chưa xong thì không nhận được", () => {
    let s = freshMissions(MON);
    expect(claim(s, "d_clear", MON)).toBeNull();
    s = track(s, "clear", 1, MON);
    const r = claim(s, "d_clear", MON)!;
    expect(r.reward.chestKeys).toBe(1);
    expect(r.state.hunterPoints.points).toBe(20);
    expect(claim(r.state, "d_clear", MON)).toBeNull();
  });

  it("sang ngày mới: nhiệm vụ ngày làm mới, nhiệm vụ tuần giữ nguyên", () => {
    let s = freshMissions(MON);
    s = track(s, "clear", 1, MON);
    s = track(s, "kill", 1, TUE);
    expect(s.daily.progress.d_clear ?? 0).toBe(0);
    expect(s.weekly.progress.w_clear).toBe(1);
  });

  it("sang tuần mới: Điểm Hunter tuần về 0, tổng giữ lại", () => {
    let s = freshMissions(MON);
    s = addHunterPoints(s, 300);
    s = track(s, "kill", 1, NEXT_MON);
    expect(s.hunterPoints.points).toBe(0);
    expect(s.hunterPoints.total).toBe(300);
  });

  it("Điểm Hunter: vượt ngưỡng chỉ tính một nửa, có trần tuần", () => {
    let s = freshMissions(MON);
    s = addHunterPoints(s, HUNTER_POINTS.soft + 200);
    expect(s.hunterPoints.points).toBe(HUNTER_POINTS.soft + 100);
    s = addHunterPoints(s, 100000);
    expect(s.hunterPoints.points).toBe(HUNTER_POINTS.weeklyCap);
  });

  it("thưởng xong cả ngày sau khi nhận hết nhiệm vụ ngày", () => {
    let s = freshMissions(MON);
    s = track(s, "kill", 25, MON);
    s = track(s, "clear", 1, MON);
    s = track(s, "chest", 1, MON);
    for (const m of MISSIONS.filter((x) => x.period === "daily" && x.metric !== "login")) s = claim(s, m.id, MON)!.state;
    expect(canClaimBonus(s, "daily")).toBe(true);
    const b = claimBonus(s, "daily", MON)!;
    expect(b.reward.chestKeys).toBe(1);
    expect(claimBonus(b.state, "daily", MON)).toBeNull();
  });
});
