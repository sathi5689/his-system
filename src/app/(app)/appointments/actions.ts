"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { normaliseMyKad } from "@/lib/mykad";
import { mytDate, parseMytLocal } from "@/lib/time";
import { redirectWith } from "@/lib/flash";
import { issueTicket } from "@/lib/queue";

const bookSchema = z.object({
  patientId: z.string().optional(),
  patientLookup: z.string().trim().optional(),
  practitionerId: z.string().optional(),
  startAt: z.string(),
  durationMin: z.coerce.number().int().min(5).max(240),
  reason: z.string().trim().max(200).optional(),
});

export async function bookAppointment(form: FormData) {
  const user = await requireUser("appointments.write");
  const back = "/appointments";
  const parsed = bookSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirectWith(back, "error", "Please complete the booking form");
  const d = parsed.data;

  const startAt = parseMytLocal(d.startAt);
  if (!startAt) redirectWith(back, "error", "Pick a valid date and time");
  if (startAt.getTime() < Date.now() - 5 * 60_000) redirectWith(back, "error", "Appointment time is in the past");

  // Find patient by id (from patient page) or by MRN / ID number typed at the desk.
  let patientId = d.patientId || null;
  if (!patientId && d.patientLookup) {
    const term = d.patientLookup.toUpperCase();
    const p = await db.patient.findFirst({
      where: { OR: [{ mrn: term }, { idNumber: normaliseMyKad(term) }] },
      select: { id: true },
    });
    patientId = p?.id ?? null;
  }
  if (!patientId) redirectWith(back, "error", "Patient not found. Use MRN or ID number, or register the patient first");

  const practitionerId = d.practitionerId || null;
  if (practitionerId) {
    const end = new Date(startAt.getTime() + d.durationMin * 60_000);
    // Overlap check: existing.start < new.end AND existing.end > new.start.
    const others = await db.appointment.findMany({
      where: {
        practitionerId,
        status: { in: ["BOOKED", "CHECKED_IN"] },
        startAt: { lt: end, gte: new Date(startAt.getTime() - 240 * 60_000) },
      },
      select: { startAt: true, durationMin: true },
    });
    if (others.some((o) => o.startAt.getTime() + o.durationMin * 60_000 > startAt.getTime())) {
      redirectWith(back, "error", "That practitioner is already booked at this time");
    }
  }

  const appt = await db.$transaction(async (tx) => {
    const a = await tx.appointment.create({
      data: { branchId: user.branch.id, patientId, practitionerId, startAt, durationMin: d.durationMin, reason: d.reason || null },
    });
    await audit({ user, action: "CREATE", entity: "Appointment", entityId: a.id }, tx);
    return a;
  });

  revalidatePath("/appointments");
  redirectWith(`/appointments?date=${mytDate(appt.startAt)}`, "ok", "Appointment booked");
}

export async function setAppointmentStatus(form: FormData) {
  const user = await requireUser("appointments.write");
  const id = String(form.get("appointmentId") ?? "");
  const status = String(form.get("status") ?? "");
  const appt = await db.appointment.findFirst({ where: { id, branchId: user.branch.id }, include: { queueTicket: true } });
  const back = `/appointments?date=${appt ? mytDate(appt.startAt) : mytDate()}`;
  if (!appt) redirectWith(back, "error", "Appointment not found at this branch");

  if (status === "CHECKED_IN") {
    if (appt.status !== "BOOKED") redirectWith(back, "error", "Only booked appointments can be checked in");
    if (mytDate(appt.startAt) !== mytDate()) redirectWith(back, "error", "Only today's appointments can be checked in");
    const ticket = await db.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id }, data: { status: "CHECKED_IN" } });
      await audit({ user, action: "UPDATE", entity: "Appointment", entityId: id, details: { to: "CHECKED_IN" } }, tx);
      return issueTicket(tx, user, appt.patientId, "APPOINTMENT", id);
    });
    revalidatePath("/appointments");
    redirectWith(back, "ok", `Checked in. Queue number ${ticket.displayNo}`);
  }

  if (status === "CANCELLED" || status === "NO_SHOW") {
    if (appt.status !== "BOOKED") redirectWith(back, "error", "Only booked appointments can be changed");
    await db.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id }, data: { status } });
      await audit({ user, action: "UPDATE", entity: "Appointment", entityId: id, details: { to: status } }, tx);
    });
    revalidatePath("/appointments");
    redirectWith(back, "ok", status === "CANCELLED" ? "Appointment cancelled" : "Marked as no-show");
  }

  redirectWith(back, "error", "Unknown action");
}
