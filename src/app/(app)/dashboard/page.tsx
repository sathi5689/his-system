import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can, ROLE_LABEL } from "@/lib/rbac";
import { formatRM } from "@/lib/money";
import { fmtTime, mytDate, mytDayRange } from "@/lib/time";
import { Empty, Stat, StatusBadge } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  const today = mytDate();
  const { start, end } = mytDayRange(today);
  const branchId = user.branch.id;

  const [apptCount, waiting, newPatients, collected, unpaid, upcoming] = await Promise.all([
    db.appointment.count({ where: { branchId, startAt: { gte: start, lt: end }, status: { not: "CANCELLED" } } }),
    db.queueTicket.count({ where: { branchId, queueDate: today, status: "WAITING" } }),
    db.patient.count({ where: { registeredBranchId: branchId, createdAt: { gte: start, lt: end } } }),
    db.payment.aggregate({ where: { invoice: { branchId }, receivedAt: { gte: start, lt: end } }, _sum: { amountSen: true } }),
    db.invoice.count({ where: { branchId, status: { in: ["ISSUED", "PARTIALLY_PAID"] } } }),
    db.appointment.findMany({
      where: { branchId, startAt: { gte: new Date(), lt: end }, status: "BOOKED" },
      orderBy: { startAt: "asc" },
      take: 8,
      include: { patient: { select: { fullName: true, id: true } }, practitioner: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Good day, {user.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-slate-500">{ROLE_LABEL[user.role]} · {user.branch.name} · {today}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="📅 Appointments today" value={apptCount} href={can(user.role, "appointments.read") ? "/appointments" : undefined} />
        <Stat label="🎫 Waiting in queue" value={waiting} href={can(user.role, "queue.manage") ? "/queue" : undefined} />
        <Stat label="🧑 New patients today" value={newPatients} href={can(user.role, "patients.read") ? "/patients" : undefined} />
        {can(user.role, "billing.read") && (
          <>
            <Stat label="💰 Collected today" value={formatRM(collected._sum.amountSen ?? 0)} href="/billing" />
            <Stat label="🧾 Unpaid invoices" value={unpaid} href="/billing?status=ISSUED" />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Coming up today</h2>
          {upcoming.length === 0 ? <Empty>No more booked appointments today.</Empty> : (
            <table className="table">
              <tbody>
                {upcoming.map((a) => (
                  <tr key={a.id}>
                    <td className="w-20 font-medium">{fmtTime(a.startAt)}</td>
                    <td><Link className="hover:underline" href={`/patients/${a.patient.id}`}>{a.patient.fullName}</Link></td>
                    <td>{a.practitioner?.name ?? "-"}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Quick actions</h2>
          <div className="flex flex-col gap-2">
            {can(user.role, "patients.write") && <Link className="btn-primary" href="/patients/new">+ Register patient</Link>}
            {can(user.role, "appointments.write") && <Link className="btn-secondary" href="/appointments">📅 Book appointment</Link>}
            {can(user.role, "queue.manage") && <Link className="btn-secondary" href="/queue">🎫 Manage queue</Link>}
            {can(user.role, "billing.read") && <Link className="btn-secondary" href="/billing">💳 Billing</Link>}
          </div>
        </section>
      </div>
    </div>
  );
}
