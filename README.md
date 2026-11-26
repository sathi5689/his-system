# REGEN HIS — Hospital Information System

Cloud HIS for a multi-branch Malaysian healthcare group (specialist clinic · ambulatory care · physiotherapy).

**Status: Stage 1** — foundation + front desk + billing. Demo data only.

---

## ✅ What Stage 1 does

| Module | Features |
|---|---|
| 🔐 Foundation | Email + password login · 9 roles · multi-branch with branch switcher · audit log of every change, view and login |
| 🧑 Patients | Register / edit · search (name, MRN, MyKad, phone) · **MyKad check auto-fills DOB + gender** · duplicate ID blocked · PDPA consent (required) + marketing opt-in, with history |
| 📅 Appointments | Book by MRN / IC · doctor / therapist double-booking check · check-in · cancel · no-show |
| 🎫 Queue | Walk-in numbers (W001) and appointment numbers (A001) · restart daily per branch · call next · TV display screen |
| 💳 Billing | Draft → issue invoice · price list or custom items · discount · RM · Cash / Card / FPX / DuitNow / e-wallet (records only) · part payments · receipts · print · void (Admin) |
| 🏠 Dashboard | Today's appointments, queue, new patients, collections, unpaid invoices |

### Patient flow

```
Register (MyKad + PDPA) ──► Book appointment ──► Check in ──► Queue A001 ──► Call ──► Done
        │                                                                          │
        └──► Walk-in ──► Queue W001 ────────────────────────────────────────────────┤
                                                                                   ▼
                                                    Invoice (draft ► issue) ──► Payment ──► Receipt
```

### Who can do what

| Role | Patients | Appointments | Queue | Billing | Audit / Admin |
|---|---|---|---|---|---|
| Admin | ✏️ | ✏️ | ✏️ | ✏️ + void | ✅ |
| Reception | ✏️ | ✏️ | ✏️ | 👁️ | – |
| Nurse | ✏️ | ✏️ | ✏️ | – | – |
| Doctor | 👁️ | 👁️ | ✏️ | – | – |
| Therapist | 👁️ | ✏️ | ✏️ | – | – |
| Cashier | 👁️ | 👁️ | – | ✏️ | – |
| Pharmacist / Lab | 👁️ | – | – | – | – |
| Store | – | – | – | – | – |

✏️ = view + change · 👁️ = view only · Rules live in `src/lib/rbac.ts`.

---

## 🪟 Run it on Windows (Docker Desktop)

**One-time setup**
1. Install **Docker Desktop** → https://www.docker.com/products/docker-desktop/ (keep "Use WSL 2" ticked, restart PC if asked)
2. Install **Git for Windows** → https://git-scm.com/download/win
3. Open Docker Desktop and wait until it says **Engine running**

**Start the app** (PowerShell)
```powershell
git clone https://github.com/sathi5689/his-system.git
cd his-system
git checkout claude/project-thread-5q5lt3   # until the pull request is merged
docker compose up --build
```
4. Wait for `Starting REGEN HIS on port 3000` (first build ≈ 3–5 min)
5. Open **http://localhost:3000**

**Demo logins** — password `Demo@1234` for all

| Email | Role |
|---|---|
| admin@regen.test | Admin (all branches) |
| reception@regen.test | Reception |
| doctor@regen.test | Doctor |
| nurse@regen.test | Nurse |
| cashier@regen.test | Cashier |
| therapist@regen.test | Therapist (physio branch) |

**Everyday commands**

| To… | Run |
|---|---|
| Stop | `Ctrl + C`, then `docker compose down` |
| Start again (keeps data) | `docker compose up` |
| Get code changes | `git pull` then `docker compose up --build` |
| Wipe all data and re-seed | `docker compose down -v` then `docker compose up --build` |

---

## 🛠️ Developer mode (hot reload)

Needs **Node.js 22** (https://nodejs.org).

```powershell
docker compose up -d db          # database only
Copy-Item .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                      # http://localhost:3000
```

| Command | Does |
|---|---|
| `npm test` | Unit tests (MyKad, money, Malaysia time) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |
| `npx prisma migrate dev --name <change>` | Create a DB migration after editing `prisma/schema.prisma` |
| `npx prisma studio` | Browse the database |

---

## 🧱 Tech

- Next.js 15 (App Router, server actions) · React 19 · TypeScript
- PostgreSQL 16 + Prisma 6
- Tailwind CSS 3
- Docker / Docker Compose
- Money stored as **sen** (integers) · times stored UTC, shown **Asia/Kuala_Lumpur**

```
src/
  app/login                  sign in
  app/(app)/dashboard        home
  app/(app)/patients         register, search, record, consent
  app/(app)/appointments     booking + check-in
  app/(app)/queue            queue board + /queue/display (TV)
  app/(app)/billing          invoices + payments
  app/(app)/admin            audit log, users & branches
  lib/                       auth, rbac, audit, mykad, money, time
prisma/schema.prisma         data model
prisma/seed.ts               demo data (fake people only)
```

---

## ⚠️ Assumptions (to confirm)

Open questions from the project plan are not answered yet, so Stage 1 uses these defaults:

| # | Assumption | Change later in |
|---|---|---|
| 1 | 3 demo branches (KL specialist, PJ ambulatory, Shah Alam physio) | seed / admin screen |
| 2 | Patient record is shared across all branches | `patients` queries |
| 3 | PDPA notice text is a placeholder — needs legal / DPO wording (EN + BM) | `src/lib/pdpa.ts` |
| 4 | Sample price list | seed / price list screen (next stage) |
| 5 | No SST on medical services | `src/lib/money.ts` |
| 6 | Payments are records only; no card terminal or FPX / DuitNow gateway yet | later stage |
| 7 | Paid invoices cannot be voided (refunds come later) | billing |
| 8 | Login session lasts 12 hours (one shift) | `src/lib/session-token.ts` |
| 9 | Invoice no. `KL1-YYYYMM-00001`, receipt `R-KL1-YYYYMM-00001`, MRN `P000001` | `billing/actions.ts` |
| 10 | Panel / TPA billing not in Stage 1 | later stage |

## 🔜 Not yet in Stage 1
- Admin screens to add users, branches and prices (use seed for now)
- Password reset, 2FA, login lockout
- EMR / consultation, pharmacy, lab, inventory, panel billing, reports
- Production hosting (Malaysia region, HTTPS, backups)

## 🔒 Before real patient data
- Set a long random `AUTH_SECRET`, real DB password, remove `SEED_DEMO_DATA`, `SHOW_DEMO_LOGINS`, `INSECURE_COOKIES`
- Serve over HTTPS only · daily encrypted backups · PDPA wording signed off
