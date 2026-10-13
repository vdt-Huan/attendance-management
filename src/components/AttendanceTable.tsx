import { STATUS_LABEL } from "../services/demoData";
import type { AttendanceRecord } from "../types";
import { Icons } from "./icons";

const BADGE_STYLE: Record<AttendanceRecord["status"], string> = {
  "dung-gio": "bg-green-100 text-green-700",
  "di-muon": "bg-amber-100 text-amber-700",
  "ve-som": "bg-blue-100 text-blue-700",
  vang: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status }: { status: AttendanceRecord["status"] }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icons.inbox className="h-10 w-10 text-slate-300" />
      <p className="font-medium text-slate-700">Không có dữ liệu</p>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function AttendanceTable({
  records,
  emptyMessage,
}: {
  records: AttendanceRecord[];
  emptyMessage: string;
}) {
  if (records.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <th className="px-4 py-3 font-semibold">Mã nhân viên</th>
            <th className="px-4 py-3 font-semibold">Họ tên</th>
            <th className="px-4 py-3 font-semibold">Giờ vào</th>
            <th className="px-4 py-3 font-semibold">Giờ ra</th>
            <th className="px-4 py-3 font-semibold">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {records.map((r) => (
            <tr key={r.employeeCode} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-blue-700">{r.employeeCode}</td>
              <td className="px-4 py-3 text-slate-800">{r.fullName}</td>
              <td className="px-4 py-3 text-slate-600">{r.checkIn ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{r.checkOut ?? "—"}</td>
              <td className="px-4 py-3">
                <StatusBadge status={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 px-4 py-4" aria-label="Đang tải dữ liệu">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-10 rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <Icons.alert className="h-10 w-10 text-red-300" />
      <p className="font-medium text-slate-700">Không tải được dữ liệu</p>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Thử lại
      </button>
    </div>
  );
}
