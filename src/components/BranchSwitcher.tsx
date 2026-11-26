"use client";

import { switchBranch } from "@/app/(app)/actions";

export function BranchSwitcher({ current, branches }: { current: string; branches: { id: string; code: string; name: string }[] }) {
  return (
    <form action={switchBranch} className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">📍 Branch</span>
      <select
        name="branchId"
        defaultValue={current}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={branches.length < 2}
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.code} · {b.name}</option>
        ))}
      </select>
    </form>
  );
}
