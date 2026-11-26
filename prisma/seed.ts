/**
 * Demo data only. All names and ID numbers are made up. Never load real patient data here.
 * Runs once: skips when branches already exist (use `npm run db:reset` to start over).
 */
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DEMO_PASSWORD = "Demo@1234";
const myt = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+08:00`);
const todayMyt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());

async function main() {
  if ((await db.branch.count()) > 0) {
    console.log("Seed skipped: data already exists.");
    return;
  }

  // ASSUMPTION: 3 demo branches, one of each centre type. Replace with the real list.
  const [kl, pj, sa] = await Promise.all([
    db.branch.create({ data: { code: "KL1", name: "REGEN Specialist Clinic KL", type: "SPECIALIST_CLINIC", address: "Jalan Demo 1, 50450 Kuala Lumpur", phone: "03-0000 0001" } }),
    db.branch.create({ data: { code: "PJ1", name: "REGEN Ambulatory Care PJ", type: "AMBULATORY_CARE", address: "Jalan Demo 2, 46000 Petaling Jaya, Selangor", phone: "03-0000 0002" } }),
    db.branch.create({ data: { code: "SA1", name: "REGEN Physio Shah Alam", type: "PHYSIOTHERAPY", address: "Jalan Demo 3, 40000 Shah Alam, Selangor", phone: "03-0000 0003" } }),
  ]);

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const staff: { email: string; name: string; role: Role; branches: string[] }[] = [
    { email: "admin@regen.test", name: "Aina Admin", role: "ADMIN", branches: [] },
    { email: "reception@regen.test", name: "Rina Reception", role: "RECEPTION", branches: [kl.id, pj.id] },
    { email: "doctor@regen.test", name: "Dr. Daniel Lim", role: "DOCTOR", branches: [kl.id, pj.id] },
    { email: "doctor2@regen.test", name: "Dr. Priya Nair", role: "DOCTOR", branches: [kl.id] },
    { email: "nurse@regen.test", name: "Nurul Nurse", role: "NURSE", branches: [kl.id, pj.id] },
    { email: "cashier@regen.test", name: "Chong Cashier", role: "CASHIER", branches: [kl.id, pj.id, sa.id] },
    { email: "therapist@regen.test", name: "Tharun Therapist", role: "THERAPIST", branches: [sa.id] },
    { email: "pharmacist@regen.test", name: "Farah Pharmacist", role: "PHARMACIST", branches: [kl.id] },
    { email: "lab@regen.test", name: "Lee Lab", role: "LAB", branches: [kl.id] },
    { email: "store@regen.test", name: "Siti Store", role: "STORE", branches: [kl.id, pj.id, sa.id] },
  ];
  const users: Record<string, string> = {};
  for (const s of staff) {
    const u = await db.user.create({
      data: { email: s.email, name: s.name, role: s.role, passwordHash: hash, branches: { create: s.branches.map((branchId) => ({ branchId })) } },
    });
    users[s.email] = u.id;
  }

  // ASSUMPTION: sample prices only. Replace with the group's real fee schedule.
  const services = [
    ["CONS-GP", "Consultation", "General consultation", 5000],
    ["CONS-SP", "Consultation", "Specialist consultation", 15000],
    ["CONS-FU", "Consultation", "Specialist follow-up", 9000],
    ["PHY-INIT", "Physiotherapy", "Physio initial assessment", 12000],
    ["PHY-SESS", "Physiotherapy", "Physio session (45 min)", 9000],
    ["PHY-TENS", "Physiotherapy", "TENS / ultrasound add-on", 3000],
    ["PROC-DRS", "Procedure", "Wound dressing", 3500],
    ["PROC-ECG", "Procedure", "ECG", 6000],
    ["DC-BED", "Day care", "Day-care bed (per session)", 25000],
    ["ADM-MC", "Admin", "Medical report", 5000],
  ] as const;
  const svc: Record<string, { id: string; name: string; priceSen: number }> = {};
  for (const [code, category, name, priceSen] of services) {
    svc[code] = await db.service.create({ data: { code, category, name, priceSen } });
  }

  // Made-up patients. MyKad numbers are valid in format but fictional.
  const patients = [
    { fullName: "Ahmad bin Demo", idType: "MYKAD", idNumber: "850412145671", dob: "1985-04-12", gender: "MALE", phone: "012-000 0001" },
    { fullName: "Siti Nurhaliza binti Contoh", idType: "MYKAD", idNumber: "920830105522", dob: "1992-08-30", gender: "FEMALE", phone: "013-000 0002" },
    { fullName: "Tan Mei Ling", idType: "MYKAD", idNumber: "780105075008", dob: "1978-01-05", gender: "FEMALE", phone: "016-000 0003" },
    { fullName: "Rajesh a/l Sample", idType: "MYKAD", idNumber: "010220081237", dob: "2001-02-20", gender: "MALE", phone: "017-000 0004" },
    { fullName: "John Example", idType: "PASSPORT", idNumber: "X1234567", dob: "1990-06-15", gender: "MALE", phone: "+44 7000 000005", nationality: "British" },
    { fullName: "Nur Aisyah binti Test", idType: "MYKAD", idNumber: "150711100124", dob: "2015-07-11", gender: "FEMALE", phone: "019-000 0006" },
  ] as const;

  const pIds: string[] = [];
  let mrn = 0;
  for (const p of patients) {
    mrn++;
    const created = await db.patient.create({
      data: {
        ...p,
        nationality: "nationality" in p ? p.nationality : "Malaysian",
        dob: new Date(p.dob),
        mrn: `P${String(mrn).padStart(6, "0")}`,
        registeredBranchId: mrn === 4 ? sa.id : kl.id,
        consents: {
          create: [
            { type: "PDPA_DATA_PROCESSING", version: "PDPA-2026-01", granted: true, method: "WRITTEN", recordedById: users["reception@regen.test"] },
            { type: "MARKETING", version: "PDPA-2026-01", granted: mrn % 2 === 0, method: "WRITTEN", recordedById: users["reception@regen.test"] },
          ],
        },
      },
    });
    pIds.push(created.id);
  }
  await db.sequence.create({ data: { key: "mrn", value: mrn } });

  // Today's appointments at KL1 plus two walk-ins in the queue.
  const doc = users["doctor@regen.test"];
  const doc2 = users["doctor2@regen.test"];
  const appts = [
    { patientId: pIds[0], practitionerId: doc, startAt: myt(todayMyt, "09:00"), reason: "Follow-up hypertension" },
    { patientId: pIds[1], practitionerId: doc2, startAt: myt(todayMyt, "10:30"), reason: "Specialist review" },
    { patientId: pIds[2], practitionerId: doc, startAt: myt(todayMyt, "15:00"), reason: "Knee pain" },
    { patientId: pIds[4], practitionerId: doc2, startAt: myt(todayMyt, "16:30"), reason: "Travel health check" },
  ];
  for (const a of appts) await db.appointment.create({ data: { ...a, branchId: kl.id } });
  await db.appointment.create({
    data: { branchId: sa.id, patientId: pIds[3], practitionerId: users["therapist@regen.test"], startAt: myt(todayMyt, "11:00"), durationMin: 45, reason: "Lower back physio" },
  });

  const qKey = `queue:${kl.id}:${todayMyt}`;
  await db.queueTicket.create({ data: { branchId: kl.id, patientId: pIds[5], queueDate: todayMyt, number: 1, displayNo: "W001", source: "WALK_IN" } });
  await db.queueTicket.create({ data: { branchId: kl.id, patientId: pIds[3], queueDate: todayMyt, number: 2, displayNo: "W002", source: "WALK_IN" } });
  await db.sequence.create({ data: { key: qKey, value: 2 } });

  // One paid invoice and one draft at KL1.
  const yyyymm = todayMyt.slice(0, 7).replace("-", "");
  const paid = await db.invoice.create({
    data: {
      branchId: kl.id, patientId: pIds[0], createdById: users["cashier@regen.test"], status: "PAID",
      invoiceNo: `KL1-${yyyymm}-00001`, issuedAt: new Date(),
      subtotalSen: svc["CONS-SP"].priceSen + svc["PROC-ECG"].priceSen, totalSen: svc["CONS-SP"].priceSen + svc["PROC-ECG"].priceSen,
      paidSen: svc["CONS-SP"].priceSen + svc["PROC-ECG"].priceSen,
      items: {
        create: [
          { serviceId: svc["CONS-SP"].id, description: svc["CONS-SP"].name, qty: 1, unitPriceSen: svc["CONS-SP"].priceSen, amountSen: svc["CONS-SP"].priceSen },
          { serviceId: svc["PROC-ECG"].id, description: svc["PROC-ECG"].name, qty: 1, unitPriceSen: svc["PROC-ECG"].priceSen, amountSen: svc["PROC-ECG"].priceSen },
        ],
      },
    },
  });
  await db.payment.create({
    data: { invoiceId: paid.id, method: "DUITNOW", amountSen: paid.totalSen, reference: "DEMO-DN-0001", receivedById: users["cashier@regen.test"], receiptNo: `R-KL1-${yyyymm}-00001` },
  });
  await db.sequence.createMany({ data: [{ key: `inv:${kl.id}:${yyyymm}`, value: 1 }, { key: `rcpt:${kl.id}:${yyyymm}`, value: 1 }] });
  await db.invoice.create({ data: { branchId: kl.id, patientId: pIds[2], createdById: users["cashier@regen.test"] } });

  console.log(`Seeded demo data. Log in with any *@regen.test account, password ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
