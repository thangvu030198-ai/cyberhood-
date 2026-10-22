import { describe, expect, it } from "vitest";
import { tr } from "./i18n";

describe("i18n", () => {
  it("dịch câu có trong từ điển, giữ khoảng trắng đầu/cuối của nút chữ", () => {
    expect(tr("VÀO TRẬN", "en")).toBe("ENTER BATTLE");
    expect(tr("  VÀO TRẬN ", "ja")).toBe("  出撃 ");
  });
  it("tiếng Việt giữ nguyên, câu lạ giữ nguyên", () => {
    expect(tr("VÀO TRẬN", "vi")).toBe("VÀO TRẬN");
    expect(tr("Cyberhood 2077", "en")).toBe("Cyberhood 2077");
  });
  it("mẫu có giá trị động", () => {
    expect(tr("Mục tiêu: Hạ Legion, cách 42 mét", "en")).toBe("Target: Kill Legion, 42 m away");
  });
  it("chuỗi ghép bằng dấu ·", () => {
    expect(tr("VÀO TRẬN · TUẦN NÀY", "en")).toBe("ENTER BATTLE · THIS WEEK");
  });
});
