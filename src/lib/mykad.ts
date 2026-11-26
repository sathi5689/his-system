// MyKad (Malaysian IC) helpers. Format: YYMMDD-PB-###G
//  YYMMDD = date of birth, PB = place-of-birth code, last digit odd = male, even = female.
// Shared by the browser (auto-fill) and the server (validation).

export type MyKadResult =
  | { ok: true; digits: string; formatted: string; dob: string; gender: "MALE" | "FEMALE"; birthPlace: string }
  | { ok: false; error: string };

const STATES: Record<string, string> = {
  "01": "Johor", "21": "Johor", "22": "Johor", "23": "Johor", "24": "Johor",
  "02": "Kedah", "25": "Kedah", "26": "Kedah", "27": "Kedah",
  "03": "Kelantan", "28": "Kelantan", "29": "Kelantan",
  "04": "Melaka", "30": "Melaka",
  "05": "Negeri Sembilan", "31": "Negeri Sembilan", "59": "Negeri Sembilan",
  "06": "Pahang", "32": "Pahang", "33": "Pahang",
  "07": "Pulau Pinang", "34": "Pulau Pinang", "35": "Pulau Pinang",
  "08": "Perak", "36": "Perak", "37": "Perak", "38": "Perak", "39": "Perak",
  "09": "Perlis", "40": "Perlis",
  "10": "Selangor", "41": "Selangor", "42": "Selangor", "43": "Selangor", "44": "Selangor",
  "11": "Terengganu", "45": "Terengganu", "46": "Terengganu",
  "12": "Sabah", "47": "Sabah", "48": "Sabah", "49": "Sabah",
  "13": "Sarawak", "50": "Sarawak", "51": "Sarawak", "52": "Sarawak", "53": "Sarawak",
  "14": "WP Kuala Lumpur", "54": "WP Kuala Lumpur", "55": "WP Kuala Lumpur", "56": "WP Kuala Lumpur", "57": "WP Kuala Lumpur",
  "15": "WP Labuan", "58": "WP Labuan",
  "16": "WP Putrajaya",
};

// Codes not issued by JPN.
const INVALID_PB = new Set(["00", "17", "18", "19", "20", "69", "70", "73", "80", "81", "94", "95", "96", "97"]);

export function birthPlaceName(pb: string): string | null {
  if (INVALID_PB.has(pb)) return null;
  if (STATES[pb]) return STATES[pb];
  const n = Number(pb);
  if (n >= 60 && n <= 99) return "Born outside Malaysia";
  return null;
}

/** Strip spaces and dashes. */
export function normaliseMyKad(input: string): string {
  return input.replace(/[\s-]/g, "");
}

export function formatMyKad(digits: string): string {
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/**
 * Parse and validate a MyKad number.
 * @param today used to decide the century (YY greater than this year means 19YY).
 */
export function parseMyKad(input: string, today: Date = new Date()): MyKadResult {
  const digits = normaliseMyKad(input);
  if (!/^\d{12}$/.test(digits)) return { ok: false, error: "MyKad must be 12 digits (YYMMDD-PB-###G)" };

  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  const pb = digits.slice(6, 8);

  const currentYY = today.getUTCFullYear() % 100;
  const year = yy > currentYY ? 1900 + yy : 2000 + yy;

  const d = new Date(Date.UTC(year, mm - 1, dd));
  if (mm < 1 || mm > 12 || d.getUTCFullYear() !== year || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) {
    return { ok: false, error: "MyKad has an invalid birth date (first 6 digits)" };
  }
  if (d.getTime() > today.getTime()) return { ok: false, error: "MyKad birth date is in the future" };

  const birthPlace = birthPlaceName(pb);
  if (!birthPlace) return { ok: false, error: `MyKad place-of-birth code "${pb}" is not valid` };

  const last = Number(digits[11]);
  return {
    ok: true,
    digits,
    formatted: formatMyKad(digits),
    dob: `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
    gender: last % 2 === 1 ? "MALE" : "FEMALE",
    birthPlace,
  };
}
