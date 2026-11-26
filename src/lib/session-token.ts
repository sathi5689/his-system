// JWT session token. Edge-safe (used by middleware), so no Prisma or Node APIs here.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "his_session";
export const SESSION_HOURS = 12; // one clinic shift

export type SessionPayload = { sub: string; branchId: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short (min 16 chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ branchId: payload.branchId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string" || typeof payload.branchId !== "string") return null;
    return { sub: payload.sub, branchId: payload.branchId };
  } catch {
    return null;
  }
}
