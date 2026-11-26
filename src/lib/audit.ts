import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { clientIp, type CurrentUser } from "./auth";

type AuditInput = {
  user: Pick<CurrentUser, "id" | "branch"> | null;
  action: "CREATE" | "UPDATE" | "VIEW" | "DELETE" | "LOGIN" | "LOGIN_FAILED" | "LOGOUT" | "SWITCH_BRANCH" | string;
  entity: string;
  entityId?: string | null;
  details?: Prisma.InputJsonValue;
};

type Tx = Prisma.TransactionClient;

/** Write one audit row. Pass `tx` to make the audit part of the same transaction as the change. */
export async function audit(input: AuditInput, tx?: Tx) {
  const client = tx ?? db;
  await client.auditLog.create({
    data: {
      userId: input.user?.id ?? null,
      branchId: input.user?.branch.id ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details,
      ip: await clientIp(),
    },
  });
}
