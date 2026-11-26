import { z } from "zod";
import { parseMyKad, normaliseMyKad } from "./mykad";

const optional = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

export const patientSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name is required").max(150),
    idType: z.enum(["MYKAD", "PASSPORT", "OTHER"]),
    idNumber: z.string().trim().min(3, "ID number is required").max(30),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth is required"),
    gender: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
    nationality: z.string().trim().min(2).max(60),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?6?0)?[0-9\s-]{7,14}$/, "Phone looks wrong (e.g. 012-345 6789)")
      .or(z.literal(""))
      .transform((v) => (v === "" ? null : v)),
    email: z.string().trim().email("Email looks wrong").or(z.literal("")).transform((v) => (v === "" ? null : v)),
    address: optional,
    emergencyName: optional,
    emergencyPhone: optional,
  })
  .transform((p, ctx) => {
    if (p.idType === "MYKAD") {
      const r = parseMyKad(p.idNumber);
      if (!r.ok) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["idNumber"], message: r.error });
        return z.NEVER;
      }
      // MyKad is the source of truth for DOB and gender.
      return { ...p, idNumber: r.digits, dob: r.dob, gender: r.gender as "MALE" | "FEMALE" };
    }
    return { ...p, idNumber: normaliseMyKad(p.idNumber).toUpperCase() };
  })
  .refine((p) => new Date(p.dob) <= new Date(), { path: ["dob"], message: "Date of birth cannot be in the future" });

export type PatientInput = z.infer<typeof patientSchema>;

export function patientFromForm(form: FormData) {
  const get = (k: string) => String(form.get(k) ?? "");
  return patientSchema.safeParse({
    fullName: get("fullName"),
    idType: get("idType"),
    idNumber: get("idNumber"),
    dob: get("dob"),
    gender: get("gender") || "UNKNOWN",
    nationality: get("nationality") || "Malaysian",
    phone: get("phone"),
    email: get("email"),
    address: get("address"),
    emergencyName: get("emergencyName"),
    emergencyPhone: get("emergencyPhone"),
  });
}
