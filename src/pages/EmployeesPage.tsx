// Trang quản lý nhân viên (Ngày 3.1) — Supabase thật + phân quyền HR/Admin.
//
// - Danh sách responsive, tìm kiếm (tên/mã/email), lọc phòng ban + trạng
//   thái, sắp xếp có kiểm soát, phân trang server-side (10/trang).
// - Thêm/sửa qua modal form; xóa kiểm tra FK trước, ưu tiên vô hiệu hóa.
// - Bảo mật thật ở RLS; frontend chỉ ẩn nút + chuyển lỗi 42501 rõ nghĩa.
//   Trang đã bị guard App.tsx chặn với role employee (PAGE_ACCESS).

import { useMemo, useState } from "react";
import { EmployeeDetailView } from "../components/employees/EmployeeDetail";
import { EmployeeForm } from "../components/employees/EmployeeForm";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";
import { useDepartments, useEmployeesList } from "../hooks/useEmployees";
import {
  countRelatedRecords,
  createEmployee,
  deleteEmployee,
  setEmployeeActive,
  updateEmployee,
} from "../services/employees";
import type {
  EmployeeFormInput,
  EmployeeWithRefs,
  RelatedCounts,
} from "../types/employees";
import { EMPLOYEE_SORT_FIELDS, relatedTotal } from "../types/employees";
import { isHrOrAdmin } from "../types/rbac";

type Dialog =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; employee: EmployeeWithRefs }
  | { kind: "detail"; employee: EmployeeWithRefs }
  | { kind: "delete"; employee: EmployeeWithRefs; related: RelatedCounts | null; checking: boolean };

