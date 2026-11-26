import Link from "next/link";
import type { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { formatRM } from "@/lib/money";
import { fmtDateTime, mytDate, mytDayRange } from "@/lib/time";
import { Empty, FlashFromParams, PageHeader, StatusBadge } from "@/components/ui";

const STATUSES: InvoiceStatus[] = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "VOID"];
const METHOD_LABEL: Record<PaymentMethod, string> = { CASH: "💵 Cash", CARD: "💳 Card", FPX: "🏦 FPX", DUITNOW: "📱 DuitNow", EWALLET: "👛 E-wallet" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string; error?: string; ok?: string }> }) {
  const user = await requireUser("billing.read");
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status as InvoiceStatus) ? (sp.status as InvoiceStatus) : undefined;
  const { start, end } = mytDayRange(mytDate());

  const [invoices, todayByMethod] = await Promise.all([
    db.invoice.findMany({
      where: { branchId: user.branch.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { patient: { select: { id: true, fullName: true, mrn: true } } },
    }),
    db.payment.groupBy({
      by: ["method"],
      where: { invoice: { branchId: user.branch.id }, receivedAt: { gte: start, lt: end } },
      _sum: { amountSen: true },
    }),
  ]);
  const todayTotal = todayByMethod.reduce((s, r) => s + (r._sum.amountSen ?? 0), 0);

  return (
    <div className="space-y-6">
      <FlashFromParams params={sp} />
      <PageHeader title="Billing" subtitle={`${user.branch.name} · start a new invoice from the patient's page`} actions={<Link href="/patients" className="btn-primary">+ New invoice (find patient)</Link>} />

      <section className="card">
        <h2 className="mb-3 font-semibold">Today&apos;s collections: {formatRM(todayTotal)}</h2>
        <div className="flex flex-wrap gap-3">
          {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => {
            const v = todayByMethod.find((r) => r.method === m)?._sum.amountSen ?? 0;
            return (
              <div key={m} className="min-w-[8rem] rounded-md bg-slate-50 px-3 py-2">
                <div className="text-xs text-slate-500">{METHOD_LABEL[m]}</div>
                <div className="font-semibold">{formatRM(v)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/billing" className={!status ? "font-semibold text-brand-700" : "text-slate-600"}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/billing?status=${s}`} className={status === s ? "font-semibold text-brand-700" : "text-slate-600"}>{s.replace("_", " ").toLowerCase()}</Link>
        ))}
      </div>

      {invoices.length === 0 ? <Empty>No invoices.</Empty> : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>Invoice</th><th>Patient</th><th>Created</th><th className="text-right">Total</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
            <tbody>
              {invoices.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td><Link className="font-mono text-brand-700 hover:underline" href={`/billing/${i.id}`}>{i.invoiceNo ?? "Draft"}</Link></td>
                  <td>{i.patient.fullName}<div className="text-xs text-slate-500">{i.patient.mrn}</div></td>
                  <td>{fmtDateTime(i.createdAt)}</td>
                  <td className="text-right">{formatRM(i.totalSen)}</td>
                  <td className="text-right">{i.status === "VOID" ? "-" : formatRM(i.totalSen - i.paidSen)}</td>
                  <td><StatusBadge status={i.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
