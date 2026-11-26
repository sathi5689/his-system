import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">R</div>
          <h1 className="text-2xl font-semibold">REGEN HIS</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        {process.env.NODE_ENV !== "production" || process.env.SHOW_DEMO_LOGINS === "true" ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <b>Demo logins</b> (password <code>Demo@1234</code>): admin@regen.test, reception@regen.test, doctor@regen.test,
            nurse@regen.test, cashier@regen.test, therapist@regen.test
          </div>
        ) : null}
      </div>
    </main>
  );
}
