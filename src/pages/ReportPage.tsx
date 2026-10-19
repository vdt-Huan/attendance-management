// Trang Báo cáo tổng hợp (P1) — dữ liệu Supabase thật, không hard-code.
//
// - Tab "Chấm công": tổng hợp trạng thái chấm công + bảng + xuất CSV.
// - Tab "Nghỉ phép": tổng hợp đơn nghỉ phép + bảng + xuất CSV.
// - Employee chỉ thấy dữ liệu của mình (RLS); HR/Admin thấy toàn phạm vi.

import { useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useAttendanceHistory } from "../hooks/useAttendanceHistory";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { STATUS_LABEL as ATTENDANCE_STATUS_LABEL } from "../services/demoData";
import { LEAVE_TYPE_LABEL, type LeaveType } from "../services/leave";
import { exportAttendanceCsv, exportLeaveCsv } from "../services/dashboard";
import type { AttendanceStatus } from "../types";
import { isHrOrAdmin } from "../types/rbac";

const LEAVE_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

const LEAVE_STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const ATTENDANCE_BADGE: Record<AttendanceStatus, string> = {
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
  const [y, m, d] = (iso ?? "").split("-");
  if (!y || !m || !d) return iso ?? "—";
  return `${d}/${m}/${y}`;
}

type TabKey = "attendance" | "leave";

