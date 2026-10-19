// Kiểu quản lý nhân viên (Ngày 3.1) — bám ĐÚNG schema thật trong
// supabase/migrations/0001_initial_schema.sql, KHÔNG bịa thêm cột.
//
// - employees: id, user_id (→ profiles.id, NULL được), employee_code
//   (unique, NOT NULL), full_name, department_id (→ departments.id, NULL
//   được), phone (NULL được), hire_date (NULL được), is_active
//   (default true), created_at, updated_at.
//   → employees KHÔNG có cột email: email nằm ở profiles.email và chỉ
//   lấy được khi employees.user_id trỏ tới profiles.id.
// - departments: id, name (unique), created_at.
// - profiles: id (= auth.users.id), email, full_name, role, created_at,
//   updated_at.
//
// Liên kết Auth ↔ nhân viên: employees.user_id = profiles.id
// (= auth.uid()). TUYỆT ĐỐI không cho rằng employees.id = profiles.id.

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface EmployeeRow {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  department_id: string | null;
  phone: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Hồ sơ Auth liên kết (qua employees.user_id) — null khi chưa liên kết. */
export interface LinkedProfile {
  id: string;
  email: string;
  full_name: string;
}

/** Nhân viên kèm tên phòng ban + email (email chỉ có khi đã liên kết). */
export interface EmployeeWithRefs extends EmployeeRow {
  department_name: string | null;
  profile_email: string | null;
}

/** Dữ liệu form — CHỈ các trường người dùng được sửa. */
export interface EmployeeFormInput {
  employee_code: string;
  full_name: string;
  /** null = chưa phân công phòng ban. */
  department_id: string | null;
  /** null = không có số điện thoại. */
  phone: string | null;
  /** Chuỗi YYYY-MM-DD hoặc null. */
  hire_date: string | null;
  is_active: boolean;
  /** UUID profiles.id hoặc null (= chưa liên kết tài khoản). */
  user_id: string | null;
}

export type EmployeeFieldErrors = Partial<Record<keyof EmployeeFormInput, string>>;

export type EmployeeStatusFilter = "all" | "active" | "inactive";

export type EmployeeSortField = "full_name" | "employee_code" | "hire_date" | "created_at";

export type SortDirection = "asc" | "desc";

export interface EmployeeListParams {
  search: string;
  /** "all" | "unassigned" | department.id */
  departmentId: string;
  status: EmployeeStatusFilter;
  page: number;
  pageSize: number;
  sortField: EmployeeSortField;
  sortDirection: SortDirection;
}

export interface EmployeeListResult {
  items: EmployeeWithRefs[];
  total: number;
}

export interface ShiftAssignmentView {
  id: string;
  work_date: string;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
}

export interface AttendanceView {
  id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  confirmed_at: string | null;
}

export interface LeaveView {
  id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface EmployeeDetail extends EmployeeWithRefs {
  department: Department | null;
  linkedProfile: LinkedProfile | null;
  assignments: ShiftAssignmentView[];
  attendance: AttendanceView[];
  leaveRequests: LeaveView[];
}

/** Số bản ghi liên quan trước khi xóa (nguồn: FK on delete cascade/restrict). */
export interface RelatedCounts {
  assignments: number;
  attendance: number;
  leaveRequests: number;
}

export function relatedTotal(c: RelatedCounts): number {
  return c.assignments + c.attendance + c.leaveRequests;
}

export const EMPLOYEE_SORT_FIELDS: ReadonlyArray<{
  value: EmployeeSortField;
  label: string;
}> = [
  { value: "full_name", label: "Tên nhân viên" },
  { value: "employee_code", label: "Mã nhân viên" },
  { value: "hire_date", label: "Ngày vào làm" },
  { value: "created_at", label: "Ngày tạo hồ sơ" },
];

export const EMPLOYEE_PAGE_SIZE = 10;
