import { Icons, type IconName } from "./icons";

interface StatCardProps {
  label: string;
  value: number;
  hint: string;
  icon: IconName;
  accent: string;
}

export function StatCard({ label, value, hint, icon, accent }: StatCardProps) {
  const Icon = Icons[icon];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{hint}</p>
        </div>
        <span className={`rounded-xl p-2.5 text-white ${accent}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-4 w-2/3 rounded bg-slate-100" />
      <div className="mt-3 h-8 w-1/3 rounded bg-slate-100" />
      <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
    </div>
  );
}
