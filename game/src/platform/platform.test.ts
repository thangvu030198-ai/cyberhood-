import { describe, expect, test } from "vitest";
import { parseWebMessage } from "./protocol";
import { sanitize } from "./net";
import { versionLess } from "./remote";

describe("protocol", () => {
  test("accepts v1 AUTH, rejects unknown / wrong version / bad payload", () => {
    expect(parseWebMessage({ v: 1, type: "AUTH", payload: { token: "abc" } })?.type).toBe("AUTH");
    expect(parseWebMessage({ v: 2, type: "AUTH", payload: { token: "abc" } })).toBeNull();
    expect(parseWebMessage({ v: 1, type: "EVAL", payload: {} })).toBeNull();
    expect(parseWebMessage({ v: 1, type: "AUTH", payload: { token: 5 } })).toBeNull();
    expect(parseWebMessage({ v: 1, type: "SIGN_RESULT", payload: { ok: true, txHash: "0x1" } })?.type).toBe("SIGN_RESULT");
    expect(parseWebMessage("AUTH")).toBeNull();
  });
});

describe("net sanitize", () => {
  const ok = { v: 1, n: "Ann", h: "ninja", g: "#ff2a6d", l: "city", p: [1, 2, 3], r: 0.5, a: 2, m: "foot" };
  test("keeps a valid state", () => expect(sanitize(ok)).toEqual(ok));
  test("cleans hostile input", () => {
    const s = sanitize({ ...ok, n: "<b>‮Evil\u0000Name-that-is-way-too-long</b>", h: "dragon", g: "red", l: "mars", p: [1e9, NaN, -3], a: 99, m: "ufo" })!;
    expect(s.n.length).toBeLessThanOrEqual(16);
    expect(s.n).not.toMatch(/[‮\u0000]/);
    expect(s.h).toBe("racer");
    expect(s.g).toBe("#05d9e8");
    expect(s.l).toBe("city");
    expect(s.p).toEqual([5000, 0, -3]);
    expect(s.a).toBe(3);
    expect(s.m).toBe("foot");
  });
  test("rejects non-states", () => {
    expect(sanitize(null)).toBeNull();
    expect(sanitize({ v: 2, p: [0, 0, 0] })).toBeNull();
    expect(sanitize({ v: 1, p: [0, 0] })).toBeNull();
  });
});

describe("manifest", () => {
  test("versionLess", () => {
    expect(versionLess("1.4.2", "1.4.3")).toBe(true);
    expect(versionLess("1.10.0", "1.9.9")).toBe(false);
    expect(versionLess("1.4.0", "1.4.0")).toBe(false);
  });
});
