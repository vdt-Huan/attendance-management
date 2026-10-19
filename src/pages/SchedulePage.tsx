// Trang lịch làm việc + phân công ca (Ngày 4.2).
//
// - Lịch tuần (T2–CN): chọn ngày, chuyển tuần, hôm nay. Ô có ca hiện tên +
//   giờ; ô trống hiện "—"; cả tuần trống → empty state đúng nghĩa.
// - Lọc (HR/Admin): nhân viên, phòng ban (từ bảng departments thật), ca.
//   Employee bị khóa cứng chỉ xem lịch chính mình (RLS siết thêm ở DB).
// - Phân công (HR/Admin): form chọn nhân viên/ca/ngày — mọi option từ
//   Supabase, không hard-code. Validate bắt buộc + ngày hợp lệ; trùng
//   (1 người/ngày) do UNIQUE + kiểm tra trước chặn; nhân viên ngừng hoạt
//   động hoặc ca/nhân viên không tồn tại bị từ chối.
// - Sửa/hủy: xác nhận trước khi hủy; ngày đã phát sinh chấm công bị CHẶN
//   sửa/hủy để giữ toàn vẹn (không động attendance ở đây). Không xóa hàng
//   loạt. Thông báo thành công chỉ sau khi DB xác nhận (await xong).

import { useEffect, useMemo, useState } from "react";
import { Modal } from "../components/Modal";
import { useAuth } from "../hooks/useAuth";
import { useSchedule } from "../hooks/useSchedule";
import { listDepartments, listEmployees } from "../services/employees";
import {
  createAssignment,
  deleteAssignment,
  getMyEmployeeId,
  toISODate,
  updateAssignment,
  weekdayLabel,
} from "../services/schedule";
import type { AssignmentFormInput, ScheduleAssignment } from "../services/schedule";
import type { Department, EmployeeWithRefs } from "../types/employees";
import { listShiftsPaged } from "../services/workShifts";
import type { WorkShift } from "../services/workShifts";
import { isHrOrAdmin } from "../types/rbac";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none";

