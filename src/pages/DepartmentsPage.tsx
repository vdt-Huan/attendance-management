// Trang quản lý phòng ban (Ngày 3.2) — Supabase thật + phân quyền HR/Admin.
//
// - Danh sách: tên, ngày tạo, số nhân viên đếm THẬT (count exact trên DB).
//   Tìm kiếm, sắp xếp có kiểm soát (tên/ngày tạo), phân trang server-side.
// - Thêm/sửa qua modal; tên trùng (unique) do DB từ chối → lỗi thân thiện.
// - Xóa: CHẶN khi còn nhân viên liên kết. Muốn xóa phải chuyển nhân viên
//   sang phòng ban khác TRƯỚC, có xác nhận rõ ràng từng bước. Không bao giờ
//   xóa/chuyển ngầm, không chạm lịch sử chấm công (chấm công gắn với
//   employees, không gắn với departments).
// - Bảo mật thật ở RLS (departments_write_hr); frontend chỉ ẩn nút.
//   Trang đã bị guard App.tsx chặn với role employee (PAGE_ACCESS).

import { useState } from "react";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";
import { useDepartmentsList } from "../hooks/useDepartmentsList";
import {
  countEmployeesInDepartment,
  createDepartment,
  deleteDepartment,
  transferEmployees,
  updateDepartment,
  validateDepartmentName,
} from "../services/departments";
import type { DepartmentSortField, DepartmentWithCount } from "../services/departments";
import { isHrOrAdmin } from "../types/rbac";

type Dialog =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; department: DepartmentWithCount }
  | { kind: "delete"; department: DepartmentWithCount; count: number | null; checking: boolean };

