import { describe, it, expect } from "vitest";
import {
  byteLength,
  bounty,
  returned,
  timeLeft,
  noteAngle,
  PINBOARD_CONSTANTS,
} from "../pinboard";

describe("pinboard library", () => {
  describe("byteLength", () => {
    it("measures ASCII string correctly", () => {
      expect(byteLength("hello")).toBe(5);
      expect(byteLength("")).toBe(0);
    });

    it("measures multi-byte UTF-8 string correctly", () => {
      expect(byteLength("café")).toBe(5); // 'é' is 2 bytes
      expect(byteLength("🎉")).toBe(4);   // emoji is 4 bytes
    });
  });

  describe("bounty and returned calculation", () => {
    it("computes 20% bounty and 80% remainder", () => {
      const dep = 1000000000000000000n; // 1 BOT
      const b = bounty(dep);
      const r = returned(dep);

      expect(b).toBe(200000000000000000n); // 0.2 BOT
      expect(r).toBe(800000000000000000n); // 0.8 BOT
      expect(b + r).toBe(dep);
    });

    it("conserves odd wei deposits", () => {
      const oddDep = 10000000000000003n; // 0.010000000000000003 BOT
      const b = bounty(oddDep);
      const r = returned(oddDep);
      expect(b + r).toBe(oddDep);
    });
  });

  describe("timeLeft", () => {
    const now = 1_000_000n;

    it("identifies expired notices", () => {
      const res = timeLeft(now - 100n, now);
      expect(res.expired).toBe(true);
      expect(res.text).toContain("Expired");
    });

    it("computes hours and minutes left", () => {
      const res = timeLeft(now + 3600n * 3n + 120n, now);
      expect(res.expired).toBe(false);
      expect(res.text).toBe("3h 2m left");
    });
  });

  describe("noteAngle", () => {
    it("is stable and bounded between -3 and +3 degrees", () => {
      const a1 = noteAngle(1n);
      const a2 = noteAngle(1n);
      expect(a1).toBe(a2);
      expect(Math.abs(a1)).toBeLessThanOrEqual(3);
    });
  });
});
