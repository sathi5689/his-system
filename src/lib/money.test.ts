import { describe, expect, it } from "vitest";
import { formatRM, invoiceTotals, paidStatus, parseRM } from "./money";

describe("parseRM", () => {
  it("parses ringgit to sen", () => {
    expect(parseRM("12.50")).toBe(1250);
    expect(parseRM("RM 1,200")).toBe(120000);
    expect(parseRM("0.05")).toBe(5);
    expect(parseRM("7")).toBe(700);
  });
  it("rejects bad input", () => {
    expect(parseRM("")).toBeNull();
    expect(parseRM("-5")).toBeNull();
    expect(parseRM("1.234")).toBeNull();
    expect(parseRM("abc")).toBeNull();
  });
});

describe("invoice maths", () => {
  it("totals items and caps the discount", () => {
    expect(invoiceTotals([{ amountSen: 5000 }, { amountSen: 2500 }], 1000)).toEqual({ subtotalSen: 7500, discountSen: 1000, totalSen: 6500 });
    expect(invoiceTotals([{ amountSen: 5000 }], 9000)).toEqual({ subtotalSen: 5000, discountSen: 5000, totalSen: 0 });
  });
  it("works out paid status", () => {
    expect(paidStatus(1000, 0)).toBe("ISSUED");
    expect(paidStatus(1000, 400)).toBe("PARTIALLY_PAID");
    expect(paidStatus(1000, 1000)).toBe("PAID");
  });
  it("formats RM", () => {
    expect(formatRM(123456)).toMatch(/RM\s?1,234\.56/);
  });
});
