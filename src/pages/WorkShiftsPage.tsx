// Trang quản lý ca làm việc (Ngày 4.1) — Supabase thật + HR/Admin.
//
// - Danh sách: tên ca, giờ bắt đầu/kết thúc (kiểu time, hiển thị nguyên-clock,
//   không quy đổi múi giờ), thời lượng (ca qua đêm tính vòng nửa đêm +
//   badge), số phút cho phép muộn, số lượt phân công đếm thật.
// - Tìm kiếm theo tên, sắp xếp có kiểm soát, phân trang server-side.
// - Thêm/sửa qua modal; trùng tên bị từ chối ở tầng app (DB không unique).
// - Xóa: CHẶN khi còn phân công (FK RESTRICT + kiểm tra trước). Schema không
//   có trạng thái ngừng hoạt động nên không có vô hiệu hóa.
// - Bảo mật thật ở RLS (shifts_write_hr); trang bị guard App.tsx chặn role
//   employee (PAGE_ACCESS).

import { useState } from "react";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";
import { useShiftsList } from "../hooks/useShiftsList";
import {
  countShiftAssignments,
  createShift,
  deleteShift,
  formatDuration,
  isOvernightShift,
  shiftDurationMinutes,
  shortTime,
  updateShift,
  validateShiftForm,
} from "../services/workShifts";
import type {
  ShiftFieldErrors,
  ShiftFormInput,
  ShiftSortField,
  WorkShiftWithCount,
} from "../services/workShifts";
import { isHrOrAdmin } from "../types/rbac";

type Dialog =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; shift: WorkShiftWithCount }
  | { kind: "delete"; shift: WorkShiftWithCount; count: number | null; checking: boolean };

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none";

