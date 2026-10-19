// Trang quản lý đơn nghỉ phép (Ngày 6.1) — Supabase thật.
//
// - Employee: gửi đơn (ngày bắt đầu/kết thúc + lý do), xem đơn của mình,
//   xóa đơn pending của mình.
// - HR/Admin: xem toàn phạm vi, lọc theo trạng thái/ngày/NV/phòng ban,
//   duyệt/từ chối đơn pending (xác nhận trước), xóa đơn pending.
// - RLS: leave_select_own_or_hr, leave_insert_own_or_hr (employee chỉ insert
//   pending cho chính mình), leave_update_own_or_hr (employee chỉ sửa pending
//   của mình, không chạm status/reviewed_by/decided_at), trigger
//   enforce_leave_* siết thêm ở DB.
// - Employee gửi đơn cho người khác bị RLS chặn; employee tự duyệt bị trigger
//   chặn; duyệt đơn đã xử lý bị từ chối (optimistic concurrency + trigger).
// - Không tự trừ phép/tính lương (schema chưa hỗ trợ).

import { useState } from "react";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";
import { useLeaveRequests } from "../hooks/useLeaveRequests";
import { isHrOrAdmin } from "../types/rbac";
import {
  createLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  deleteLeaveRequest,
  LEAVE_TYPE_LABEL,
  type LeaveType,
} from "../services/leave";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