export function EmployeesPage({ notify }: { notify: (message: string) => void }) {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);
  const list = useEmployeesList();
  const { departments } = useDepartments();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const deptOptions = useMemo(() => departments, [departments]);
  const hasFilter =
    list.query.trim() !== "" || list.departmentId !== "all" || list.status !== "all";

  function clearFilter() {
    list.setQuery("");
    list.setDepartmentId("all");
    list.setStatus("all");
  }

  // Từ chối phòng ban không hợp lệ trước khi chạm DB: chỉ chấp nhận null
  // (chưa phân công) hoặc id đang có trong bảng departments thật.
  // Schema departments không có cột trạng thái nên mọi phòng ban hiện có
  // đều được coi là đang hoạt động và chọn được.
  function assertValidDepartment(input: EmployeeFormInput): boolean {
    if (input.department_id == null || input.department_id === "") return true;
    const known = deptOptions.some((d) => d.id === input.department_id);
    if (!known) {
      setServerError("Phòng ban không hợp lệ (không tồn tại trong hệ thống). Vui lòng chọn lại.");
      return false;
    }
    return true;
  }

  async function handleCreate(input: EmployeeFormInput) {
    setSaving(true);
    setServerError(null);
    try {
      if (!assertValidDepartment(input)) return;
      await createEmployee(input);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã thêm nhân viên mới.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Thêm nhân viên chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(employee: EmployeeWithRefs, input: EmployeeFormInput) {
    setSaving(true);
    setServerError(null);
    try {
      if (!assertValidDepartment(input)) return;
      await updateEmployee(employee.id, input);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã lưu thay đổi hồ sơ nhân viên.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Lưu thay đổi chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(employee: EmployeeWithRefs) {
    setRowBusyId(employee.id);
    try {
      await setEmployeeActive(employee.id, !employee.is_active);
      if (dialog.kind === "detail") setDialog({ kind: "none" });
      list.reload();
      notify(employee.is_active ? "Đã vô hiệu hóa nhân viên." : "Đã kích hoạt lại nhân viên.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Đổi trạng thái chưa thành công.");
    } finally {
      setRowBusyId(null);
    }
  }

  async function openDelete(employee: EmployeeWithRefs) {
    setDialog({ kind: "delete", employee, related: null, checking: true });
    try {
      const related = await countRelatedRecords(employee.id);
      setDialog({ kind: "delete", employee, related, checking: false });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Chưa kiểm tra được dữ liệu liên quan.");
      setDialog({ kind: "none" });
    }
  }

  async function handleDelete(employee: EmployeeWithRefs) {
    setRowBusyId(employee.id);
    try {
      await deleteEmployee(employee.id);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã xóa hồ sơ nhân viên.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Xóa nhân viên chưa thành công.");
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <section aria-label="Quản lý nhân viên" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Nhân viên</h2>
          <p className="text-xs text-slate-500">
            Dữ liệu thật từ Supabase (employees + departments + profiles qua user_id).{" "}
            {list.state === "ready" && `Tổng ${list.total} hồ sơ.`}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setServerError(null);
              setDialog({ kind: "create" });
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Thêm nhân viên
          </button>
        )}
      </div>

      {/* Thanh tìm kiếm / lọc / sắp xếp */}
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="lg:col-span-2">
          <span className="sr-only">Tìm kiếm</span>
          <input
            type="search"
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder="Tìm theo tên, mã NV hoặc email…"
            aria-label="Tìm kiếm nhân viên"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <select
          value={list.departmentId}
          onChange={(e) => list.setDepartmentId(e.target.value)}
          aria-label="Lọc theo phòng ban"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Tất cả phòng ban</option>
          <option value="unassigned">Chưa phân công</option>
          {deptOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={list.status}
          onChange={(e) => list.setStatus(e.target.value as typeof list.status)}
          aria-label="Lọc theo trạng thái"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Mọi trạng thái</option>
          <option value="active">Đang làm việc</option>
          <option value="inactive">Ngừng hoạt động</option>
        </select>
        <div className="flex gap-2">
          <select
            value={list.sortField}
            onChange={(e) => list.setSortField(e.target.value as typeof list.sortField)}
            aria-label="Sắp xếp theo"
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {EMPLOYEE_SORT_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => list.setSortDirection(list.sortDirection === "asc" ? "desc" : "asc")}
            aria-label={list.sortDirection === "asc" ? "Đang tăng dần, nhấn để đảo" : "Đang giảm dần, nhấn để đảo"}
            title={list.sortDirection === "asc" ? "Tăng dần" : "Giảm dần"}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            {list.sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Nội dung */}
      <div className="mt-4">
        {list.state === "loading" && (
          <div aria-label="Đang tải danh sách" className="animate-pulse space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {list.state === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p role="alert" className="text-sm text-red-700">
              {list.error ?? "Đã xảy ra lỗi."}
            </p>
            <button
              type="button"
              onClick={list.reload}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}
        {list.state === "ready" && list.items.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {hasFilter ? "Không tìm thấy nhân viên nào khớp bộ lọc." : "Chưa có hồ sơ nhân viên nào."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {hasFilter
                ? "Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc."
                : "HR/Admin nhấn “Thêm nhân viên” để tạo hồ sơ đầu tiên."}
            </p>
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilter}
                className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}
        {list.state === "ready" && list.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Mã NV</th>
                    <th className="px-3 py-2">Họ tên / Email</th>
                    <th className="px-3 py-2">SĐT</th>
                    <th className="px-3 py-2">Phòng ban</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.items.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-mono text-xs text-slate-700">{e.employee_code}</td>
                      <td className="px-3 py-2">
                        <span className="block font-medium text-slate-900">{e.full_name}</span>
                        <span className="block text-xs text-slate-500">
                          {e.profile_email ?? "Chưa liên kết tài khoản"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{e.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-700">{e.department_name ?? "Chưa phân công"}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            e.is_active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {e.is_active ? "Đang làm việc" : "Ngừng HĐ"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDialog({ kind: "detail", employee: e })}
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            Chi tiết
                          </button>
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setServerError(null);
                                  setDialog({ kind: "edit", employee: e });
                                }}
                                disabled={rowBusyId === e.id}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void openDelete(e)}
                                disabled={rowBusyId === e.id}
                                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Phân trang */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-xs text-slate-500">
                Trang {list.page + 1}/{list.totalPages} · {list.total} hồ sơ
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => list.setPage(Math.max(0, list.page - 1))}
                  disabled={list.page === 0}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  ← Trước
                </button>
                <button
                  type="button"
                  onClick={() => list.setPage(Math.min(list.totalPages - 1, list.page + 1))}
                  disabled={list.page + 1 >= list.totalPages}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Tiếp →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Dialogs */}
      {dialog.kind === "create" && (
        <Modal title="Thêm nhân viên" onClose={() => setDialog({ kind: "none" })}>
          <EmployeeForm
            mode="create"
            departments={deptOptions}
            saving={saving}
            serverError={serverError}
            onSubmit={(input) => void handleCreate(input)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "edit" && (
        <Modal title={`Sửa nhân viên — ${dialog.employee.employee_code}`} onClose={() => setDialog({ kind: "none" })}>
          <EmployeeForm
            mode="edit"
            initial={dialog.employee}
            departments={deptOptions}
            saving={saving}
            serverError={serverError}
            onSubmit={(input) => void handleUpdate(dialog.employee, input)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "detail" && (
        <Modal title="Hồ sơ nhân viên" onClose={() => setDialog({ kind: "none" })}>
          <EmployeeDetailView
            employeeId={dialog.employee.id}
            onEdit={() => {
              setServerError(null);
              if (canManage) setDialog({ kind: "edit", employee: dialog.employee });
            }}
            onToggleActive={() => void handleToggleActive(dialog.employee)}
          />
        </Modal>
      )}
      {dialog.kind === "delete" && (
        <Modal title={`Xóa nhân viên — ${dialog.employee.employee_code}`} onClose={() => setDialog({ kind: "none" })}>
          {dialog.checking || !dialog.related ? (
            <p className="py-4 text-center text-sm text-slate-500">Đang kiểm tra dữ liệu liên quan…</p>
          ) : relatedTotal(dialog.related) > 0 ? (
            <div>
              <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Không thể xóa vì còn {relatedTotal(dialog.related)} bản ghi liên quan (phân ca:{" "}
                {dialog.related.assignments}, chấm công: {dialog.related.attendance}, đơn nghỉ:{" "}
                {dialog.related.leaveRequests}). Lịch sử được giữ lại — hãy vô hiệu hóa thay vì xóa.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleActive(dialog.employee)}
                  disabled={rowBusyId === dialog.employee.id || !dialog.employee.is_active}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {dialog.employee.is_active ? "Vô hiệu hóa thay vì xóa" : "Đã ngừng hoạt động"}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "none" })}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-700">
                Hồ sơ <span className="font-semibold">{dialog.employee.full_name}</span> chưa có dữ liệu liên
                quan. Xác nhận xóa vĩnh viễn?
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDelete(dialog.employee)}
                  disabled={rowBusyId === dialog.employee.id}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rowBusyId === dialog.employee.id ? "Đang xóa…" : "Xác nhận xóa"}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "none" })}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
