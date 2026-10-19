// Trang lịch sử chấm công + tổng hợp công (Ngày 5.2) — Supabase thật.
//
// - Employee: chỉ xem lịch của mình (RLS attendance_select_own_or_hr).
// - HR/Admin: xem toàn phạm vi, lọc NV/phòng ban/khoảng ngày/trạng thái.
// - Bảng: ngày, NV (HR/Admin), ca làm, giờ vào/ra, trạng thái, xác nhận.
// - Tổng hợp (HR/Admin): đếm ngày có bản ghi, thiếu check-out, vắng, đi muộn,
//   về sớm, đúng giờ, đã xác nhận — định nghĩa rõ ràng trên UI.
// - Không tự thêm quy tắc làm tròn/phạt; chỉ đọc dữ liệu thật.
// - Employee không tự sửa thời gian; không xóa bản ghi lịch sử.

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAttendanceHistory } from "../hooks/useAttendanceHistory";
import { STATUS_LABEL } from "../services/demoData";
import type { AttendanceStatus } from "../types";
import { isHrOrAdmin } from "../types/rbac";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none";

const BADGE_STYLE: Record<AttendanceStatus, string> = {
  "dung-gio": "bg-green-100 text-green-700",
  "di-muon": "bg-amber-100 text-amber-700",
  "ve-som": "bg-blue-100 text-blue-700",
  vang: "bg-slate-200 text-slate-600",
};

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function HistoryPage() {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);
  const h = useAttendanceHistory();

  const [showSummary, setShowSummary] = useState(true);

  return (
    <section aria-label="Lịch sử chấm công" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Lịch sử chấm công</h2>
          <p className="text-xs text-slate-500">
            {canManage ? "Toàn bộ bản ghi chấm công trong phạm vi quyền." : "Lịch sử chấm công của bạn."}{" "}
            {h.state === "ready" && `Tổng ${h.total} bản ghi.`}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowSummary((s) => !s)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {showSummary ? "Ẩn tổng hợp" : "Hiện tổng hợp"}
          </button>
        )}
      </div>

      {/* Bộ lọc */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="date"
          value={h.fromDate}
          onChange={(e) => h.setFromDate(e.target.value)}
          aria-label="Từ ngày"
          className={inputClass}
        />
        <input
          type="date"
          value={h.toDate}
          onChange={(e) => h.setToDate(e.target.value)}
          aria-label="Đến ngày"
          className={inputClass}
        />
        <select
          value={h.status}
          onChange={(e) => h.setStatus(e.target.value as any)}
          aria-label="Lọc theo trạng thái"
          className={inputClass}
        >
          <option value="all">Mọi trạng thái</option>
          <option value="dung-gio">Đúng giờ</option>
          <option value="di-muon">Đi muộn</option>
          <option value="ve-som">Về sớm</option>
          <option value="vang">Vắng</option>
        </select>
        <select
          value={h.sortField}
          onChange={(e) => h.setSortField(e.target.value as any)}
          aria-label="Sắp xếp theo"
          className={inputClass}
        >
          <option value="work_date">Ngày làm việc</option>
          <option value="check_in">Giờ vào</option>
          <option value="status">Trạng thái</option>
        </select>
      </div>

      {/* Quick range + HR/Admin filters */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void h.setQuickRange("today")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Hôm nay</button>
        <button type="button" onClick={() => void h.setQuickRange("week")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Tuần này</button>
        <button type="button" onClick={() => void h.setQuickRange("month")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Tháng này</button>
        <button type="button" onClick={() => { h.setFromDate(""); h.setToDate(""); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Xóa lọc ngày</button>

        {canManage && (
          <>
            <input
              type="search"
              value={h.search}
              onChange={(e) => h.setSearch(e.target.value)}
              placeholder="Tìm theo tên/mã NV…"
              aria-label="Tìm nhân viên"
              className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
            <select
              value={h.departmentId}
              onChange={(e) => h.setDepartmentId(e.target.value)}
              aria-label="Lọc theo phòng ban"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Tất cả phòng ban</option>
              <option value="unassigned">Chưa phân công</option>
              {h.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select
              value={h.sortDirection}
              onChange={(e) => h.setSortDirection(e.target.value as any)}
              aria-label="Chiều sắp xếp"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="desc">Mới nhất trước</option>
              <option value="asc">Cũ nhất trước</option>
            </select>
          </>
        )}
      </div>

      {/* Tổng hợp (HR/Admin) */}
      {canManage && showSummary && h.summary && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Tổng hợp công (định nghĩa rõ ràng)</h3>
          <p className="mt-1 text-[11px] text-slate-400">
            Mỗi chỉ số đếm bản ghi attendance_records trong khoảng ngày đã chọn — không tự thêm quy tắc làm tròn/phạt.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Ngày có bản ghi", value: h.summary.totalRecordDays, color: "text-slate-900" },
              { label: "Đúng giờ (dung-gio)", value: h.summary.onTimeDays, color: "text-green-700" },
              { label: "Đi muộn (di-muon)", value: h.summary.lateDays, color: "text-amber-700" },
              { label: "Về sớm (ve-som)", value: h.summary.earlyLeaveDays, color: "text-blue-700" },
              { label: "Vắng (vang)", value: h.summary.absentDays, color: "text-slate-600" },
              { label: "Thiếu check-out", value: h.summary.missingCheckOut, color: "text-red-600" },
              { label: "Đã xác nhận", value: h.summary.confirmedDays, color: "text-indigo-700" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white p-2 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {canManage && showSummary && h.summaryError && (
        <p role="alert" className="mt-3 text-xs text-red-600">{h.summaryError}</p>
      )}

      {/* Nội dung */}
      <div className="mt-4">
        {h.state === "loading" && (
          <div aria-label="Đang tải" className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {h.state === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p role="alert" className="text-sm text-red-700">{h.error ?? "Đã xảy ra lỗi."}</p>
            <button type="button" onClick={h.reload} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Thử lại</button>
          </div>
        )}
        {h.state === "ready" && h.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Chưa có bản ghi chấm công nào trong khoảng này.</p>
            <p className="mt-1 text-xs text-slate-500">Thử thay đổi bộ lọc hoặc khoảng ngày.</p>
          </div>
        )}
        {h.state === "ready" && h.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {canManage && <th className="px-3 py-2">Nhân viên</th>}
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Giờ vào</th>
                    <th className="px-3 py-2">Giờ ra</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Xác nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {h.items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      {canManage && (
                        <td className="px-3 py-2">
                          <span className="block font-medium text-slate-900">{r.full_name ?? "—"}</span>
                          <span className="block font-mono text-[11px] text-slate-500">{r.employee_code ?? "—"}</span>
                        </td>
                      )}
                      <td className="px-3 py-2 font-medium text-slate-800">{formatDate(r.work_date)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{formatTime(r.check_in)}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{formatTime(r.check_out)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {r.confirmed_at ? "Đã xác nhận" : "Chưa"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-xs text-slate-500">
                Trang {h.page + 1}/{h.totalPages} · {h.total} bản ghi
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => h.setPage(Math.max(0, h.page - 1))}
                  disabled={h.page === 0}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Trước
                </button>
                <button
                  type="button"
                  onClick={() => h.setPage(Math.min(h.totalPages - 1, h.page + 1))}
                  disabled={h.page + 1 >= h.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Tiếp →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}