// --- Combobox chọn nhân viên: tìm kiếm trên Supabase, chỉ nhân viên đang hoạt động ---
function EmployeePicker({
  valueId,
  valueLabel,
  onPick,
  excludeLabel,
}: {
  valueId: string;
  valueLabel: string;
  onPick: (id: string, label: string) => void;
  excludeLabel?: string;
}) {
  const [q, setQ] = useState(valueLabel);
  const [options, setOptions] = useState<EmployeeWithRefs[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQ(valueLabel);
  }, [valueLabel]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      listEmployees({
        search: q,
        departmentId: "all",
        status: "active",
        page: 0,
        pageSize: 20,
        sortField: "full_name",
        sortDirection: "asc",
      })
        .then((res) => setOptions(res.items))
        .catch(() => setOptions([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, open]);

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder="Gõ tên/mã NV để tìm…"
        aria-label="Chọn nhân viên"
        className={inputClass}
      />
      {open && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {options.length === 0 && (
            <li className="px-3 py-2 text-xs text-slate-400">Không tìm thấy nhân viên đang hoạt động.</li>
          )}
          {options.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onMouseDown={() => {
                  onPick(e.id, `${e.full_name} (${e.employee_code})`);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
              >
                <span className="font-medium text-slate-800">{e.full_name}</span>{" "}
                <span className="font-mono text-xs text-slate-500">{e.employee_code}</span>
                {excludeLabel && <span className="block text-xs text-slate-400">{excludeLabel}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!valueId && q.trim() && (
        <span role="alert" className="mt-1 block text-xs text-red-600">
          Vui lòng chọn nhân viên trong danh sách gợi ý.
        </span>
      )}
    </div>
  );
}

// --- Form phân công ---
function AssignmentForm({
  initial,
  initialEmployeeLabel,
  shifts,
  saving,
  serverError,
  submitLabel,
  showDelete,
  onSubmit,
  onDelete,
  onCancel,
}: {
  initial: AssignmentFormInput;
  initialEmployeeLabel: string;
  shifts: WorkShift[];
  saving: boolean;
  serverError: string | null;
  submitLabel: string;
  showDelete: boolean;
  onSubmit: (input: AssignmentFormInput) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) {
      setFieldError("Vui lòng chọn nhân viên trong danh sách gợi ý.");
      return;
    }
    if (!form.shift_id) {
      setFieldError("Vui lòng chọn ca làm.");
      return;
    }
    if (!form.work_date) {
      setFieldError("Vui lòng chọn ngày làm việc.");
      return;
    }
    setFieldError(null);
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Form phân công ca">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Nhân viên <span className="text-red-500">*</span>
          </span>
          <EmployeePicker
            valueId={form.employee_id}
            valueLabel={initialEmployeeLabel}
            onPick={(id) => setForm((f) => ({ ...f, employee_id: id }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Ca làm <span className="text-red-500">*</span>
          </span>
          <select
            value={form.shift_id}
            onChange={(e) => setForm((f) => ({ ...f, shift_id: e.target.value }))}
            aria-label="Chọn ca làm"
            className={inputClass}
          >
            <option value="">— Chọn ca —</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Ngày làm việc <span className="text-red-500">*</span>
          </span>
          <input
            type="date"
            value={form.work_date}
            onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
            aria-label="Ngày làm việc"
            className={inputClass}
          />
        </label>
      </div>
      {fieldError && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {fieldError}
        </p>
      )}
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
        {showDelete && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            Hủy phân công
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-50"
        >
          Đóng
        </button>
      </div>
    </form>
  );
}

type Dialog =
  | { kind: "none" }
  | { kind: "create"; date: string }
  | { kind: "edit"; assignment: ScheduleAssignment; employeeLabel: string }
  | { kind: "confirmDelete"; assignment: ScheduleAssignment };

export function SchedulePage({ notify }: { notify: (message: string) => void }) {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);

  // Employee: khóa cứng lịch chính mình; HR/Admin: toàn phạm vi được cấp.
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [myChecked, setMyChecked] = useState(canManage);
  useEffect(() => {
    if (canManage) return;
    getMyEmployeeId()
      .then((id) => {
        setMyEmployeeId(id);
        setMyChecked(true);
      })
      .catch(() => setMyChecked(true));
  }, [canManage]);

  const locked = canManage ? null : myChecked ? [myEmployeeId ?? "__none__"] : null;
  const schedule = useSchedule({ lockedEmployeeIds: locked });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    listDepartments().then(setDepartments).catch(() => setDepartments([]));
    listShiftsPaged({ search: "", page: 0, pageSize: 50, sortField: "name", sortDirection: "asc" })
      .then((res) => setShifts(res.items))
      .catch(() => setShifts([]));
  }, []);

  const weekLabel = useMemo(() => {
    const f = (iso: string) => {
      const [y, m, d] = iso.split("-");
      return `${d}/${m}/${y}`;
    };
    return `${f(schedule.days[0] ?? "")} – ${f(schedule.days[6] ?? "")}`;
  }, [schedule.days]);

  const hasAnyAssignment = schedule.rows.some((r) => Object.keys(r.byDate).length > 0);

  async function handleCreate(input: AssignmentFormInput) {
    setSaving(true);
    setServerError(null);
    try {
      await createAssignment(input);
      setDialog({ kind: "none" });
      schedule.reload();
      notify("Đã phân công ca thành công.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Phân công chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string, input: AssignmentFormInput) {
    setSaving(true);
    setServerError(null);
    try {
      await updateAssignment(id, input);
      setDialog({ kind: "none" });
      schedule.reload();
      notify("Đã lưu thay đổi phân công.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Lưu thay đổi chưa thành công.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await deleteAssignment(id);
      setDialog({ kind: "none" });
      schedule.reload();
      notify("Đã hủy phân công.");
    } catch (err) {
      // Trường hợp bị chặn (đã có chấm công) hiển thị rõ, giữ lịch sử.
      notify(err instanceof Error ? err.message : "Hủy phân công chưa thành công.");
      setDialog({ kind: "none" });
    } finally {
      setSaving(false);
    }
  }

  const todayISO = toISODate(new Date());

  return (
    <section aria-label="Lịch làm việc" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Lịch làm việc</h2>
          <p className="text-xs text-slate-500">
            {canManage
              ? "Phân công ca theo tuần từ dữ liệu thật (shift_assignments)."
              : "Lịch làm việc của bạn trong tuần."}{" "}
            Tuần {weekLabel}.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setServerError(null);
              setDialog({ kind: "create", date: todayISO });
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            + Phân công ca
          </button>
        )}
      </div>

      {/* Điều hướng tuần */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => schedule.goWeek(-1)}
          aria-label="Tuần trước"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          ← Tuần trước
        </button>
        <button
          type="button"
          onClick={schedule.goToday}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Hôm nay
        </button>
        <button
          type="button"
          onClick={() => schedule.goWeek(1)}
          aria-label="Tuần sau"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Tuần sau →
        </button>
        <input
          type="date"
          onChange={(e) => e.target.value && schedule.pickDate(e.target.value)}
          aria-label="Chọn ngày để xem tuần chứa ngày đó"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* Bộ lọc HR/Admin */}
      {canManage && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            type="search"
            value={schedule.search}
            onChange={(e) => schedule.setSearch(e.target.value)}
            placeholder="Lọc nhân viên theo tên/mã…"
            aria-label="Lọc nhân viên"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={schedule.departmentId}
            onChange={(e) => schedule.setDepartmentId(e.target.value)}
            aria-label="Lọc theo phòng ban"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Tất cả phòng ban</option>
            <option value="unassigned">Chưa phân công</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={schedule.shiftId}
            onChange={(e) => schedule.setShiftId(e.target.value)}
            aria-label="Lọc theo ca"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Tất cả ca</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4">
        {schedule.state === "loading" && (
          <div aria-label="Đang tải lịch" className="animate-pulse space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-100" />
            ))}
          </div>
        )}
        {schedule.state === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
            <p role="alert" className="text-sm text-red-700">
              {schedule.error ?? "Đã xảy ra lỗi."}
            </p>
            <button
              type="button"
              onClick={schedule.reload}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}
        {schedule.state === "ready" && !canManage && !myEmployeeId && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Tài khoản của bạn chưa có hồ sơ nhân viên.</p>
            <p className="mt-1 text-xs text-slate-500">Liên hệ HR để được liên kết hồ sơ, sau đó tải lại trang.</p>
          </div>
        )}
        {schedule.state === "ready" && (canManage || myEmployeeId) && schedule.rows.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Tuần này chưa có lịch làm việc.</p>
            <p className="mt-1 text-xs text-slate-500">
              {canManage ? "Nhấn “Phân công ca” để xếp lịch cho nhân viên." : "Bạn chưa được phân công ca nào trong tuần này."}
            </p>
          </div>
        )}
        {schedule.state === "ready" && schedule.rows.length > 0 && !hasAnyAssignment && (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Chưa có phân công nào trong tuần này.</p>
            <p className="mt-1 text-xs text-slate-500">Thử chuyển tuần khác hoặc thay đổi bộ lọc.</p>
          </div>
        )}
        {schedule.state === "ready" && schedule.rows.length > 0 && hasAnyAssignment && (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-3 py-2">Nhân viên</th>
                    {schedule.days.map((d, i) => {
                      const [, m, day] = d.split("-");
                      return (
                        <th key={d} className={`px-2 py-2 text-center ${d === todayISO ? "bg-blue-50" : ""}`}>
                          {weekdayLabel(i)}
                          <span className="block font-bold normal-case">{`${day}/${m}`}</span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schedule.rows.map((r) => (
                    <tr key={r.employee_id} className="hover:bg-slate-50/60">
                      <td className="sticky left-0 bg-white px-3 py-2">
                        <span className="block font-medium text-slate-900">{r.full_name}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{r.employee_code}</span>
                        {!r.is_active && (
                          <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                            Ngừng HĐ
                          </span>
                        )}
                      </td>
                      {schedule.days.map((d) => {
                        const a = r.byDate[d];
                        return (
                          <td key={d} className={`px-2 py-2 text-center ${d === todayISO ? "bg-blue-50/50" : ""}`}>
                            {a ? (
                              <button
                                type="button"
                                disabled={!canManage}
                                onClick={() =>
                                  canManage &&
                                  setDialog({
                                    kind: "edit",
                                    assignment: a,
                                    employeeLabel: `${r.full_name} (${r.employee_code})`,
                                  })
                                }
                                title={canManage ? "Nhấn để sửa/hủy phân công" : `${a.shift_name} ${a.shift_start}–${a.shift_end}`}
                                className={`inline-block rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs ${
                                  canManage ? "hover:bg-blue-100" : "cursor-default"
                                }`}
                              >
                                <span className="block font-semibold text-blue-800">{a.shift_name}</span>
                                <span className="block font-mono text-[11px] text-blue-600">
                                  {a.shift_start}–{a.shift_end}
                                </span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {canManage && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                <p className="text-xs text-slate-500">
                  Trang {schedule.page + 1}/{schedule.totalPages} · {schedule.totalEmployees} nhân viên
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => schedule.setPage(Math.max(0, schedule.page - 1))}
                    disabled={schedule.page === 0}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    ← Trước
                  </button>
                  <button
                    type="button"
                    onClick={() => schedule.setPage(Math.min(schedule.totalPages - 1, schedule.page + 1))}
                    disabled={schedule.page + 1 >= schedule.totalPages}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Tiếp →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {dialog.kind === "create" && (
        <Modal title="Phân công ca" onClose={() => setDialog({ kind: "none" })}>
          <AssignmentForm
            initial={{ employee_id: "", shift_id: "", work_date: dialog.date }}
            initialEmployeeLabel=""
            shifts={shifts}
            saving={saving}
            serverError={serverError}
            submitLabel="Phân công"
            showDelete={false}
            onSubmit={(input) => void handleCreate(input)}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "edit" && (
        <Modal title="Sửa phân công" onClose={() => setDialog({ kind: "none" })}>
          <AssignmentForm
            initial={{
              employee_id: dialog.assignment.employee_id,
              shift_id: dialog.assignment.shift_id,
              work_date: dialog.assignment.work_date,
            }}
            initialEmployeeLabel={dialog.employeeLabel}
            shifts={shifts}
            saving={saving}
            serverError={serverError}
            submitLabel="Lưu thay đổi"
            showDelete
            onSubmit={(input) => void handleUpdate(dialog.assignment.id, input)}
            onDelete={() => setDialog({ kind: "confirmDelete", assignment: dialog.assignment })}
            onCancel={() => setDialog({ kind: "none" })}
          />
        </Modal>
      )}
      {dialog.kind === "confirmDelete" && (
        <Modal title="Hủy phân công" onClose={() => setDialog({ kind: "none" })}>
          <p className="text-sm text-slate-700">
            Hủy phân công ca <span className="font-semibold">{dialog.assignment.shift_name}</span> ngày{" "}
            <span className="font-semibold">{dialog.assignment.work_date}</span>? Nếu ngày này đã phát sinh chấm
            công, thao tác sẽ bị chặn để giữ toàn vẹn lịch sử.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void handleDelete(dialog.assignment.id)}
              disabled={saving}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? "Đang hủy…" : "Xác nhận hủy"}
            </button>
            <button
              type="button"
              onClick={() => setDialog({ kind: "none" })}
              disabled={saving}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Giữ lại
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
