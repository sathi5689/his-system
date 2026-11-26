import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { formatMyKad } from "@/lib/mykad";
import { formatRM } from "@/lib/money";
import { ageYears, fmtDate, fmtDateTime } from "@/lib/time";
import { Badge, Empty, FlashFromParams, PageHeader, StatusBadge } from "@/components/ui";
import { setConsent } from "../actions";
import { addWalkIn } from "../../queue/actions";
import { createInvoice } from "../../billing/actions";

export default async function PatientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser("patients.read");
  const { id } = await params;
  const flash = await searchParams;

  const p = await db.patient.findUnique({
    where: { id },
    include: {
      registeredBranch: true,
      consents: { orderBy: { recordedAt: "desc" }, include: { recordedBy: { select: { name: true } } } },
      appointments: { orderBy: { startAt: "desc" }, take: 10, include: { branch: { select: { code: true } }, practitioner: { select: { name: true } } } },
      invoices: { orderBy: { createdAt: "desc" }, take: 10, include: { branch: { select: { code: true } } } },
    },
  });
  if (!p) notFound();

  // PDPA: record every view of a patient record.
  await audit({ user, action: "VIEW", entity: "Patient", entityId: p.id });

  const current = (type: "PDPA_DATA_PROCESSING" | "MARKETING") => p.consents.find((c) => c.type === type && !c.withdrawnAt);
  const pdpa = current("PDPA_DATA_PROCESSING");
  const marketing = current("MARKETING");
  const canWrite = can(user.role, "patients.write");

  return (
    <div className="space-y-6">
      <FlashFromParams params={flash} />
      <PageHeader
        title={p.fullName}
        subtitle={`${p.mrn} · ${ageYears(p.dob)} yrs · ${p.gender.toLowerCase()}`}
        actions={
          <>
            {can(user.role, "queue.manage") && (
              <form action={addWalkIn}>
                <input type="hidden" name="patientId" value={p.id} />
                <button className="btn-primary">🎫 Walk-in queue</button>
              </form>
            )}
            {can(user.role, "appointments.write") && <Link href={`/appointments?patientId=${p.id}`} className="btn-secondary">📅 Book</Link>}
            {can(user.role, "billing.write") && (
              <form action={createInvoice}>
                <input type="hidden" name="patientId" value={p.id} />
                <button className="btn-secondary">💳 New invoice</button>
              </form>
            )}
            {canWrite && <Link href={`/patients/${p.id}/edit`} className="btn-secondary">✏️ Edit</Link>}
          </>
        }
      />

      {!pdpa?.granted && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">⚠️ No active PDPA consent. Record consent before processing this patient&apos;s data.</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            <Field label="ID">{p.idType === "MYKAD" ? `MyKad ${formatMyKad(p.idNumber)}` : `${p.idType} ${p.idNumber}`}</Field>
            <Field label="Date of birth">{fmtDate(p.dob)}</Field>
            <Field label="Nationality">{p.nationality}</Field>
            <Field label="Phone">{p.phone ?? "-"}</Field>
            <Field label="Email">{p.email ?? "-"}</Field>
            <Field label="Registered at">{p.registeredBranch.name}</Field>
            <Field label="Address">{p.address ?? "-"}</Field>
            <Field label="Emergency contact">{p.emergencyName ? `${p.emergencyName} (${p.emergencyPhone ?? "-"})` : "-"}</Field>
          </dl>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">🔒 Consent</h2>
          <ConsentRow label="PDPA data processing" active={pdpa?.granted} />
          <ConsentRow label="Marketing / reminders" active={marketing?.granted} />
          {canWrite && (
            <div className="mt-3 flex flex-wrap gap-2">
              <ConsentButton patientId={p.id} type="PDPA_DATA_PROCESSING" granted={!pdpa?.granted} label={pdpa?.granted ? "Withdraw PDPA" : "Record PDPA consent"} />
              <ConsentButton patientId={p.id} type="MARKETING" granted={!marketing?.granted} label={marketing?.granted ? "Withdraw marketing" : "Opt in marketing"} />
            </div>
          )}
          <details className="mt-3 text-xs text-slate-500">
            <summary className="cursor-pointer">History ({p.consents.length})</summary>
            <ul className="mt-2 space-y-1">
              {p.consents.map((c) => (
                <li key={c.id}>
                  {fmtDateTime(c.recordedAt)} · {c.type === "MARKETING" ? "Marketing" : "PDPA"} · {c.granted ? "granted" : "declined/withdrawn"} · {c.method.toLowerCase()} · {c.recordedBy.name}
                </li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">📅 Appointments</h2>
          {p.appointments.length === 0 ? <Empty>None yet</Empty> : (
            <table className="table">
              <tbody>
                {p.appointments.map((a) => (
                  <tr key={a.id}>
                    <td>{fmtDateTime(a.startAt)}</td>
                    <td>{a.branch.code}</td>
                    <td>{a.practitioner?.name ?? "-"}</td>
                    <td><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">💳 Invoices</h2>
          {p.invoices.length === 0 ? <Empty>None yet</Empty> : (
            <table className="table">
              <tbody>
                {p.invoices.map((i) => (
                  <tr key={i.id}>
                    <td><Link className="font-mono text-brand-700 hover:underline" href={`/billing/${i.id}`}>{i.invoiceNo ?? "Draft"}</Link></td>
                    <td>{fmtDate(i.createdAt)}</td>
                    <td className="text-right">{formatRM(i.totalSen)}</td>
                    <td><StatusBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ConsentRow({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span>{label}</span>
      {active ? <Badge color="green">✓ Given</Badge> : <Badge color="red">Not given</Badge>}
    </div>
  );
}

function ConsentButton({ patientId, type, granted, label }: { patientId: string; type: string; granted: boolean; label: string }) {
  return (
    <form action={setConsent}>
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="granted" value={String(granted)} />
      <input type="hidden" name="method" value="WRITTEN" />
      <button className="btn-secondary text-xs">{label}</button>
    </form>
  );
}
