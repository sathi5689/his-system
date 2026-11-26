import { describe, expect, it } from "vitest";
import { parseMyKad, formatMyKad, normaliseMyKad } from "./mykad";

const today = new Date("2026-11-26T00:00:00Z");

describe("parseMyKad", () => {
  it("reads DOB, gender and state from a valid number", () => {
    const r = parseMyKad("850412-14-5671", today);
    expect(r).toEqual({ ok: true, digits: "850412145671", formatted: "850412-14-5671", dob: "1985-04-12", gender: "MALE", birthPlace: "WP Kuala Lumpur" });
  });

  it("even last digit is female", () => {
    const r = parseMyKad("920830105522", today);
    expect(r.ok && r.gender).toBe("FEMALE");
  });

  it("picks the 2000s for years up to the current year", () => {
    const r = parseMyKad("150711100124", today);
    expect(r.ok && r.dob).toBe("2015-07-11");
  });

  it("picks the 1900s for years after the current year", () => {
    const r = parseMyKad("300101010011", today);
    expect(r.ok && r.dob).toBe("1930-01-01");
  });

  it("accepts spaces and dashes", () => {
    expect(parseMyKad(" 850412 14 5671 ", today).ok).toBe(true);
  });

  it("rejects wrong length and letters", () => {
    expect(parseMyKad("85041214567", today).ok).toBe(false);
    expect(parseMyKad("85041214567A", today).ok).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(parseMyKad("850230145671", today).ok).toBe(false); // 30 Feb
    expect(parseMyKad("851312145671", today).ok).toBe(false); // month 13
  });

  it("handles leap years", () => {
    expect(parseMyKad("000229145671", today).ok).toBe(true); // 2000 was a leap year
    expect(parseMyKad("010229145671", today).ok).toBe(false);
  });

  it("rejects future birth dates in the current year", () => {
    expect(parseMyKad("261225145671", today).ok).toBe(false);
  });

  it("rejects invalid place-of-birth codes", () => {
    expect(parseMyKad("850412005671", today).ok).toBe(false);
    expect(parseMyKad("850412175671", today).ok).toBe(false);
  });

  it("marks foreign-born codes", () => {
    const r = parseMyKad("850412715671", today);
    expect(r.ok && r.birthPlace).toBe("Born outside Malaysia");
  });
});

describe("format helpers", () => {
  it("formats and normalises", () => {
    expect(formatMyKad("850412145671")).toBe("850412-14-5671");
    expect(normaliseMyKad("850412-14-5671")).toBe("850412145671");
  });
});