function ShiftForm({
  initial,
  saving,
  serverError,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ShiftFormInput;
  saving: boolean;
  serverError: string | null;
  submitLabel: string;
  onSubmit: (input: ShiftFormInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ShiftFormInput>(initial);
  const [errors, setErrors] = useState<ShiftFieldErrors>({});

  function set<K extends keyof ShiftFormInput>(key: K, value: ShiftFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateShiftForm(form);
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some((v) => v)) return;
    onSubmit(form);
  }

  const duration = shiftDurationMinutes(form.start_time, form.end_time);
  const overnight = isOvernightShift(form.start_time, form.end_time);

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Form ca làm việc">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Tên ca <span className="text-red-500">*</span>
          </span>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="VD: Ca sáng"
            aria-label="Tên ca"
            maxLength={100}
            className={inputClass}
          />
          {errors.name && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.name}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Giờ bắt đầu <span className="text-red-500">*</span>
          </span>
          <input
            type="time"
            value={form.start_time}
            onChange={(e) => set("start_time", e.target.value)}
            aria-label="Giờ bắt đầu"
            className={inputClass}
          />
          {errors.start_time && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.start_time}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Giờ kết thúc <span className="text-red-500">*</span>
          </span>
          <input
            type="time"
            value={form.end_time}
            onChange={(e) => set("end_time", e.target.value)}
            aria-label="Giờ kết thúc"
            className={inputClass}
          />
          {errors.end_time && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.end_time}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Cho phép muộn (phút)</span>
          <input
            type="number"
            min={0}
            max={120}
            step={1}
            value={form.late_after_minutes}
            onChange={(e) => set("late_after_minutes", Number(e.target.value))}
            aria-label="Số phút cho phép muộn"
            className={inputClass}
          />
          {errors.late_after_minutes && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.late_after_minutes}
            </span>
          )}
        </label>
        <div className="flex items-end">
          <p className="w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600" aria-live="polite">
            {duration == null ? (
              "Nhập đủ giờ bắt đầu/kết thúc để xem thời lượng."
            ) : (
              <>
                Thời lượng: <span className="font-bold text-slate-900">{formatDuration(duration)}</span>
                {overnight && (
                  <span className="ml-2 inline-block rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700">
                    Ca qua đêm
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Giờ lưu đúng giờ treo tường (kiểu time), không quy đổi múi giờ. Ca qua đêm VD 22:00–06:00 được chấp nhận.
      </p>
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

const EMPTY_FORM: ShiftFormInput = { name: "", start_time: "", end_time: "", late_after_minutes: 15 };

export function WorkShiftsPage({ notify }: { notify: (message: string) => void }) {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);
  const list = useShiftsList();
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  // Thông báo thành công CHỈ sau khi lưu thật thành công (await xong).
  async function handleCreate(input: ShiftFormInput) {
    setSaving(true);
    setServerError(null);
    try {
      await createShift(input);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã thêm ca làm việc mới.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Thêm ca chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(shift: WorkShiftWithCount, input: ShiftFormInput) {
    setSaving(true);
    setServerError(null);
    try {
      await updateShift(shift.id, input);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã lưu thay đổi ca làm việc.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Lưu thay đổi chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function openDelete(shift: WorkShiftWithCount) {
    setDialog({ kind: "delete", shift, count: null, checking: true });
    try {
      const count = await countShiftAssignments(shift.id);
      setDialog({ kind: "delete", shift, count, checking: false });
    } catch (err) {
      notify(err instanceof Error ? err.message : "Chưa kiểm tra được phân công liên quan.");
      setDialog({ kind: "none" });
    }
  }

  async function handleDelete(shift: WorkShiftWithCount) {
    setRowBusyId(shift.id);
    try {
      await deleteShift(shift.id);
      setDialog({ kind: "none" });
      list.reload();
      notify("Đã xóa ca làm việc.");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Xóa ca chưa thành công.");
    } finally {
      setRowBusyId(null);
    }
  }

  return (
    <section aria-label="Quản lý ca làm việc" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ca làm việc</h2>
          <p className="text-xs text-slate-500">
            Định nghĩa giờ vào/ra chuẩn từ bảng work_shifts.{" "}
            {list.state === "ready" && `Tổng ${list.total} ca.`}
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
            + Thêm ca
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
            placeholder="Tìm theo tên ca…"
            aria-label="Tìm kiếm ca làm việc"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
        <select
          value={list.sortField}
          onChange={(e) => list.setSortField(e.target.value as ShiftSortField)}
          aria-label="Sắp xếp theo"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="name">Tên ca</option>
          <option value="start_time">Giờ bắt đầu</option>
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
              {list.query.trim() ? "Không tìm thấy ca nào khớp." : "Chưa có ca làm việc nào."}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {list.query.trim()
                ? "Thử thay đổi từ khóa tìm kiếm."
                : "HR/Admin nhấn “Thêm ca” để định nghĩa ca đầu tiên."}
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
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tên ca</th>
                    <th className="px-3 py-2">Giờ làm</th>
                    <th className="px-3 py-2">Thời lượng</th>
                    <th className="px-3 py-2">Cho phép muộn</th>
                    <th className="px-3 py-2">Phân công</th>
                    <th className="px-3 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.items.map((s) => {
                    const duration = shiftDurationMinutes(s.start_time, s.end_time);
                    const overnight = isOvernightShift(s.start_time, s.end_time);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-medium text-slate-900">{s.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-700">
                          {shortTime(s.start_time)} – {shortTime(s.end_time)}{" "}
                          {overnight && (
                            <span className="ml-1 inline-block rounded-full bg-indigo-100 px-2 py-0.5 font-sans font-medium text-indigo-700">
                              Qua đêm
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {duration == null ? "—" : formatDuration(duration)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{s.late_after_minutes} phút</td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {s.assignmentCount} lượt
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {canManage && (
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setServerError(null);
                                  setDialog({ kind: "edit", shift: s });
                                }}
                                disabled={rowBusyId === s.id}
                                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => void openDelete(s)}
                                disabled={rowBusyId === s.id}
                                className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-xs text-slate-500">
                Trang {list.page + 1}/{list.totalPages} · {list.total} ca
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
        <Modal title="Thêm ca làm việc" onClose={() => setDialog({ kind: "none" })}>
          <ShiftForm
            initial={EMPTY_FORM}
            saving={saving}
            serverError={serverError}
            submitLabel="Thêm ca"
            onSubmit={(input) => void handleCreate(input)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "edit" && (
        <Modal title={`Sửa ca — ${dialog.shift.name}`} onClose={() => setDialog({ kind: "none" })}>
          <ShiftForm
            initial={{
              name: dialog.shift.name,
              start_time: shortTime(dialog.shift.start_time),
              end_time: shortTime(dialog.shift.end_time),
              late_after_minutes: dialog.shift.late_after_minutes,
            }}
            saving={saving}
            serverError={serverError}
            submitLabel="Lưu thay đổi"
            onSubmit={(input) => void handleUpdate(dialog.shift, input)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "delete" && (
        <Modal title={`Xóa ca — ${dialog.shift.name}`} onClose={() => setDialog({ kind: "none" })}>
          {dialog.checking || dialog.count == null ? (
            <p className="py-4 text-center text-sm text-slate-500">Đang kiểm tra phân công liên quan…</p>
          ) : dialog.count > 0 ? (
            <div>
              <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Không thể xóa: ca này còn {dialog.count} lượt phân công cho nhân viên. Hãy gỡ phân công trước khi
                xóa để giữ lịch sử.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setDialog({ kind: "none" })}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-700">
                Ca <span className="font-semibold">{dialog.shift.name}</span> ({shortTime(dialog.shift.start_time)}–
                {shortTime(dialog.shift.end_time)}) chưa được phân công cho ai. Xác nhận xóa vĩnh viễn?
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleDelete(dialog.shift)}
                  disabled={rowBusyId === dialog.shift.id}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rowBusyId === dialog.shift.id ? "Đang xóa…" : "Xác nhận xóa"}
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
