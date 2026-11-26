import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "../../PatientForm";
import { updatePatient } from "../../actions";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("patients.write");
  const { id } = await params;
  const p = await db.patient.findUnique({ where: { id } });
  if (!p) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${p.fullName}`} subtitle={p.mrn} />
      <PatientForm
        action={updatePatient}
        mode="edit"
        defaults={{ ...p, dob: p.dob.toISOString().slice(0, 10) }}
      />
    </div>
  );
}
