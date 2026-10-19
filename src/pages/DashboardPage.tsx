// DashboardPage mới (Ngày 6.2) — KPI thật từ Supabase, không hard-code.
//
// - Admin/HR: tổng NV đang hoạt động, phòng ban, ca làm, chấm công hôm nay
//   (đã check-in / đã check-out), đơn nghỉ chờ duyệt. Mỗi KPI có định nghĩa rõ.
// - Employee: giữ EmployeeDashboardPage (Tổng quan cá nhân, không số liệu công ty).
// - Có loading skeleton, error + retry, empty state.

import { useEffect, useState } from "react";
import { StatCard, StatCardSkeleton } from "../components/StatCard";
import { Icons } from "../components/icons";
import { fetchDashboardKPI, type DashboardKPI } from "../services/dashboard";
import { getAttendanceLast7Days, type AttendanceDayCount } from "../services/attendanceHistory";
import { AttendanceWeekChart } from "../components/AttendanceWeekChart";
import { EmployeeDashboardPage } from "./EmployeeDashboardPage";
import type { UserRole } from "../types/auth";

interface DashboardPageProps {
  role: UserRole;
  onViewAll: () => void;
  onCheckin: () => void;
}

const EMPTY_KPI: DashboardKPI = {
  totalActiveEmployees: 0,
  totalDepartments: 0,
  totalShifts: 0,
  todayAttendance: 0,
  todayCheckedIn: 0,
  todayCheckedOut: 0,
  todayLate: 0,
  todayEarly: 0,
  pendingLeaveRequests: 0,
  loading: true,
  error: null,
};

export function DashboardPage({ role, onViewAll, onCheckin }: DashboardPageProps) {
  if (role === "employee") {
    return <EmployeeDashboardPage onCheckin={onCheckin} onViewHistory={onViewAll} />;
  }
  return <CompanyDashboardView onViewAll={onViewAll} />;
}

function CompanyDashboardView({ onViewAll }: { onViewAll: () => void }) {
  const [kpi, setKpi] = useState<DashboardKPI>(EMPTY_KPI);
  const [chartData, setChartData] = useState<AttendanceDayCount[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartReloadKey, setChartReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setKpi((prev) => ({ ...prev, loading: true, error: null }));
    fetchDashboardKPI()
      .then((data) => {
        if (!alive) return;
        setKpi({ ...data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setKpi((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "Chưa tải được dữ liệu." }));
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setChartLoading(true);
    setChartError(null);
    getAttendanceLast7Days()
      .then((data) => { if (alive) { setChartData(data); setChartLoading(false); } })
      .catch((err: unknown) => { if (alive) { setChartError(err instanceof Error ? err.message : "Chưa tải được biểu đồ."); setChartLoading(false); } });
    return () => { alive = false; };
  }, [chartReloadKey]);

  const reload = () => {
    setKpi((prev) => ({ ...prev, loading: true, error: null }));
    fetchDashboardKPI()
      .then((data) => setKpi({ ...data, loading: false, error: null }))
      .catch((err: unknown) => setKpi((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : "Chưa tải được dữ liệu." })));
  };

  if (kpi.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p role="alert" className="text-sm text-red-700">{kpi.error}</p>
        <button type="button" onClick={reload} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <section aria-label="Thống kê tổng quan" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpi.loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="NV đang hoạt động"
              value={kpi.totalActiveEmployees}
              hint="employees WHERE is_active = true"
              icon="employees"
              accent="bg-blue-600"
            />
            <StatCard
              label="Phòng ban"
              value={kpi.totalDepartments}
              hint="count departments"
              icon="departments"
              accent="bg-indigo-600"
            />
            <StatCard
              label="Ca làm việc"
              value={kpi.totalShifts}
              hint="count work_shifts"
              icon="shifts"
              accent="bg-violet-600"
            />
            <StatCard
              label="Đơn nghỉ chờ duyệt"
              value={kpi.pendingLeaveRequests}
              hint="leave_requests WHERE status = 'pending'"
              icon="leave"
              accent="bg-amber-500"
            />
          </>
        )}
      </section>

      {/* Chấm công hôm nay */}
      <section aria-label="Chấm công hôm nay" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Chấm công hôm nay</h2>
            <p className="text-xs text-slate-500">attendance_records WHERE work_date = vn_today()</p>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            Xem tất cả
            <Icons.arrowRight className="h-4 w-4" />
          </button>
        </div>
        {kpi.loading ? (
          <div className="h-24 animate-pulse rounded-lg bg-slate-100" aria-label="Đang tải" />
        ) : kpi.todayAttendance === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">Chưa có bản ghi chấm công nào hôm nay.</p>
            <p className="mt-1 text-xs text-slate-500">Nhân viên sẽ xuất hiện sau khi check-in.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-2xl font-bold text-blue-700">{kpi.todayAttendance}</p>
              <p className="text-xs text-slate-500">Tổng bản ghi</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <p className="text-2xl font-bold text-green-700">{kpi.todayCheckedIn}</p>
              <p className="text-xs text-slate-500">Đã check-in</p>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3">
              <p className="text-2xl font-bold text-indigo-700">{kpi.todayCheckedOut}</p>
              <p className="text-xs text-slate-500">Đã check-out</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-2xl font-bold text-amber-700">{kpi.todayLate}</p>
              <p className="text-xs text-slate-500">Đi muộn</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-sm text-slate-700">
              Về sớm hôm nay: <span className="font-bold text-blue-700">{kpi.todayEarly}</span>
            </p>
          </div>
          </>
        )}
      </section>

      <AttendanceWeekChart
        data={chartData}
        loading={chartLoading}
        error={chartError}
        onRetry={() => setChartReloadKey((k) => k + 1)}
        title="Chấm công 7 ngày gần nhất (toàn công ty)"
      />
    </div>
  );
}