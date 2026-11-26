import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { fmtTime, mytDate, mytDayRange } from "@/lib/time";
import { Empty, FlashFromParams, PageHeader, StatusBadge } from "@/components/ui";
import { bookAppointment, setAppointmentStatus } from "./actions";

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T12:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + delta);
  return mytDate(d);
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; patientId?: string; error?: string; ok?: string }>;
}) {
  const user = await requireUser("appointments.read");
  const sp = await searchParams;
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : mytDate();
  const { start, end } = mytDayRange(day);
  const canWrite = can(user.role, "appointments.write");

  const [appts, practitioners, preselected] = await Promise.all([
    db.appointment.findMany({
      where: { branchId: user.branch.id, startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" },
      include: { patient: { select: { id: true, fullName: true, mrn: true } }, practitioner: { select: { name: true } }, queueTicket: { select: { displayNo: true } } },
    }),
    db.user.findMany({
      where: { active: true, role: { in: ["DOCTOR", "THERAPIST"] }, branches: { some: { branchId: user.branch.id } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
    sp.patientId ? db.patient.findUnique({ where: { id: sp.patientId }, select: { id: true, fullName: true, mrn: true } }) : null,
  ]);

  const isToday = day === mytDate();

  return (
    <div className="space-y-6">
      <FlashFromParams params={sp} />
      <PageHeader title="Appointments" subtitle={user.branch.name} />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card overflow-x-auto p-0 xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 p-3">
            <Link className="btn-secondary px-2 py-1" href={`/appointments?date=${shiftDay(day, -1)}`}>◀</Link>
            <form className="flex items-center gap-2">
              <input className="input w-auto" type="date" name="date" defaultValue={day} />
              <button className="btn-secondary px-2 py-1">Go</button>
              {!isToday && <Link className="text-sm text-brand-700 hover:underline" href="/appointments">Today</Link>}
            </form>
            <Link className="btn-secondary px-2 py-1" href={`/appointments?date=${shiftDay(day, 1)}`}>▶</Link>
          </div>
          {appts.length === 0 ? (
            <div className="p-4"><Empty>No appointments on {day}.</Empty></div>
          ) : (
            <table className="table">
              <thead><tr><th>Time</th><th>Patient</th><th>With</th><th>Reason</th><th>Status</th>{canWrite && <th />}</tr></thead>
              <tbody>
                {appts.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap font-medium">{fmtTime(a.startAt)}<div className="text-xs text-slate-500">{a.durationMin} min</div></td>
                    <td><Link className="hover:underline" href={`/patients/${a.patient.id}`}>{a.patient.fullName}</Link><div className="text-xs text-slate-500">{a.patient.mrn}</div></td>
                    <td>{a.practitioner?.name ?? "-"}</td>
                    <td className="max-w-[12rem] truncate">{a.reason ?? "-"}</td>
                    <td><StatusBadge status={a.status} />{a.queueTicket && <div className="mt-1 font-mono text-xs">🎫 {a.queueTicket.displayNo}</div>}</td>
                    {canWrite && (
                      <td>
                        {a.status === "BOOKED" && (
                          <div className="flex flex-wrap gap-1">
                            {isToday && <StatusBtn id={a.id} status="CHECKED_IN" label="Check in" primary />}
                            <StatusBtn id={a.id} status="NO_SHOW" label="No-show" />
                            <StatusBtn id={a.id} status="CANCELLED" label="Cancel" />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {canWrite && (
          <section className="card h-fit">
            <h2 className="mb-3 font-semibold">📅 Book appointment</h2>
            <form action={bookAppointment} className="space-y-3">
              {preselected ? (
                <div className="rounded-md bg-brand-50 p-2 text-sm">
                  <input type="hidden" name="patientId" value={preselected.id} />
                  <b>{preselected.fullName}</b> · {preselected.mrn}
                </div>
              ) : (
                <div>
                  <label className="label">Patient MRN or ID number</label>
                  <input className="input" name="patientLookup" placeholder="P000001 or 900101145678" required />
                </div>
              )}
              <div>
                <label className="label">Doctor / therapist</label>
                <select className="input" name="practitionerId">
                  <option value="">Any available</option>
                  {practitioners.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.role.toLowerCase()})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date & time</label>
                  <input className="input" type="datetime-local" name="startAt" defaultValue={`${day}T09:00`} required />
                </div>
                <div>
                  <label className="label">Minutes</label>
                  <select className="input" name="durationMin" defaultValue="15">
                    {[10, 15, 20, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Reason</label>
                <input className="input" name="reason" placeholder="e.g. Follow-up, knee physio" />
              </div>
              <button className="btn-primary w-full">Book</button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function StatusBtn({ id, status, label, primary }: { id: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={setAppointmentStatus}>
      <input type="hidden" name="appointmentId" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={`${primary ? "btn-primary" : "btn-secondary"} px-2 py-1 text-xs`}>{label}</button>
    </form>
  );
}
