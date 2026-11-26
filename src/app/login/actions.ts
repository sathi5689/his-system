"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { allowedBranches, setSessionCookie } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password." };

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && user.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) {
    await audit({ user: null, action: "LOGIN_FAILED", entity: "User", details: { email: parsed.data.email } });
    return { error: "Wrong email or password." };
  }

  const branches = await allowedBranches(user.id, user.role);
  if (branches.length === 0) return { error: "Your account has no branch assigned. Ask an Admin." };

  await setSessionCookie(user.id, branches[0].id);
  await audit({ user: { id: user.id, branch: branches[0] }, action: "LOGIN", entity: "User", entityId: user.id });
  redirect("/dashboard");
}
