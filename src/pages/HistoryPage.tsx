import { useState } from "react";
import {
  AttendanceTable,
  ErrorState,
  TableSkeleton,
} from "../components/AttendanceTable";
import { FilterBar } from "../components/FilterBar";
import { useDemoAttendance } from "../hooks/useDemoAttendance";
import type { AttendanceFilter } from "../types";

export function HistoryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const { state, records, error, reload } = useDemoAttendance(query, filter);

  return (
    <section aria-label="Lịch sử chấm công" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-1">
        <h2 className="text-base font-bold text-slate-900">Lịch sử chấm công</h2>
        <p className="text-xs text-slate-500">
          Toàn bộ bản ghi demo hiện có — dữ liệu thật từ Supabase sẽ thay thế ở prompt tiếp theo.
        </p>
      </div>
      <div className="my-4">
        <FilterBar query={query} filter={filter} onQueryChange={setQuery} onFilterChange={setFilter} />
      </div>
      {state === "loading" ? (
        <TableSkeleton />
      ) : state === "error" ? (
        <ErrorState message={error ?? "Đã xảy ra lỗi."} onRetry={reload} />
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            Hiển thị {records.length} bản ghi
            {(query.trim() || filter !== "all") && " theo bộ lọc hiện tại"}.
          </p>
          <AttendanceTable
            records={records}
            emptyMessage="Không có bản ghi nào khớp. Thử thay đổi từ khóa hoặc bộ lọc."
          />
        </>
      )}
    </section>
  );
}
