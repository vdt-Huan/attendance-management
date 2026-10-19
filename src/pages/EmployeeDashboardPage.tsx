import {
  DEMO_PERSONAL_MONTH,
  DEMO_PERSONAL_RECENT,
  DEMO_PERSONAL_TODAY,
} from "../services/demoData";
import { Icons, type IconName } from "../components/icons";
import { StatusBadge } from "../components/AttendanceTable";
import { useEffect, useState } from "react";
import { getAttendanceLast7Days, type AttendanceDayCount } from "../services/attendanceHistory";
import { AttendanceWeekChart } from "../components/AttendanceWeekChart";

interface EmployeeDashboardPageProps {
  onCheckin: () => void;
  onViewHistory: () => void;
}

function PersonalStatCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: IconName;
  accent: string;
}) {
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

// Tổng quan cá nhân dành riêng cho role employee.
// TUYỆT ĐỐI không hiển thị số liệu toàn công ty:
// không danh sách người khác, không biểu đồ công ty.
export function EmployeeDashboardPage({ onCheckin, onViewHistory }: EmployeeDashboardPageProps) {
  const today = DEMO_PERSONAL_TODAY;
  const month = DEMO_PERSONAL_MONTH;
  const checkedOut = today.checkOut !== null;

  const [chartData, setChartData] = useState<AttendanceDayCount[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartReloadKey, setChartReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setChartLoading(true);
    setChartError(null);
    getAttendanceLast7Days()
      .then((data) => { if (alive) { setChartData(data); setChartLoading(false); } })
      .catch((err: unknown) => { if (alive) { setChartError(err instanceof Error ? err.message : "Chưa tải được biểu đồ."); setChartLoading(false); } });
    return () => { alive = false; };
  }, [chartReloadKey]);

  return (
    <div className="space-y-6">
      {/* Thẻ hành động hôm nay + nút Chấm công */}
      <section
        aria-label="Chấm công hôm nay của bạn"
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-100 bg-white p-4 shadow-sm sm:p-6"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900">Hôm nay của bạn</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>
              Vào: <span className="font-semibold text-slate-900">{today.checkIn ?? "Chưa chấm công"}</span>
              {" · "}
              Ra: <span className="font-semibold text-slate-900">{today.checkOut ?? "Chưa chấm công"}</span>
            </span>
            <StatusBadge status={today.status} />
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {checkedOut
              ? "Bạn đã hoàn thành chấm công hôm nay · dữ liệu demo cá nhân."
              : "Nhấn Chấm công để ghi giờ vào/ra của chính bạn · dữ liệu demo cá nhân."}
          </p>
        </div>
        <button
          type="button"
          onClick={onCheckin}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Icons.checkin className="h-4 w-4" />
          Chấm công ngay
        </button>
      </section>

      {/* 4 thẻ cá nhân */}
      <section aria-label="Thống kê cá nhân" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PersonalStatCard
          label="Giờ vào hôm nay"
          value={today.checkIn ?? "—"}
          hint="Của bạn · dữ liệu demo cá nhân"
          icon="checkin"
          accent="bg-green-600"
        />
        <PersonalStatCard
          label="Giờ ra hôm nay"
          value={today.checkOut ?? "—"}
          hint={checkedOut ? "Của bạn · dữ liệu demo cá nhân" : "Chưa chấm công ra · của bạn"}
          icon="history"
          accent="bg-blue-600"
        />
        <PersonalStatCard
          label="Ngày công tháng này"
          value={month.workDays}
          hint="Của bạn · dữ liệu demo cá nhân"
          icon="calendar"
          accent="bg-violet-600"
        />
        <PersonalStatCard
          label="Đi muộn tháng này"
          value={month.lateCount}
          hint="Của bạn · dữ liệu demo cá nhân"
          icon="alert"
          accent="bg-amber-500"
        />
      </section>

      {/* Lịch sử gần đây — chỉ của chính nhân viên */}
      <section
        aria-label="Chấm công gần đây của bạn"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Chấm công gần đây của bạn</h2>
            <p className="text-xs text-slate-500">Chỉ dữ liệu của bạn — dữ liệu demo cá nhân</p>
          </div>
          <button
            type="button"
            onClick={onViewHistory}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Xem lịch sử của tôi
            <Icons.arrowRight className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="px-4 py-3 font-semibold">Ngày</th>
                <th className="px-4 py-3 font-semibold">Giờ vào</th>
                <th className="px-4 py-3 font-semibold">Giờ ra</th>
                <th className="px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {DEMO_PERSONAL_RECENT.map((r) => (
                <tr key={r.dateLabel} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.dateLabel}</td>
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
      </section>

      <AttendanceWeekChart
        data={chartData}
        loading={chartLoading}
        error={chartError}
        onRetry={() => setChartReloadKey((k) => k + 1)}
        title="Chấm công 7 ngày gần nhất của bạn"
      />
    </div>
  );
}