export function ReportPage() {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);
  const [tab, setTab] = useState<TabKey>("attendance");

  const att = useAttendanceHistory();
  const leave = useLeaveRequests();

  const attendanceExportRows = useMemo(
    () =>
      att.items.map((r) => ({
        work_date: r.work_date,
        employee_code: r.employee_code,
        full_name: r.full_name,
        department_name: r.department_name,
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
        confirmed_at: r.confirmed_at,
      })),
    [att.items],
  );

  const leaveExportRows = useMemo(
    () =>
      leave.items.map((r) => ({
        start_date: r.start_date,
        end_date: r.end_date,
        full_name: r.full_name ?? undefined,
        employee_code: r.employee_code ?? undefined,
        department_name: r.department_name ?? null,
        reason: r.reason,
        status: r.status,
        reviewer_name: r.reviewer_name ?? null,
        decided_at: r.decided_at,
      })),
    [leave.items],
  );

  return (
    <section aria-label="Báo cáo tổng hợp" className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Báo cáo tổng hợp</h2>
            <p className="text-xs text-slate-500">
              {canManage ? "Báo cáo theo phạm vi quyền (toàn bộ nhân sự)." : "Báo cáo cá nhân của bạn."}
            </p>
          </div>
          <div className="flex gap-2" role="tablist" aria-label="Chọn loại báo cáo">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "attendance"}
              onClick={() => setTab("attendance")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === "attendance"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Chấm công
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "leave"}
              onClick={() => setTab("leave")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === "leave"
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Nghỉ phép
            </button>
          </div>
        </div>

        {tab === "attendance" && (
          <div className="mt-4">
            {/* Bộ lọc nhanh */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="date"
                value={att.fromDate}
                onChange={(e) => att.setFromDate(e.target.value)}
                aria-label="Từ ngày"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="date"
                value={att.toDate}
                onChange={(e) => att.setToDate(e.target.value)}
                aria-label="Đến ngày"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <select
                value={att.status}
                onChange={(e) => att.setStatus(e.target.value as any)}
                aria-label="Lọc theo trạng thái"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Mọi trạng thái</option>
                <option value="dung-gio">Đúng giờ</option>
                <option value="di-muon">Đi muộn</option>
                <option value="ve-som">Về sớm</option>
                <option value="vang">Vắng</option>
              </select>
              <select
                value={att.sortDirection}
                onChange={(e) => att.setSortDirection(e.target.value as any)}
                aria-label="Chiều sắp xếp"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="desc">Mới nhất trước</option>
                <option value="asc">Cũ nhất trước</option>
              </select>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void att.setQuickRange("today")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Hôm nay</button>
              <button type="button" onClick={() => void att.setQuickRange("week")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Tuần này</button>
              <button type="button" onClick={() => void att.setQuickRange("month")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">Tháng này</button>
              <button
                type="button"
                onClick={() => exportAttendanceCsv(attendanceExportRows)}
                disabled={att.items.length === 0}
                className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Xuất CSV
              </button>
            </div>

            {canManage && att.summary && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Tổng hợp chấm công</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: "Ngày có bản ghi", value: att.summary.totalRecordDays, color: "text-slate-900" },
                    { label: "Đúng giờ", value: att.summary.onTimeDays, color: "text-green-700" },
                    { label: "Đi muộn", value: att.summary.lateDays, color: "text-amber-700" },
                    { label: "Về sớm", value: att.summary.earlyLeaveDays, color: "text-blue-700" },
                    { label: "Vắng", value: att.summary.absentDays, color: "text-slate-600" },
                    { label: "Thiếu check-out", value: att.summary.missingCheckOut, color: "text-red-600" },
                    { label: "Đã xác nhận", value: att.summary.confirmedDays, color: "text-indigo-700" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-white p-2 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              {att.state === "loading" && (
                <div aria-label="Đang tải" className="animate-pulse space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-100" />
                  ))}
                </div>
              )}
              {att.state === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                  <p role="alert" className="text-sm text-red-700">{att.error ?? "Đã xảy ra lỗi."}</p>
                  <button type="button" onClick={att.reload} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Thử lại</button>
                </div>
              )}
              {att.state === "ready" && att.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">Chưa có bản ghi chấm công nào trong khoảng này.</p>
                </div>
              )}
              {att.state === "ready" && att.items.length > 0 && (
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
                        {att.items.map((r) => (
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
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${ATTENDANCE_BADGE[r.status]}`}>
                                {ATTENDANCE_STATUS_LABEL[r.status]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">{r.confirmed_at ? "Đã xác nhận" : "Chưa"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-xs text-slate-500">Trang {att.page + 1}/{att.totalPages} · {att.total} bản ghi</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => att.setPage(Math.max(0, att.page - 1))} disabled={att.page === 0} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">← Trước</button>
                      <button type="button" onClick={() => att.setPage(Math.min(att.totalPages - 1, att.page + 1))} disabled={att.page + 1 >= att.totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Tiếp →</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "leave" && (
          <div className="mt-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={leave.status}
                onChange={(e) => leave.setStatus(e.target.value as any)}
                aria-label="Lọc theo trạng thái"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Mọi trạng thái</option>
                <option value="pending">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Từ chối</option>
              </select>
              <select
                value={leave.leaveType}
                onChange={(e) => leave.setLeaveType(e.target.value as any)}
                aria-label="Lọc theo loại nghỉ"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">Mọi loại nghỉ</option>
                {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
                  <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>
                ))}
              </select>
              <input
                type="date"
                value={leave.fromDate}
                onChange={(e) => leave.setFromDate(e.target.value)}
                aria-label="Từ ngày"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="date"
                value={leave.toDate}
                onChange={(e) => leave.setToDate(e.target.value)}
                aria-label="Đến ngày"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              {canManage && (
                <select
                  value={leave.departmentId}
                  onChange={(e) => leave.setDepartmentId(e.target.value)}
                  aria-label="Lọc theo phòng ban"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="all">Tất cả phòng ban</option>
                  {leave.departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {canManage && (
                <input
                  type="search"
                  value={leave.search}
                  onChange={(e) => leave.setSearch(e.target.value)}
                  placeholder="Tìm theo tên/mã NV…"
                  aria-label="Tìm nhân viên"
                  className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              )}
              <button
                type="button"
                onClick={() => exportLeaveCsv(leaveExportRows)}
                disabled={leave.items.length === 0}
                className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                Xuất CSV
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-500">Tổng {leave.total} đơn trong phạm vi lọc.</div>

            <div className="mt-4">
              {leave.state === "loading" && (
                <div aria-label="Đang tải" className="animate-pulse space-y-2">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-12 rounded-lg bg-slate-100" />
                  ))}
                </div>
              )}
              {leave.state === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                  <p role="alert" className="text-sm text-red-700">{leave.error ?? "Đã xảy ra lỗi."}</p>
                  <button type="button" onClick={leave.reload} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">Thử lại</button>
                </div>
              )}
              {leave.state === "ready" && leave.items.length === 0 && (
                <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
                  <p className="text-sm font-medium text-slate-700">Chưa có đơn nghỉ phép nào trong khoảng này.</p>
                </div>
              )}
              {leave.state === "ready" && leave.items.length > 0 && (
                <>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Nhân viên</th>
                          <th className="px-3 py-2">Từ ngày</th>
                          <th className="px-3 py-2">Đến ngày</th>
                          <th className="px-3 py-2">Lý do</th>
                          <th className="px-3 py-2">Trạng thái</th>
                          <th className="px-3 py-2">Loại nghỉ</th>
                          <th className="px-3 py-2">Lý do từ chối</th>
                          <th className="px-3 py-2">Người duyệt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leave.items.map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2">
                              <span className="block font-medium text-slate-900">{r.full_name ?? "—"}</span>
                              <span className="block font-mono text-[11px] text-slate-500">{r.employee_code ?? "—"}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-800">{formatDate(r.start_date)}</td>
                            <td className="px-3 py-2 text-slate-800">{formatDate(r.end_date)}</td>
                            <td className="px-3 py-2 text-slate-700 max-w-[220px] truncate" title={r.reason}>{r.reason}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LEAVE_STATUS_BADGE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                                {LEAVE_STATUS_LABEL[r.status] ?? r.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{LEAVE_TYPE_LABEL[r.leave_type] ?? r.leave_type}</td>
                            <td className="px-3 py-2 max-w-[180px] truncate text-slate-600" title={r.rejection_reason ?? ""}>
                              {r.rejection_reason ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">{r.reviewer_name ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                    <p className="text-xs text-slate-500">Trang {leave.page + 1}/{leave.totalPages} · {leave.total} đơn</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => leave.setPage(Math.max(0, leave.page - 1))} disabled={leave.page === 0} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">← Trước</button>
                      <button type="button" onClick={() => leave.setPage(Math.min(leave.totalPages - 1, leave.page + 1))} disabled={leave.page + 1 >= leave.totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Tiếp →</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
