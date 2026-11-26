import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { can, type Permission } from "./rbac";
import { SESSION_COOKIE, SESSION_HOURS, signSession, verifySession } from "./session-token";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  branch: { id: string; code: string; name: string };
  branches: { id: string; code: string; name: string }[];
};

/** Branches a user may work in. Admins can use every active branch. */
export async function allowedBranches(userId: string, role: Role) {
  if (role === "ADMIN") {
    return db.branch.findMany({ where: { active: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  }
  const rows = await db.userBranch.findMany({
    where: { userId, branch: { active: true } },
    include: { branch: { select: { id: true, code: true, name: true } } },
    orderBy: { branch: { code: "asc" } },
  });
  return rows.map((r) => r.branch);
}

/** Current signed-in user, or null. Loaded fresh each request so deactivation takes effect at once. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.active) return null;

  const branches = await allowedBranches(user.id, user.role);
  const branch = branches.find((b) => b.id === session.branchId) ?? branches[0];
  if (!branch) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role, branch, branches };
});

export async function requireUser(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (permission && !can(user.role, permission)) redirect("/forbidden");
  return user;
}

export async function setSessionCookie(userId: string, branchId: string) {
  const token = await signSession({ sub: userId, branchId });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}
