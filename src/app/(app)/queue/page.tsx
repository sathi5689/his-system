import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtTime, mytDate } from "@/lib/time";
import { Empty, FlashFromParams, PageHeader, StatusBadge } from "@/components/ui";
import { callNext, updateTicket } from "./actions";

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser("queue.manage");
  const flash = await searchParams;
  const tickets = await db.queueTicket.findMany({
    where: { branchId: user.branch.id, queueDate: mytDate() },
    orderBy: { number: "asc" },
    include: { patient: { select: { id: true, fullName: true, mrn: true } } },
  });

  const waiting = tickets.filter((t) => t.status === "WAITING");
  const active = tickets.filter((t) => t.status === "CALLED" || t.status === "IN_SERVICE");
  const finished = tickets.filter((t) => t.status === "DONE" || t.status === "SKIPPED");

  return (
    <div className="space-y-6">
      <FlashFromParams params={flash} />
      <PageHeader
        title="Today's queue"
        subtitle={`${user.branch.name} · ${mytDate()} · A = appointment, W = walk-in`}
        actions={
          <>
            <Link href="/queue/display" target="_blank" className="btn-secondary">📺 TV display</Link>
            <Link href="/patients" className="btn-secondary">+ Walk-in (find patient)</Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Count label="Waiting" n={waiting.length} color="text-amber-600" />
        <Count label="With staff" n={active.length} color="text-purple-600" />
        <Count label="Finished" n={finished.length} color="text-green-600" />
      </div>

      <form action={callNext} className="card flex flex-wrap items-end gap-3">
        <div>
          <label className="label">Room / counter</label>
          <input className="input w-48" name="room" placeholder="e.g. Room 2" />
        </div>
        <button className="btn-primary" disabled={waiting.length === 0}>📢 Call next</button>
      </form>

      <section className="card overflow-x-auto p-0">
        {tickets.length === 0 ? (
          <div className="p-4"><Empty>No queue numbers yet today.</Empty></div>
        ) : (
          <table className="table">
            <thead><tr><th>No.</th><th>Patient</th><th>Joined</th><th>Status</th><th>Room</th><th className="no-print">Actions</th></tr></thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono text-lg font-semibold">{t.displayNo}</td>
                  <td><Link className="hover:underline" href={`/patients/${t.patient.id}`}>{t.patient.fullName}</Link><div className="text-xs text-slate-500">{t.patient.mrn}</div></td>
                  <td>{fmtTime(t.createdAt)}</td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{t.room ?? "-"}</td>
                  <td className="no-print">
                    <div className="flex flex-wrap gap-1">
                      {t.status === "WAITING" && <Step id={t.id} step="call" label="Call" />}
                      {t.status === "CALLED" && <Step id={t.id} step="start" label="Start" />}
                      {(t.status === "CALLED" || t.status === "IN_SERVICE") && <Step id={t.id} step="done" label="Done" />}
                      {(t.status === "WAITING" || t.status === "CALLED") && <Step id={t.id} step="skip" label="Skip" />}
                      {t.status === "SKIPPED" && <Step id={t.id} step="requeue" label="Re-queue" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Count({ label, n, color }: { label: string; n: number; color: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold ${color}`}>{n}</div>
    </div>
  );
}

function Step({ id, step, label }: { id: string; step: string; label: string }) {
  return (
    <form action={updateTicket}>
      <input type="hidden" name="ticketId" value={id} />
      <input type="hidden" name="step" value={step} />
      <button className="btn-secondary px-2 py-1 text-xs">{label}</button>
    </form>
  );
}
