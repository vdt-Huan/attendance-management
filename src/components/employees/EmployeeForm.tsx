// Form thêm/sửa nhân viên (Ngày 3.1).
// Chỉ các trường được phép theo schema: employee_code, full_name,
// department_id, phone, hire_date, is_active, user_id.
// Validate frontend trước, lỗi Supabase hiển thị rõ ràng, không lộ kỹ thuật.

import { useEffect, useState } from "react";
import { validateEmployeeForm } from "../../services/employees";
import type {
  Department,
  EmployeeFieldErrors,
  EmployeeFormInput,
  EmployeeWithRefs,
} from "../../types/employees";

interface EmployeeFormProps {
  mode: "create" | "edit";
  initial?: EmployeeWithRefs | null;
  departments: Department[];
  saving: boolean;
  serverError: string | null;
  onSubmit: (input: EmployeeFormInput) => void;
  onCancel: () => void;
}

function toFormInput(source: EmployeeWithRefs | null | undefined): EmployeeFormInput {
  return {
    employee_code: source?.employee_code ?? "",
    full_name: source?.full_name ?? "",
    department_id: source?.department_id ?? null,
    phone: source?.phone ?? null,
    hire_date: source?.hire_date ?? null,
    is_active: source?.is_active ?? true,
    user_id: source?.user_id ?? null,
  };
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";

export function EmployeeForm({
  mode,
  initial,
  departments,
  saving,
  serverError,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [form, setForm] = useState<EmployeeFormInput>(() => toFormInput(initial));
  const [errors, setErrors] = useState<EmployeeFieldErrors>({});

  // Khi mở form sửa bản ghi khác, điền lại dữ liệu hiện có.
  useEffect(() => {
    setForm(toFormInput(initial));
    setErrors({});
  }, [initial, mode]);

  function set<K extends keyof EmployeeFormInput>(key: K, value: EmployeeFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validateEmployeeForm(form);
    setErrors(fieldErrors);
    if (Object.values(fieldErrors).some((v) => v)) return;
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label={mode === "create" ? "Thêm nhân viên" : "Sửa nhân viên"}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Mã nhân viên <span className="text-red-500">*</span>
          </span>
          <input
            value={form.employee_code}
            onChange={(e) => set("employee_code", e.target.value)}
            placeholder="VD: NV-001"
            aria-label="Mã nhân viên"
            className={inputClass}
          />
          {errors.employee_code && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.employee_code}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Họ tên <span className="text-red-500">*</span>
          </span>
          <input
            value={form.full_name}
            onChange={(e) => set("full_name", e.target.value)}
            placeholder="VD: Nguyễn Văn An"
            aria-label="Họ tên"
            className={inputClass}
          />
          {errors.full_name && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.full_name}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Phòng ban</span>
          <select
            value={form.department_id ?? ""}
            onChange={(e) => set("department_id", e.target.value ? e.target.value : null)}
            aria-label="Phòng ban"
            className={inputClass}
          >
            <option value="">— Chưa phân công —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Số điện thoại</span>
          <input
            value={form.phone ?? ""}
            onChange={(e) => set("phone", e.target.value ? e.target.value : null)}
            placeholder="VD: 0901234567"
            aria-label="Số điện thoại"
            className={inputClass}
          />
          {errors.phone && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.phone}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Ngày vào làm</span>
          <input
            type="date"
            value={form.hire_date ?? ""}
            onChange={(e) => set("hire_date", e.target.value ? e.target.value : null)}
            aria-label="Ngày vào làm"
            className={inputClass}
          />
          {errors.hire_date && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.hire_date}
            </span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Trạng thái</span>
          <select
            value={form.is_active ? "active" : "inactive"}
            onChange={(e) => set("is_active", e.target.value === "active")}
            aria-label="Trạng thái"
            className={inputClass}
          >
            <option value="active">Đang làm việc</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Liên kết tài khoản (tùy chọn)
          </span>
          <input
            value={form.user_id ?? ""}
            onChange={(e) => set("user_id", e.target.value ? e.target.value : null)}
            placeholder="UUID của profiles.id — để trống nếu chưa có tài khoản"
            aria-label="Mã tài khoản liên kết"
            className={`${inputClass} font-mono`}
          />
          {errors.user_id && (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {errors.user_id}
            </span>
          )}
          <span className="mt-1 block text-xs text-slate-400">
            Liên kết employees.user_id → profiles.id (= auth user). Không nhập employees.id vào đây.
          </span>
        </label>
      </div>

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
          {saving ? "Đang lưu…" : mode === "create" ? "Thêm nhân viên" : "Lưu thay đổi"}
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
