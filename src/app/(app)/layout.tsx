import { requireUser } from "@/lib/auth";
import { can, ROLE_LABEL, type Permission } from "@/lib/rbac";
import { NavLink } from "@/components/NavLink";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { logout } from "./actions";

const NAV: { href: string; label: string; icon: string; perm?: Permission }[] = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/patients", label: "Patients", icon: "🧑", perm: "patients.read" },
  { href: "/appointments", label: "Appointments", icon: "📅", perm: "appointments.read" },
  { href: "/queue", label: "Queue", icon: "🎫", perm: "queue.manage" },
  { href: "/billing", label: "Billing", icon: "💳", perm: "billing.read" },
  { href: "/admin/audit", label: "Audit log", icon: "🛡️", perm: "audit.read" },
  { href: "/admin/users", label: "Users & branches", icon: "⚙️", perm: "admin.manage" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">R</div>
          <span className="font-semibold">REGEN HIS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((n) => (
            <NavLink key={n.href} href={n.href}>
              <span aria-hidden>{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-sm">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</div>
          <form action={logout} className="mt-2">
            <button className="text-xs text-red-600 hover:underline">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <nav className="flex gap-3 overflow-x-auto text-sm md:hidden">
            {NAV.filter((n) => !n.perm || can(user.role, n.perm)).map((n) => (
              <a key={n.href} href={n.href} className="whitespace-nowrap text-slate-600">{n.label}</a>
            ))}
          </nav>
          <div className="ml-auto">
            <BranchSwitcher current={user.branch.id} branches={user.branches} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
