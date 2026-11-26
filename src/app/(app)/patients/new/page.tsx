import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PatientForm } from "../PatientForm";
import { createPatient } from "../actions";

export default async function NewPatientPage() {
  const user = await requireUser("patients.write");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Register patient" subtitle={`Registering at ${user.branch.name}`} />
      <PatientForm action={createPatient} mode="create" />
    </div>
  );
}
