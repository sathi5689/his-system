import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { formatMyKad } from "@/lib/mykad";
import { formatRM } from "@/lib/money";
import { fmtDateTime } from "@/lib/time";
import { FlashFromParams, StatusBadge } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { addItem, addPayment, issueInvoice, removeItem, setDiscount, voidInvoice } from "../actions";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser("billing.read");
  const { id } = await params;
  const flash = await searchParams;

  const inv = await db.invoice.findFirst({
    where: { id, branchId: user.branch.id },
    include: {
      branch: true,
      patient: true,
      items: { orderBy: { id: "asc" } },
      payments: { orderBy: { receivedAt: "asc" }, include: { receivedBy: { select: { name: true } } } },
    },
  });
  if (!inv) notFound();

  const services = inv.status === "DRAFT" ? await db.service.findMany({ where: { active: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }) : [];
  const canWrite = can(user.role, "billing.write");
  const isDraft = inv.status === "DRAFT";
  const balance = inv.totalSen - inv.paidSen;
  const takePayment = canWrite && (inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print"><FlashFromParams params={flash} /></div>
      <div className="no-print flex items-center justify-between">
        <Link href="/billing" className="text-sm text-slate-600 hover:underline">← Billing</Link>
        <PrintButton />
      </div>

      {/* Printable invoice */}
      <section className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="text-lg font-semibold">{inv.branch.name}</div>
            <div className="text-xs text-slate-500">{inv.branch.address}</div>
            <div className="text-xs text-slate-500">{inv.branch.phone}</div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold">{isDraft ? "DRAFT INVOICE" : "INVOICE"}</div>
            <div className="font-mono">{inv.invoiceNo ?? "-"}</div>
            <div className="text-xs text-slate-500">{fmtDateTime(inv.issuedAt ?? inv.createdAt)}</div>
            <div className="mt-1"><StatusBadge status={inv.status} /></div>
          </div>
        </div>
        <div className="py-4 text-sm">
          <div className="text-xs text-slate-500">Bill to</div>
          <div className="font-medium">{inv.patient.fullName}</div>
          <div className="text-xs">{inv.patient.mrn} · {inv.patient.idType === "MYKAD" ? formatMyKad(inv.patient.idNumber) : inv.patient.idNumber}</div>
        </div>

        <table className="table">
          <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit (RM)</th><th className="text-right">Amount (RM)</th>{isDraft && canWrite && <th className="no-print" />}</tr></thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td className="text-right">{it.qty}</td>
                <td className="text-right">{(it.unitPriceSen / 100).toFixed(2)}</td>
                <td className="text-right">{(it.amountSen / 100).toFixed(2)}</td>
                {isDraft && canWrite && (
                  <td className="no-print text-right">
                    <form action={removeItem}><input type="hidden" name="itemId" value={it.id} /><button className="text-xs text-red-600 hover:underline">Remove</button></form>
                  </td>
                )}
              </tr>
            ))}
            {inv.items.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-slate-400">No items yet</td></tr>}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-64 space-y-1 text-sm">
          <Row label="Subtotal" value={formatRM(inv.subtotalSen)} />
          {inv.discountSen > 0 && <Row label="Discount" value={`- ${formatRM(inv.discountSen)}`} />}
          <Row label="Total" value={formatRM(inv.totalSen)} bold />
          <Row label="Paid" value={formatRM(inv.paidSen)} />
          {inv.status !== "VOID" && <Row label="Balance" value={formatRM(balance)} bold />}
        </div>

        {inv.payments.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold">Payments</h3>
            <table className="table">
              <thead><tr><th>Receipt</th><th>When</th><th>Method</th><th>Reference</th><th>By</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {inv.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="font-mono text-xs">{p.receiptNo}</td>
                    <td>{fmtDateTime(p.receivedAt)}</td>
                    <td>{p.method}</td>
                    <td className="font-mono text-xs">{p.reference ?? "-"}</td>
                    <td>{p.receivedBy.name}</td>
                    <td className="text-right">{formatRM(p.amountSen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {inv.status === "VOID" && <p className="mt-4 text-sm text-red-700">Voided {fmtDateTime(inv.voidedAt)}: {inv.voidReason}</p>}
      </section>

      {/* Draft editing */}
      {isDraft && canWrite && (
        <section className="no-print card space-y-4">
          <h2 className="font-semibold">➕ Add item</h2>
          <form action={addItem} className="grid gap-3 md:grid-cols-6">
            <input type="hidden" name="invoiceId" value={inv.id} />
            <div className="md:col-span-4">
              <label className="label">Service from price list</label>
              <select className="input" name="serviceId" defaultValue="">
                <option value="">Custom item (type below)</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.category} · {s.name} · {formatRM(s.priceSen)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Qty</label>
              <input className="input" name="qty" type="number" min={1} max={999} defaultValue={1} />
            </div>
            <div className="flex items-end"><button className="btn-primary w-full">Add</button></div>
            <div className="md:col-span-4">
              <label className="label">Custom description</label>
              <input className="input" name="description" placeholder="Only if not in price list" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Custom unit price (RM)</label>
              <input className="input" name="price" placeholder="0.00" inputMode="decimal" />
            </div>
          </form>
          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-4">
            <form action={setDiscount} className="flex items-end gap-2">
              <input type="hidden" name="invoiceId" value={inv.id} />
              <div>
                <label className="label">Discount (RM)</label>
                <input className="input w-32" name="discount" defaultValue={(inv.discountSen / 100).toFixed(2)} inputMode="decimal" />
              </div>
              <button className="btn-secondary">Apply</button>
            </form>
            <form action={issueInvoice}>
              <input type="hidden" name="invoiceId" value={inv.id} />
              <button className="btn-primary" disabled={inv.totalSen <= 0}>✅ Issue invoice</button>
            </form>
          </div>
        </section>
      )}

      {takePayment && (
        <section className="no-print card">
          <h2 className="mb-3 font-semibold">💰 Take payment · balance {formatRM(balance)}</h2>
          <form action={addPayment} className="grid gap-3 md:grid-cols-4">
            <input type="hidden" name="invoiceId" value={inv.id} />
            <div>
              <label className="label">Method</label>
              <select className="input" name="method" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="CARD">Debit / credit card</option>
                <option value="FPX">FPX online banking</option>
                <option value="DUITNOW">DuitNow QR</option>
                <option value="EWALLET">E-wallet (TNG, GrabPay, Boost)</option>
              </select>
            </div>
            <div>
              <label className="label">Amount (RM)</label>
              <input className="input" name="amount" defaultValue={(balance / 100).toFixed(2)} inputMode="decimal" required />
            </div>
            <div>
              <label className="label">Reference</label>
              <input className="input" name="reference" placeholder="Approval code / txn ID" />
            </div>
            <div className="flex items-end"><button className="btn-primary w-full">Record payment</button></div>
          </form>
          <p className="mt-2 text-xs text-slate-500">Stage 1 records payments only. Card terminal and FPX / DuitNow gateway links come in a later stage.</p>
        </section>
      )}

      {can(user.role, "billing.void") && inv.status !== "VOID" && inv.paidSen === 0 && (
        <details className="no-print card">
          <summary className="cursor-pointer text-sm text-red-700">Void this invoice</summary>
          <form action={voidInvoice} className="mt-3 flex gap-2">
            <input type="hidden" name="invoiceId" value={inv.id} />
            <input className="input" name="reason" placeholder="Reason (required)" required />
            <button className="btn-danger">Void</button>
          </form>
        </details>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
