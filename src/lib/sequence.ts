import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

/** Atomically increment and return the next value for a named counter. */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const row = await tx.sequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}

export const pad = (n: number, width: number) => String(n).padStart(width, "0");
