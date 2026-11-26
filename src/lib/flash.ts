import { redirect } from "next/navigation";

/** Redirect back with a message shown by <FlashFromParams>. */
export function redirectWith(path: string, kind: "error" | "ok", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}
