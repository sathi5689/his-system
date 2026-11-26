import { describe, expect, it } from "vitest";
import { ageYears, mytDate, mytDayRange, parseMytLocal } from "./time";

describe("Malaysia time", () => {
  it("uses the Malaysia date, not UTC", () => {
    // 20:00 UTC on 25 Nov is 04:00 on 26 Nov in Malaysia.
    expect(mytDate(new Date("2026-11-25T20:00:00Z"))).toBe("2026-11-26");
  });
  it("day range starts at Malaysia midnight", () => {
    expect(mytDayRange("2026-11-26").start.toISOString()).toBe("2026-11-25T16:00:00.000Z");
  });
  it("parses datetime-local as Malaysia time", () => {
    expect(parseMytLocal("2026-11-26T09:30")?.toISOString()).toBe("2026-11-26T01:30:00.000Z");
    expect(parseMytLocal("bad")).toBeNull();
  });
  it("calculates age", () => {
    expect(ageYears(new Date("1985-11-27"), new Date("2026-11-26T04:00:00Z"))).toBe(40);
    expect(ageYears(new Date("1985-11-26"), new Date("2026-11-26T04:00:00Z"))).toBe(41);
  });
});
