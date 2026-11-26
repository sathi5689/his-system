import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { mytDate } from "@/lib/time";
import { AutoRefresh } from "@/components/AutoRefresh";

// Big-screen view for the waiting area. Shows queue numbers only (no names) for privacy.
export default async function QueueDisplay() {
  const user = await requireUser("queue.manage");
  const tickets = await db.queueTicket.findMany({
    where: { branchId: user.branch.id, queueDate: mytDate(), status: { in: ["CALLED", "IN_SERVICE", "WAITING"] } },
    orderBy: [{ calledAt: "desc" }, { number: "asc" }],
  });
  const calling = tickets.filter((t) => t.status === "CALLED");
  const waiting = tickets.filter((t) => t.status === "WAITING").sort((a, b) => a.number - b.number);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 p-8 text-white">
      <AutoRefresh seconds={5} />
      <h1 className="text-3xl font-semibold">{user.branch.name}</h1>
      <div className="mt-8 grid flex-1 grid-cols-3 gap-8">
        <div className="col-span-2">
          <h2 className="text-xl uppercase tracking-widest text-emerald-400">Now calling</h2>
          <div className="mt-4 grid grid-cols-2 gap-4">
            {calling.slice(0, 6).map((t) => (
              <div key={t.id} className="rounded-2xl bg-emerald-600 p-6 text-center">
                <div className="font-mono text-7xl font-bold">{t.displayNo}</div>
                <div className="mt-2 text-2xl">{t.room ?? "Please proceed"}</div>
              </div>
            ))}
            {calling.length === 0 && <div className="text-2xl text-slate-400">Please wait for your number</div>}
          </div>
        </div>
        <div>
          <h2 className="text-xl uppercase tracking-widest text-amber-400">Next</h2>
          <ul className="mt-4 space-y-2 font-mono text-4xl">
            {waiting.slice(0, 10).map((t) => <li key={t.id}>{t.displayNo}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}
