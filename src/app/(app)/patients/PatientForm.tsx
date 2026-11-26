"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { parseMyKad, formatMyKad } from "@/lib/mykad";
import { PDPA_NOTICE_SUMMARY, PDPA_NOTICE_VERSION } from "@/lib/pdpa";
import type { PatientFormState } from "./actions";

type Defaults = {
  id?: string;
  fullName?: string;
  idType?: "MYKAD" | "PASSPORT" | "OTHER";
  idNumber?: string;
  dob?: string;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  nationality?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
};

export function PatientForm({
  action,
  defaults = {},
  mode,
}: {
  action: (prev: PatientFormState, form: FormData) => Promise<PatientFormState>;
  defaults?: Defaults;
  mode: "create" | "edit";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [idType, setIdType] = useState(defaults.idType ?? "MYKAD");
  const [idNumber, setIdNumber] = useState(
    defaults.idType === "MYKAD" && defaults.idNumber ? formatMyKad(defaults.idNumber) : (defaults.idNumber ?? ""),
  );
  const [dob, setDob] = useState(defaults.dob ?? "");
  const [gender, setGender] = useState(defaults.gender ?? "UNKNOWN");
  const [nationality, setNationality] = useState(defaults.nationality ?? "Malaysian");

  const mykad = idType === "MYKAD" && idNumber.replace(/\D/g, "").length === 12 ? parseMyKad(idNumber) : null;
  const locked = idType === "MYKAD" && mykad?.ok === true;

  function onIdChange(v: string) {
    setIdNumber(v);
    if (idType !== "MYKAD") return;
    const r = parseMyKad(v);
    if (r.ok) {
      setDob(r.dob);
      setGender(r.gender);
      setNationality("Malaysian");
    }
  }

  const err = (k: string) => state.fieldErrors?.[k] && <p className="mt-1 text-xs text-red-600">{state.fieldErrors[k]}</p>;

  return (
    <form action={formAction} className="space-y-6">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}{" "}
          {state.existingId && <Link className="font-medium underline" href={`/patients/${state.existingId}`}>Open existing record</Link>}
        </div>
      )}

      <section className="card space-y-4">
        <h2 className="font-semibold">🪪 Identity</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">ID type</label>
            <select className="input" name="idType" value={idType} onChange={(e) => setIdType(e.target.value as typeof idType)}>
              <option value="MYKAD">MyKad</option>
              <option value="PASSPORT">Passport</option>
              <option value="OTHER">Other (MyKid, MyPR, police/army ID)</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">ID number</label>
            <input
              className="input font-mono"
              name="idNumber"
              value={idNumber}
              onChange={(e) => onIdChange(e.target.value)}
              placeholder={idType === "MYKAD" ? "900101-14-5678" : ""}
              required
            />
            {mykad && !mykad.ok && <p className="mt-1 text-xs text-red-600">{mykad.error}</p>}
            {mykad?.ok && (
              <p className="mt-1 text-xs text-green-700">
                ✓ Valid MyKad · born {mykad.dob} in {mykad.birthPlace} · {mykad.gender.toLowerCase()} (auto-filled)
              </p>
            )}
            {err("idNumber")}
          </div>
        </div>
        <div>
          <label className="label">Full name (as in ID)</label>
          <input className="input" name="fullName" defaultValue={defaults.fullName} required />
          {err("fullName")}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Date of birth</label>
            <input className="input" type="date" name="dob" value={dob} onChange={(e) => setDob(e.target.value)} readOnly={locked} required />
            {err("dob")}
          </div>
          <div>
            <label className="label">Gender</label>
            {locked && <input type="hidden" name="gender" value={gender} />}
            <select className="input" name={locked ? undefined : "gender"} value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} disabled={locked}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="UNKNOWN">Not stated</option>
            </select>
          </div>
          <div>
            <label className="label">Nationality</label>
            <input className="input" name="nationality" value={nationality} onChange={(e) => setNationality(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">📞 Contact</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Mobile phone</label>
            <input className="input" name="phone" defaultValue={defaults.phone ?? ""} placeholder="012-345 6789" />
            {err("phone")}
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" name="email" type="email" defaultValue={defaults.email ?? ""} />
            {err("email")}
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <textarea className="input" name="address" rows={2} defaultValue={defaults.address ?? ""} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Emergency contact name</label>
            <input className="input" name="emergencyName" defaultValue={defaults.emergencyName ?? ""} />
          </div>
          <div>
            <label className="label">Emergency contact phone</label>
            <input className="input" name="emergencyPhone" defaultValue={defaults.emergencyPhone ?? ""} />
          </div>
        </div>
      </section>

      {mode === "create" && (
        <section className="card space-y-3 border-brand-500">
          <h2 className="font-semibold">🔒 PDPA consent <span className="text-xs font-normal text-slate-500">({PDPA_NOTICE_VERSION})</span></h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {PDPA_NOTICE_SUMMARY.map((l) => <li key={l}>{l}</li>)}
          </ul>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="pdpaConsent" className="mt-1" required />
            <span><b>Required:</b> Patient has read the notice and agrees to processing of their personal data.</span>
          </label>
          {err("pdpaConsent")}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="marketingConsent" className="mt-1" />
            <span>Optional: Patient agrees to receive health reminders and promotions.</span>
          </label>
          <div className="max-w-xs">
            <label className="label">How consent was given</label>
            <select className="input" name="consentMethod" defaultValue="WRITTEN">
              <option value="WRITTEN">Signed form</option>
              <option value="VERBAL">Verbal</option>
              <option value="ELECTRONIC">Electronic (tablet / online)</option>
            </select>
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : mode === "create" ? "Register patient" : "Save changes"}</button>
        <Link href={defaults.id ? `/patients/${defaults.id}` : "/patients"} className="btn-secondary">Cancel</Link>
      </div>
    </form>
  );
}
