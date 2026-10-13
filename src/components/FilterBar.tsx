import { STATUS_LABEL } from "../services/demoData";
import type { AttendanceFilter, AttendanceStatus } from "../types";
import { Icons } from "./icons";

interface FilterBarProps {
  query: string;
  filter: AttendanceFilter;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: AttendanceFilter) => void;
}

const FILTER_OPTIONS: { value: AttendanceFilter; label: string }[] = [
  { value: "all", label: "Tất cả trạng thái" },
  ...(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((status) => ({
    value: status as AttendanceFilter,
    label: STATUS_LABEL[status],
  })),
];

export function FilterBar({ query, filter, onQueryChange, onFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative flex-1">
        <Icons.search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm theo tên hoặc mã nhân viên…"
          aria-label="Tìm kiếm nhân viên"
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
      </label>
      <select
        value={filter}
        onChange={(e) => onFilterChange(e.target.value as AttendanceFilter)}
        aria-label="Lọc theo trạng thái"
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
      >
        {FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
