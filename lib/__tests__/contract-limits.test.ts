import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { PINBOARD_CONSTANTS } from "../pinboard";

describe("contract limits agreement", () => {
  it("matches constants defined in Pinboard.sol", () => {
    const solPath = resolve(__dirname, "../../contracts/src/Pinboard.sol");
    const solContent = readFileSync(solPath, "utf8");

    // MAX_TEXT_BYTES = 200
    expect(solContent).toContain("MAX_TEXT_BYTES = 200");
    expect(PINBOARD_CONSTANTS.MAX_TEXT_BYTES).toBe(200);

    // TOPICS = 8
    expect(solContent).toContain("TOPICS = 8");
    expect(PINBOARD_CONSTANTS.TOPICS).toBe(8);

    // MIN_TTL = 1 hours
    expect(solContent).toContain("MIN_TTL = 1 hours");
    expect(PINBOARD_CONSTANTS.MIN_TTL).toBe(3600n);

    // MAX_TTL = 30 days
    expect(solContent).toContain("MAX_TTL = 30 days");
    expect(PINBOARD_CONSTANTS.MAX_TTL).toBe(2592000n);

    // MIN_DEPOSIT = 0.01 ether
    expect(solContent).toContain("MIN_DEPOSIT = 0.01 ether");
    expect(PINBOARD_CONSTANTS.MIN_DEPOSIT).toBe(10000000000000000n);

    // MAX_DEPOSIT = 100 ether
    expect(solContent).toContain("MAX_DEPOSIT = 100 ether");
    expect(PINBOARD_CONSTANTS.MAX_DEPOSIT).toBe(100000000000000000000n);

    // SWEEP_BPS = 2000
    expect(solContent).toContain("SWEEP_BPS = 2000");
    expect(PINBOARD_CONSTANTS.SWEEP_BPS).toBe(2000n);

    // MAX_PAGE = 50
    expect(solContent).toContain("MAX_PAGE = 50");
    expect(PINBOARD_CONSTANTS.MAX_PAGE).toBe(50);
  });
});
