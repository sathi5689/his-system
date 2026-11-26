import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/rbac";
import { Badge, PageHeader } from "@/components/ui";

const TYPE_LABEL = { SPECIALIST_CLINIC: "Specialist clinic", AMBULATORY_CARE: "Ambulatory care", PHYSIOTHERAPY: "Physiotherapy" } as const;

export default async function UsersPage() {
  await requireUser("admin.manage");
  const [branches, users] = await Promise.all([
    db.branch.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { users: true } } } }),
    db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }], include: { branches: { include: { branch: { select: { code: true } } } } } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Users & branches" subtitle="Read-only in Stage 1. Add / edit screens come next; use the seed script for now." />
      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Code</th><th>Branch</th><th>Type</th><th>Staff</th><th>Status</th></tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td className="font-mono">{b.code}</td>
                <td>{b.name}<div className="text-xs text-slate-500">{b.address}</div></td>
                <td>{TYPE_LABEL[b.type]}</td>
                <td>{b._count.users}</td>
                <td>{b.active ? <Badge color="green">Active</Badge> : <Badge>Inactive</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branches</th><th>Status</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><Badge color="blue">{ROLE_LABEL[u.role]}</Badge></td>
                <td>{u.role === "ADMIN" ? "All" : u.branches.map((b) => b.branch.code).join(", ")}</td>
                <td>{u.active ? <Badge color="green">Active</Badge> : <Badge>Disabled</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
