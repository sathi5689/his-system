"use server";

import { revalidatePath } from "next/cache";
import type { QueueStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { issueTicket } from "@/lib/queue";
import { mytDate } from "@/lib/time";
import { redirectWith } from "@/lib/flash";

const ACTIVE: QueueStatus[] = ["WAITING", "CALLED", "IN_SERVICE"];

export async function addWalkIn(form: FormData) {
  const user = await requireUser("queue.manage");
  const patientId = String(form.get("patientId") ?? "");

  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!patient) redirectWith("/queue", "error", "Patient not found");

  const existing = await db.queueTicket.findFirst({
    where: { branchId: user.branch.id, patientId, queueDate: mytDate(), status: { in: ACTIVE } },
  });
  if (existing) redirectWith("/queue", "error", `Patient is already in today's queue as ${existing.displayNo}`);

  const ticket = await db.$transaction((tx) => issueTicket(tx, user, patientId, "WALK_IN"));
  revalidatePath("/queue");
  redirectWith("/queue", "ok", `Queue number ${ticket.displayNo} issued`);
}

const NEXT: Record<string, QueueStatus> = { call: "CALLED", start: "IN_SERVICE", done: "DONE", skip: "SKIPPED", requeue: "WAITING" };

export async function updateTicket(form: FormData) {
  const user = await requireUser("queue.manage");
  const id = String(form.get("ticketId") ?? "");
  const step = String(form.get("step") ?? "");
  const room = String(form.get("room") ?? "").trim() || null;
  const status = NEXT[step];
  if (!status) redirectWith("/queue", "error", "Unknown action");

  const ticket = await db.queueTicket.findFirst({ where: { id, branchId: user.branch.id } });
  if (!ticket) redirectWith("/queue", "error", "Ticket not found at this branch");

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.queueTicket.update({
      where: { id },
      data: {
        status,
        ...(status === "CALLED" ? { calledAt: now, room: room ?? ticket.room } : {}),
        ...(status === "DONE" ? { doneAt: now } : {}),
      },
    });
    if (status === "DONE" && ticket.appointmentId) {
      await tx.appointment.update({ where: { id: ticket.appointmentId }, data: { status: "COMPLETED" } });
    }
    await audit({ user, action: "UPDATE", entity: "QueueTicket", entityId: id, details: { from: ticket.status, to: status } }, tx);
  });
  revalidatePath("/queue");
  redirectWith("/queue", "ok", `${ticket.displayNo}: ${status.replace("_", " ").toLowerCase()}`);
}

/** Call the longest-waiting patient. */
export async function callNext(form: FormData) {
  const user = await requireUser("queue.manage");
  const room = String(form.get("room") ?? "").trim() || null;
  const next = await db.queueTicket.findFirst({
    where: { branchId: user.branch.id, queueDate: mytDate(), status: "WAITING" },
    orderBy: { number: "asc" },
  });
  if (!next) redirectWith("/queue", "error", "Nobody is waiting");

  await db.$transaction(async (tx) => {
    await tx.queueTicket.update({ where: { id: next.id }, data: { status: "CALLED", calledAt: new Date(), room } });
    await audit({ user, action: "UPDATE", entity: "QueueTicket", entityId: next.id, details: { from: "WAITING", to: "CALLED", room } }, tx);
  });
  revalidatePath("/queue");
  redirectWith("/queue", "ok", `Calling ${next.displayNo}${room ? ` to ${room}` : ""}`);
}
