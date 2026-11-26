"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, getCurrentUser, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function logout() {
  const user = await getCurrentUser();
  if (user) await audit({ user, action: "LOGOUT", entity: "User", entityId: user.id });
  await clearSessionCookie();
  redirect("/login");
}

export async function switchBranch(form: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const branchId = String(form.get("branchId") ?? "");
  const target = user.branches.find((b) => b.id === branchId);
  if (!target) redirect("/dashboard");
  await setSessionCookie(user.id, target.id);
  await audit({ user: { ...user, branch: target }, action: "SWITCH_BRANCH", entity: "Branch", entityId: target.id });
  redirect("/dashboard");
}
