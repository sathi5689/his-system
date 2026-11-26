"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { patientFromForm } from "@/lib/patient-schema";
import { nextSequence, pad } from "@/lib/sequence";
import { PDPA_NOTICE_VERSION } from "@/lib/pdpa";
import { redirectWith } from "@/lib/flash";

export type PatientFormState = { error?: string; fieldErrors?: Record<string, string>; existingId?: string };

const METHODS = ["WRITTEN", "VERBAL", "ELECTRONIC"] as const;
type Method = (typeof METHODS)[number];
const toMethod = (v: FormDataEntryValue | null): Method => (METHODS.includes(v as Method) ? (v as Method) : "WRITTEN");

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

async function findDuplicate(idType: string, idNumber: string, excludeId?: string) {
  return db.patient.findFirst({
    where: { idType: idType as never, idNumber, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true, mrn: true, fullName: true },
  });
}

export async function createPatient(_prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  const user = await requireUser("patients.write");
  const parsed = patientFromForm(form);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };

  if (form.get("pdpaConsent") !== "on") {
    return { error: "PDPA consent is required to register a patient.", fieldErrors: { pdpaConsent: "Required" } };
  }

  const dup = await findDuplicate(parsed.data.idType, parsed.data.idNumber);
  if (dup) return { error: `This ID is already registered to ${dup.fullName} (${dup.mrn}).`, existingId: dup.id };

  const method = toMethod(form.get("consentMethod"));
  const marketing = form.get("marketingConsent") === "on";

  let patientId: string;
  try {
    patientId = await db.$transaction(async (tx) => {
      const seq = await nextSequence(tx, "mrn");
      const p = await tx.patient.create({
        data: {
          ...parsed.data,
          dob: new Date(parsed.data.dob),
          mrn: `P${pad(seq, 6)}`,
          registeredBranchId: user.branch.id,
          consents: {
            create: [
              { type: "PDPA_DATA_PROCESSING", version: PDPA_NOTICE_VERSION, granted: true, method, recordedById: user.id },
              { type: "MARKETING", version: PDPA_NOTICE_VERSION, granted: marketing, method, recordedById: user.id },
            ],
          },
        },
      });
      await audit({ user, action: "CREATE", entity: "Patient", entityId: p.id, details: { mrn: p.mrn } }, tx);
      return p.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "This ID number is already registered." };
    }
    throw e;
  }

  revalidatePath("/patients");
  redirect(`/patients/${patientId}?ok=${encodeURIComponent("Patient registered")}`);
}

export async function updatePatient(_prev: PatientFormState, form: FormData): Promise<PatientFormState> {
  const user = await requireUser("patients.write");
  const id = String(form.get("id") ?? "");
  const before = await db.patient.findUnique({ where: { id } });
  if (!before) return { error: "Patient not found." };

  const parsed = patientFromForm(form);
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error.issues) };

  const dup = await findDuplicate(parsed.data.idType, parsed.data.idNumber, id);
  if (dup) return { error: `This ID is already registered to ${dup.fullName} (${dup.mrn}).`, existingId: dup.id };

  const data = { ...parsed.data, dob: new Date(parsed.data.dob) };
  // Record which fields changed (names only, so the audit log does not copy personal data).
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => {
    const a = before[k as keyof typeof before];
    const b = data[k];
    return a instanceof Date && b instanceof Date ? a.getTime() !== b.getTime() : (a ?? null) !== (b ?? null);
  });

  await db.$transaction(async (tx) => {
    await tx.patient.update({ where: { id }, data });
    await audit({ user, action: "UPDATE", entity: "Patient", entityId: id, details: { changed } }, tx);
  });

  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}?ok=${encodeURIComponent("Patient updated")}`);
}

/** Grant or withdraw a consent. Each change is a new row, so history is kept. */
export async function setConsent(form: FormData) {
  const user = await requireUser("patients.write");
  const patientId = String(form.get("patientId") ?? "");
  const type = form.get("type") === "PDPA_DATA_PROCESSING" ? "PDPA_DATA_PROCESSING" : "MARKETING";
  const granted = form.get("granted") === "true";
  const method = toMethod(form.get("method"));

  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) redirectWith("/patients", "error", "Patient not found");

  await db.$transaction(async (tx) => {
    await tx.consent.updateMany({ where: { patientId, type, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
    await tx.consent.create({ data: { patientId, type, version: PDPA_NOTICE_VERSION, granted, method, recordedById: user.id } });
    await audit({ user, action: "UPDATE", entity: "Consent", entityId: patientId, details: { type, granted, method } }, tx);
  });

  revalidatePath(`/patients/${patientId}`);
  redirectWith(`/patients/${patientId}`, "ok", granted ? "Consent recorded" : "Consent withdrawn");
}
