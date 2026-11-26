import "server-only";
import type { Prisma, QueueSource } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { audit } from "./audit";
import { nextSequence, pad } from "./sequence";
import { mytDate } from "./time";

/** Issue the next queue number for today at the user's branch. Numbers restart daily. */
export async function issueTicket(
  tx: Prisma.TransactionClient,
  user: CurrentUser,
  patientId: string,
  source: QueueSource,
  appointmentId?: string,
) {
  const queueDate = mytDate();
  const number = await nextSequence(tx, `queue:${user.branch.id}:${queueDate}`);
  const prefix = source === "APPOINTMENT" ? "A" : "W";
  const ticket = await tx.queueTicket.create({
    data: { branchId: user.branch.id, patientId, appointmentId, queueDate, number, displayNo: `${prefix}${pad(number, 3)}`, source },
  });
  await audit({ user, action: "CREATE", entity: "QueueTicket", entityId: ticket.id, details: { displayNo: ticket.displayNo, source } }, tx);
  return ticket;
}