function LeaveForm({
  myEmployeeId,
  saving,
  serverError,
  onSubmit,
  onCancel,
}: {
  myEmployeeId: string | null;
  saving: boolean;
  serverError: string | null;
  onSubmit: (start: string, end: string, reason: string, leaveType: LeaveType) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("annual");
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!start) { setFieldError("Vui lòng chọn ngày bắt đầu."); return; }
    if (!end) { setFieldError("Vui lòng chọn ngày kết thúc."); return; }
    if (end < start) { setFieldError("Ngày kết thúc không được trước ngày bắt đầu."); return; }
    if (!reason.trim()) { setFieldError("Vui lòng nhập lý do nghỉ phép."); return; }
    setFieldError(null);
    onSubmit(start, end, reason.trim(), leaveType);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Form đăng ký nghỉ phép">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Ngày bắt đầu <span className="text-red-500">*</span></span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Ngày bắt đầu" className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Ngày kết thúc <span className="text-red-500">*</span></span>
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Ngày kết thúc" className={inputClass} />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Loại nghỉ phép <span className="text-red-500">*</span></span>
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType)} aria-label="Loại nghỉ phép" className={inputClass}>
          {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
            <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Lý do <span className="text-red-500">*</span></span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="VD: Nghỉ ốm, nghỉ phép năm..."
          rows={3}
          aria-label="Lý do nghỉ phép"
          className={inputClass}
        />
      </label>
      {fieldError && <p role="alert" className="mt-2 text-xs text-red-600">{fieldError}</p>}
      {serverError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={saving || !myEmployeeId} className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">
          {saving ? "Đang gửi…" : "Gửi đơn"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-50">
          Hủy
        </button>
      </div>
      {!myEmployeeId && (
        <p className="mt-2 text-xs text-amber-600">Tài khoản chưa liên kết hồ sơ nhân viên. Không thể gửi đơn.</p>
      )}
    </form>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function LeavePage({ notify }: { notify: (message: string) => void }) {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);
  const h = useLeaveRequests();
  const [dialog, setDialog] = useState<"none" | "create" | "confirmApprove" | "confirmReject" | "confirmDelete">("none");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function handleCreate(start: string, end: string, reason: string, leaveType: LeaveType) {
    if (!h.myEmployeeId) return;
    setSaving(true);
    setServerError(null);
    try {
      await createLeaveRequest(h.myEmployeeId, start, end, reason, leaveType);
      setDialog("none");
      h.reload();
      notify("Đã gửi đơn nghỉ phép.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Gửi đơn chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(id: string) {
    setSaving(true);
    try {
      await approveLeaveRequest(id);
      setDialog("none");
      h.reload();
      notify("Đã duyệt đơn nghỉ phép.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Duyệt đơn chưa thành công.");
      setDialog("none");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject(id: string, reason: string) {
    setSaving(true);
    try {
      await rejectLeaveRequest(id, reason);
      setDialog("none");
      h.reload();
      notify("Đã từ chối đơn nghỉ phép.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Từ chối đơn chưa thành công.");
      setDialog("none");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteLeaveRequest(id);
      setDialog("none");
      h.reload();
      notify("Đã xóa đơn nghỉ phép.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Xóa đơn chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  const selectedItem = h.items.find((r) => r.id === selectedId);

  return (
    <section aria-label="Nghỉ phép" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Nghỉ phép</h2>
          <p className="text-xs text-slate-500">
            {canManage ? "Quản lý và xử lý đơn nghỉ phép." : "Đơn nghỉ phép của bạn."}{" "}
            {h.state === "ready" && `Tổng ${h.total} đơn.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setServerError(null); setDialog("create"); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Đăng ký nghỉ phép
        </button>
      </div>

      {/* Bộ lọc HR/Admin */}
      {canManage && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input type="date" value={h.fromDate} onChange={(e) => h.setFromDate(e.target.value)} aria-label="Từ ngày" className={inputClass} />
          <input type="date" value={h.toDate} onChange={(e) => h.setToDate(e.target.value)} aria-label="Đến ngày" className={inputClass} />
          <select value={h.status} onChange={(e) => h.setStatus(e.target.value as any)} aria-label="Lọc trạng thái" className={inputClass}>
            <option value="all">Mọi trạng thái</option>
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="rejected">Từ chối</option>
          </select>
          <select value={h.leaveType} onChange={(e) => h.setLeaveType(e.target.value as any)} aria-label="Lọc loại nghỉ" className={inputClass}>
            <option value="all">Mọi loại nghỉ</option>
            {(Object.keys(LEAVE_TYPE_LABEL) as LeaveType[]).map((t) => (
              <option key={t} value={t}>{LEAVE_TYPE_LABEL[t]}</option>
            ))}
          </select>
          <select value={h.sortField} onChange={(e) => h.setSortField(e.target.value as any)} aria-label="Sắp xếp" className={inputClass}>
            <option value="created_at">Ngày tạo</option>
            <option value="start_date">Ngày bắt đầu</option>
            <option value="status">Trạng thái</option>
          </select>
        </div>
      )}

      {canManage && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={h.search}
            onChange={(e) => h.setSearch(e.target.value)}
            placeholder="Tìm theo tên/mã NV…"
            aria-label="Tìm nhân viên"
            className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select value={h.departmentId} onChange={(e) => h.setDepartmentId(e.target.value)} aria-label="Lọc phòng ban" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none">
            <option value="all">Tất cả phòng ban</option>
            <option value="unassigned">Chưa phân công</option>
            {h.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Danh sách */}
      <div className="mt-4">
        {h.state === "loading" && (
          <div aria-label="Đang tải" className="animate-pulse space-y-2">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-slate-100" />)}
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
            <p className="text-sm font-medium text-slate-700">Chưa có đơn nghỉ phép nào.</p>
            <p className="mt-1 text-xs text-slate-500">Nhấn "Đăng ký nghỉ phép" để tạo đơn đầu tiên.</p>
          </div>
        )}
        {h.state === "ready" && h.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {canManage && <th className="px-3 py-2">Nhân viên</th>}
                    <th className="px-3 py-2">Từ ngày</th>
                    <th className="px-3 py-2">Đến ngày</th>
                    <th className="px-3 py-2">Lý do</th>
                    <th className="px-3 py-2">Loại nghỉ</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Lý do từ chối</th>
                    {canManage && <th className="px-3 py-2">Người duyệt</th>}
                    <th className="px-3 py-2 text-right">Thao tác</th>
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
                      <td className="px-3 py-2 text-slate-700">{formatDate(r.start_date)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDate(r.end_date)}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-slate-600" title={r.reason}>{r.reason}</td>
                      <td className="px-3 py-2 text-slate-600">{LEAVE_TYPE_LABEL[r.leave_type] ?? r.leave_type}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-slate-600" title={r.rejection_reason ?? ""}>
                        {r.rejection_reason ?? "—"}
                      </td>
                      {canManage && (
                        <td className="px-3 py-2 text-xs text-slate-500">{r.reviewer_name ?? "—"}</td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          {canManage && r.status === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => { setSelectedId(r.id); setDialog("confirmApprove"); }}
                                className="rounded-md border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                              >
                                Duyệt
                              </button>
                              <button
                                type="button"
                                onClick={() => { setSelectedId(r.id); setRejectionReason(""); setDialog("confirmReject"); }}
                                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                              >
                                Từ chối
                              </button>
                            </>
                          )}
                          {(r.status === "pending") && (
                            <button
                              type="button"
                              onClick={() => { setSelectedId(r.id); setDialog("confirmDelete"); }}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-xs text-slate-500">Trang {h.page + 1}/{h.totalPages} · {h.total} đơn</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => h.setPage(Math.max(0, h.page - 1))} disabled={h.page === 0} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">← Trước</button>
                <button type="button" onClick={() => h.setPage(Math.min(h.totalPages - 1, h.page + 1))} disabled={h.page + 1 >= h.totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40">Tiếp →</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {dialog === "create" && (
        <Modal title="Đăng ký nghỉ phép" onClose={() => setDialog("none")}>
          <LeaveForm
            myEmployeeId={h.myEmployeeId}
            saving={saving}
            serverError={serverError}
            onSubmit={(s, e, r, t) => void handleCreate(s, e, r, t)}
            onCancel={() => setDialog("none")}
          />
        </Modal>
      )}
      {dialog === "confirmApprove" && selectedItem && (
        <Modal title="Duyệt đơn nghỉ phép" onClose={() => setDialog("none")}>
          <p className="text-sm text-slate-700">
            Duyệt đơn nghỉ phép của <span className="font-semibold">{selectedItem.full_name}</span> từ{" "}
            <span className="font-semibold">{formatDate(selectedItem.start_date)}</span> đến{" "}
            <span className="font-semibold">{formatDate(selectedItem.end_date)}</span>?
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void handleApprove(selectedItem.id)} disabled={saving} className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? "Đang xử lý…" : "Xác nhận duyệt"}
            </button>
            <button type="button" onClick={() => setDialog("none")} disabled={saving} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Hủy
            </button>
          </div>
        </Modal>
      )}
      {dialog === "confirmReject" && selectedItem && (
        <Modal title="Từ chối đơn nghỉ phép" onClose={() => setDialog("none")}>
          <p className="text-sm text-slate-700">
            Từ chối đơn nghỉ phép của <span className="font-semibold">{selectedItem.full_name}</span> từ{" "}
            <span className="font-semibold">{formatDate(selectedItem.start_date)}</span> đến{" "}
            <span className="font-semibold">{formatDate(selectedItem.end_date)}</span>?
          </p>
          <label className="mt-3 block text-sm font-medium text-slate-700">
          Lý do từ chối (bắt buộc, 5–1000 ký tự)
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </label>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void handleReject(selectedItem.id, rejectionReason)} disabled={saving || rejectionReason.trim().length < 5} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? "Đang xử lý…" : "Xác nhận từ chối"}
            </button>
            <button type="button" onClick={() => setDialog("none")} disabled={saving} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Hủy
            </button>
          </div>
        </Modal>
      )}
      {dialog === "confirmDelete" && selectedItem && (
        <Modal title="Xóa đơn nghỉ phép" onClose={() => setDialog("none")}>
          <p className="text-sm text-slate-700">
            Xóa đơn nghỉ phép {selectedItem.status === "pending" ? "đang chờ duyệt" : ""} của{" "}
            <span className="font-semibold">{selectedItem.full_name}</span>?
            {selectedItem.status !== "pending" && " Chỉ được xóa đơn đang chờ duyệt."}
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void handleDelete(selectedItem.id)} disabled={saving} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? "Đang xóa…" : "Xác nhận xóa"}
            </button>
            <button type="button" onClick={() => setDialog("none")} disabled={saving} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Hủy
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}