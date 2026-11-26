import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/time";
import { Badge, Empty, PageHeader } from "@/components/ui";

const ENTITY_LINK: Record<string, (id: string) => string> = {
  Patient: (id) => `/patients/${id}`,
  Consent: (id) => `/patients/${id}`,
  Invoice: (id) => `/billing/${id}`,
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string; action?: string; page?: string }> }) {
  await requireUser("audit.read");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {
    ...(sp.entity ? { entity: sp.entity } : {}),
    ...(sp.action ? { action: sp.action } : {}),
  };
  const take = 50;
  const [rows, entities] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { at: "desc" }, take: take + 1, skip: (page - 1) * take, include: { user: { select: { name: true, role: true } } } }),
    db.auditLog.findMany({ distinct: ["entity"], select: { entity: true } }),
  ]);
  const hasMore = rows.length > take;
  const qs = (p: number) => `/admin/audit?${new URLSearchParams({ ...(sp.entity ? { entity: sp.entity } : {}), ...(sp.action ? { action: sp.action } : {}), page: String(p) })}`;

  return (
    <div className="space-y-4">
      <PageHeader title="Audit log" subtitle="Who did what, when (PDPA). Entries cannot be edited." />
      <form className="flex flex-wrap gap-2">
        <select className="input w-auto" name="entity" defaultValue={sp.entity ?? ""}>
          <option value="">All records</option>
          {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
        </select>
        <select className="input w-auto" name="action" defaultValue={sp.action ?? ""}>
          <option value="">All actions</option>
          {["CREATE", "UPDATE", "VIEW", "LOGIN", "LOGIN_FAILED", "LOGOUT", "SWITCH_BRANCH"].map((a) => <option key={a}>{a}</option>)}
        </select>
        <button className="btn-secondary">Filter</button>
      </form>
      {rows.length === 0 ? <Empty>No entries.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Record</th><th>Details</th><th>IP</th></tr></thead>
            <tbody>
              {rows.slice(0, take).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(r.at)}</td>
                  <td>{r.user ? `${r.user.name} (${r.user.role.toLowerCase()})` : "-"}</td>
                  <td><Badge color={r.action === "LOGIN_FAILED" ? "red" : r.action === "VIEW" ? "slate" : "blue"}>{r.action}</Badge></td>
                  <td>
                    {r.entity}{" "}
                    {r.entityId && ENTITY_LINK[r.entity] ? <Link className="font-mono text-xs text-brand-700 hover:underline" href={ENTITY_LINK[r.entity](r.entityId)}>open</Link> : null}
                  </td>
                  <td className="max-w-xs truncate font-mono text-xs">{r.details ? JSON.stringify(r.details) : ""}</td>
                  <td className="text-xs">{r.ip ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2">
        {page > 1 && <Link className="btn-secondary" href={qs(page - 1)}>← Newer</Link>}
        {hasMore && <Link className="btn-secondary" href={qs(page + 1)}>Older →</Link>}
      </div>
    </div>
  );
}
