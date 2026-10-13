import { useState } from "react";
import { AttendanceChart } from "../components/AttendanceChart";
import {
  AttendanceTable,
  ErrorState,
  TableSkeleton,
} from "../components/AttendanceTable";
import { FilterBar } from "../components/FilterBar";
import { Icons } from "../components/icons";
import { StatCard, StatCardSkeleton } from "../components/StatCard";
import { useDemoAttendance } from "../hooks/useDemoAttendance";
import type { AttendanceFilter } from "../types";

interface DashboardPageProps {
  onViewAll: () => void;
}

export function DashboardPage({ onViewAll }: DashboardPageProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const { state, stats, records, weekly, error, reload } = useDemoAttendance(query, filter);

  if (state === "error") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <ErrorState message={error ?? "Đã xảy ra lỗi."} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4 thẻ thống kê */}
      <section aria-label="Thống kê tổng quan" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {state === "loading" || !stats ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label="Tổng nhân viên" value={stats.totalEmployees} hint="Dữ liệu demo" icon="employees" accent="bg-blue-600" />
            <StatCard label="Đã chấm công hôm nay" value={stats.checkedInToday} hint="Dữ liệu demo" icon="checkin" accent="bg-green-600" />
            <StatCard label="Đi muộn" value={stats.lateToday} hint="Hôm nay · dữ liệu demo" icon="alert" accent="bg-amber-500" />
            <StatCard label="Đơn nghỉ phép chờ duyệt" value={stats.pendingLeaveRequests} hint="Dữ liệu demo" icon="leave" accent="bg-violet-600" />
          </>
        )}
      </section>

      {/* Biểu đồ */}
      <section aria-label="Biểu đồ chấm công theo ngày" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Chấm công theo ngày</h2>
            <p className="text-xs text-slate-500">Lượt chấm công 7 ngày gần nhất · dữ liệu demo</p>
          </div>
        </div>
        {state === "loading" ? (
          <div className="h-52 animate-pulse rounded-lg bg-slate-100" aria-label="Đang tải biểu đồ" />
        ) : (
          <AttendanceChart data={weekly} />
        )}
      </section>

      {/* Bảng gần đây */}
      <section aria-label="Chấm công gần đây" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Chấm công gần đây</h2>
            <p className="text-xs text-slate-500">Danh sách demo — chưa phải dữ liệu chấm công thật</p>
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
        <div className="mb-4">
          <FilterBar query={query} filter={filter} onQueryChange={setQuery} onFilterChange={setFilter} />
        </div>
        {state === "loading" ? (
          <TableSkeleton />
        ) : (
          <AttendanceTable
            records={records.slice(0, 5)}
            emptyMessage="Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái."
          />
        )}
      </section>
    </div>
  );
}
