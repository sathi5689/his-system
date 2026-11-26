import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { normaliseMyKad, formatMyKad } from "@/lib/mykad";
import { ageYears, fmtDate } from "@/lib/time";
import { Empty, PageHeader } from "@/components/ui";

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser("patients.read");
  const { q = "" } = await searchParams;
  const term = q.trim();

  const where: Prisma.PatientWhereInput = term
    ? {
        OR: [
          { fullName: { contains: term, mode: "insensitive" } },
          { mrn: { equals: term.toUpperCase() } },
          { idNumber: { startsWith: normaliseMyKad(term).toUpperCase() } },
          { phone: { contains: term } },
        ],
      }
    : {};

  const patients = await db.patient.findMany({
    where,
    orderBy: term ? { fullName: "asc" } : { createdAt: "desc" },
    take: 50,
    include: { registeredBranch: { select: { code: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Patients"
        subtitle="Search across all branches"
        actions={can(user.role, "patients.write") && <Link href="/patients/new" className="btn-primary">+ Register patient</Link>}
      />
      <form className="mb-4 flex gap-2">
        <input className="input max-w-md" name="q" defaultValue={term} placeholder="Name, MRN, MyKad / passport or phone" autoFocus />
        <button className="btn-secondary">🔍 Search</button>
      </form>
      {patients.length === 0 ? (
        <Empty>{term ? `No patient matches "${term}".` : "No patients yet."}</Empty>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr><th>MRN</th><th>Name</th><th>ID</th><th>Age / Gender</th><th>Phone</th><th>Registered</th></tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="font-mono"><Link className="text-brand-700 hover:underline" href={`/patients/${p.id}`}>{p.mrn}</Link></td>
                  <td><Link className="font-medium hover:underline" href={`/patients/${p.id}`}>{p.fullName}</Link></td>
                  <td className="font-mono text-xs">{p.idType === "MYKAD" ? formatMyKad(p.idNumber) : `${p.idType} ${p.idNumber}`}</td>
                  <td>{ageYears(p.dob)} · {p.gender[0]}</td>
                  <td>{p.phone ?? "-"}</td>
                  <td className="text-xs text-slate-500">{p.registeredBranch.code} · {fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
