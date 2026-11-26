import Link from "next/link";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE_COLORS: Record<string, string> = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  slate: "bg-slate-100 text-slate-700",
  purple: "bg-purple-100 text-purple-800",
};

export function Badge({ color = "slate", children }: { color?: keyof typeof BADGE_COLORS; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[color]}`}>{children}</span>;
}

const STATUS_COLOR: Record<string, keyof typeof BADGE_COLORS> = {
  BOOKED: "blue",
  CHECKED_IN: "purple",
  COMPLETED: "green",
  CANCELLED: "slate",
  NO_SHOW: "red",
  WAITING: "amber",
  CALLED: "blue",
  IN_SERVICE: "purple",
  DONE: "green",
  SKIPPED: "slate",
  DRAFT: "slate",
  ISSUED: "amber",
  PARTIALLY_PAID: "blue",
  PAID: "green",
  VOID: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge color={STATUS_COLOR[status] ?? "slate"}>{status.replace(/_/g, " ")}</Badge>;
}

export function Stat({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  const body = (
    <div className="card h-full hover:border-brand-500">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: React.ReactNode }) {
  const cls =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : kind === "success"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-blue-200 bg-blue-50 text-blue-800";
  return <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{children}</div>;
}

/** Show ?error= / ?ok= messages passed back by server actions via redirect. */
export function FlashFromParams({ params }: { params: { error?: string; ok?: string } }) {
  return (
    <>
      {params.error && <Alert>{params.error}</Alert>}
      {params.ok && <Alert kind="success">{params.ok}</Alert>}
    </>
  );
}
