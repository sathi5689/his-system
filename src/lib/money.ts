// Money helpers. All amounts are integer sen (RM 1.00 = 100 sen).

const fmt = new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" });

export function formatRM(sen: number): string {
  return fmt.format(sen / 100);
}

/** Parse "12.50", "RM 12.50" or "1,200" into sen. Returns null when invalid. */
export function parseRM(input: string): number | null {
  const clean = input.replace(/RM/i, "").replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function invoiceTotals(items: { amountSen: number }[], discountSen: number) {
  const subtotalSen = items.reduce((s, i) => s + i.amountSen, 0);
  const discount = Math.min(Math.max(discountSen, 0), subtotalSen);
  return { subtotalSen, discountSen: discount, totalSen: subtotalSen - discount };
}

export type PaidStatus = "ISSUED" | "PARTIALLY_PAID" | "PAID";

export function paidStatus(totalSen: number, paidSen: number): PaidStatus {
  if (paidSen <= 0) return "ISSUED";
  if (paidSen >= totalSen) return "PAID";
  return "PARTIALLY_PAID";
}