function DepartmentForm({
  initialName,
  saving,
  serverError,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName: string;
  saving: boolean;
  serverError: string | null;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateDepartmentName(name);
    setFieldError(invalid);
    if (invalid) return;
    onSubmit(name.trim());
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Form phòng ban">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Tên phòng ban <span className="text-red-500">*</span>
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Kỹ thuật"
          aria-label="Tên phòng ban"
          maxLength={100}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
        {fieldError && (
          <span role="alert" className="mt-1 block text-xs text-red-600">
            {fieldError}
          </span>
        )}
      </label>
      {serverError && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
        >
          {saving ? "Đang lưu…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-50"
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

export function DepartmentsPage({ notify }: { notify: (message: string) => void }) {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);
  const list = useDepartmentsList();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  // Quy trình chuyển nhân viên khi xóa phòng ban đang dùng:
  const [targetId, setTargetId] = useState("");
  const [transferring, setTransferring] = useState(false);

  async function handleCreate(name: string) {
    setSaving(true);
    setServerError(null);
    try {
      await createDepartment(name);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã thêm phòng ban mới.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Thêm phòng ban chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(department: DepartmentWithCount, name: string) {
    setSaving(true);
    setServerError(null);
    try {
      await updateDepartment(department.id, name);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã lưu tên phòng ban.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Lưu thay đổi chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function openDelete(department: DepartmentWithCount) {
    setTargetId("");
    setDialog({ kind: "delete", department, count: null, checking: true });
    try {
      const count = await countEmployeesInDepartment(department.id);
      setDialog({ kind: "delete", department, count, checking: false });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Chưa kiểm tra được dữ liệu liên quan.");
      setDialog({ kind: "none" });
    }
  }

  async function handleDelete(department: DepartmentWithCount) {
    setRowBusyId(department.id);
    try {
      await deleteDepartment(department.id);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã xóa phòng ban.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Xóa phòng ban chưa thành công.");
    } finally {
      setRowBusyId(null);
    }
  }

  // Chuyển nhân viên sang phòng ban khác rồi xóa phòng ban nguồn — 2 bước
  // rõ ràng, có xác nhận, không làm ngầm. Không chạm lịch sử chấm công.
  async function handleTransferThenDelete(department: DepartmentWithCount) {
    if (!targetId) {
      notify("Vui lòng chọn phòng ban đích để chuyển nhân viên tới.");
      return;
    }
    setTransferring(true);
    try {
      const moved = await transferEmployees(department.id, targetId);
      await deleteDepartment(department.id);
      setDialog({ kind: "none" });
      list.reload();
      notify(`Đã chuyển ${moved} nhân viên và xóa phòng ban “${department.name}”.`);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Chuyển nhân viên chưa thành công.");
    } finally {
      setTransferring(false);
    }
  }

  const transferTargets =
    dialog.kind === "delete" && dialog.count != null && dialog.count > 0
      ? list.items.filter((d) => d.id !== dialog.department.id)
      : [];

  return (
    <section aria-label="Quản lý phòng ban" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Phòng ban</h2>
          <p className="text-xs text-slate-500">
            Dữ liệu thật từ bảng departments, liên kết nhân viên qua employees.department_id.{" "}
            {list.state === "ready" && `Tổng ${list.total} phòng ban.`}
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
            + Thêm phòng ban
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="lg:col-span-2">
          <span className="sr-only">Tìm kiếm</span>
          <input
            type="search"
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder="Tìm theo tên phòng ban…"
            aria-label="Tìm kiếm phòng ban"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <select
          value={list.sortField}
          onChange={(e) => list.setSortField(e.target.value as DepartmentSortField)}
          aria-label="Sắp xếp theo"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="name">Tên phòng ban</option>
          <option value="created_at">Ngày tạo</option>
        </select>
        <button
          type="button"
          onClick={() => list.setSortDirection(list.sortDirection === "asc" ? "desc" : "asc")}
          aria-label={list.sortDirection === "asc" ? "Đang tăng dần, nhấn để đảo" : "Đang giảm dần, nhấn để đảo"}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {list.sortDirection === "asc" ? "↑ Tăng dần" : "↓ Giảm dần"}
        </button>
      </div>

      <div className="mt-4">
        {list.state === "loading" && (
          <div aria-label="Đang tải danh sách" className="animate-pulse space-y-2">
            {[0, 1, 2, 3].map((i) => (
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
              {list.query.trim() ? "Không tìm thấy phòng ban nào khớp." : "Chưa có phòng ban nào."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {list.query.trim()
                ? "Thử thay đổi từ khóa tìm kiếm."
                : "HR/Admin nhấn “Thêm phòng ban” để tạo phòng ban đầu tiên."}
            </p>
            {list.query.trim() && (
              <button
                type="button"
                onClick={() => list.setQuery("")}
                className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Xóa tìm kiếm
              </button>
            )}
          </div>
        )}
        {list.state === "ready" && list.items.length > 0 && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tên phòng ban</th>
                    <th className="px-3 py-2">Số nhân viên</th>
                    <th className="px-3 py-2">Ngày tạo</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.items.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-900">{d.name}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {d.employeeCount} nhân viên
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {new Date(d.created_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-3 py-2">
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setServerError(null);
                                setDialog({ kind: "edit", department: d });
                              }}
                              disabled={rowBusyId === d.id}
                              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => void openDelete(d)}
                              disabled={rowBusyId === d.id}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-xs text-slate-500">
                Trang {list.page + 1}/{list.totalPages} · {list.total} phòng ban
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

      {dialog.kind === "create" && (
        <Modal title="Thêm phòng ban" onClose={() => setDialog({ kind: "none" })}>
          <DepartmentForm
            initialName=""
            saving={saving}
            serverError={serverError}
            submitLabel="Thêm phòng ban"
            onSubmit={(name) => void handleCreate(name)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "edit" && (
        <Modal title="Sửa phòng ban" onClose={() => setDialog({ kind: "none" })}>
          <DepartmentForm
            initialName={dialog.department.name}
            saving={saving}
            serverError={serverError}
            submitLabel="Lưu thay đổi"
            onSubmit={(name) => void handleUpdate(dialog.department, name)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "delete" && (
        <Modal title={`Xóa phòng ban — ${dialog.department.name}`} onClose={() => setDialog({ kind: "none" })}>
          {dialog.checking || dialog.count == null ? (
            <p className="py-4 text-center text-sm text-slate-500">Đang kiểm tra nhân viên liên kết…</p>
          ) : dialog.count === 0 ? (
            <div>
              <p className="text-sm text-slate-700">
                Phòng ban <span className="font-semibold">{dialog.department.name}</span> chưa có nhân viên nào.
                Xác nhận xóa vĩnh viễn?
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDelete(dialog.department)}
                  disabled={rowBusyId === dialog.department.id}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rowBusyId === dialog.department.id ? "Đang xóa…" : "Xác nhận xóa"}
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
          ) : (
            <div>
              <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Không thể xóa trực tiếp: còn {dialog.count} nhân viên thuộc phòng ban “
                {dialog.department.name}”. Hãy chuyển họ sang phòng ban khác trước — lịch sử chấm công của họ được
                giữ nguyên (chấm công gắn với hồ sơ nhân viên, không gắn với phòng ban).
              </p>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Chuyển {dialog.count} nhân viên sang
                </span>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  aria-label="Phòng ban đích"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— Chọn phòng ban đích —</option>
                  {transferTargets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.employeeCount} nhân viên)
                    </option>
                  ))}
                </select>
              </label>
              {transferTargets.length === 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Chưa có phòng ban khác để chuyển tới. Hãy tạo phòng ban mới trước.
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleTransferThenDelete(dialog.department)}
                  disabled={transferring || !targetId}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {transferring ? "Đang chuyển…" : `Chuyển ${dialog.count} NV rồi xóa phòng ban`}
                </button>
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "none" })}
                  disabled={transferring}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}
