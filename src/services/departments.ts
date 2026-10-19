// Tầng gọi Supabase cho quản lý phòng ban (Ngày 3.2).
//
// Bám ĐÚNG schema thật trong supabase/migrations/0001_initial_schema.sql:
// - departments: id (uuid PK), name (text NOT NULL UNIQUE), created_at.
//   KHÔNG có cột trạng thái/is_active → không vô hiệu hóa, không sửa schema.
// - Liên kết nhân viên ↔ phòng ban DUY NHẤT qua employees.department_id
//   → departments.id (ON DELETE SET NULL).
// - RLS: departments_select_auth (mọi authenticated được đọc),
//   departments_write_hr (chỉ is_hr() được ghi). Bảo mật thật ở RLS;
//   frontend chỉ ẩn nút + dịch lỗi 42501.
//
// NGUYÊN TẮC XÓA: chặn xóa phòng ban còn nhân viên (giữ toàn vẹn liên kết
// và lịch sử chấm công — chấm công gắn với employees, không gắn với
// departments, nên chuyển phòng ban không bao giờ chạm lịch sử). Muốn xóa
// phải chuyển nhân viên sang phòng ban khác TRƯỚC, có xác nhận rõ ràng.

import { getSupabaseClient } from "../lib/supabase";
import type { Department } from "../types/employees";

export interface DepartmentWithCount extends Department {
  /** Số nhân viên thuộc phòng ban — đếm THẬT bằng count exact trên DB. */
  employeeCount: number;
}

export type DepartmentSortField = "name" | "created_at";
export type DepartmentSortDirection = "asc" | "desc";

export interface DepartmentListParams {
  search: string;
  page: number;
  pageSize: number;
  sortField: DepartmentSortField;
  sortDirection: DepartmentSortDirection;
}

export interface DepartmentListResult {
  items: DepartmentWithCount[];
  total: number;
}

export const DEPARTMENT_PAGE_SIZE = 10;
const MAX_NAME_LENGTH = 100;

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/** Validate tên phòng ban ở frontend. */
export function validateDepartmentName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Vui lòng nhập tên phòng ban.";
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Tên phòng ban không được vượt quá ${MAX_NAME_LENGTH} ký tự.`;
  }
  return null;
}

function toFriendlyReadError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (
      raw.includes("failed to fetch") ||
      raw.includes("networkerror") ||
      raw.includes("fetch failed") ||
      raw.includes("timeout")
    ) {
      return "Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.";
    }
    if (raw.includes("42501") || raw.includes("row-level security")) {
      return "Bạn không có quyền xem dữ liệu này.";
    }
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return "Chưa tải được dữ liệu phòng ban. Vui lòng thử lại.";
  }
  return "Chưa tải được dữ liệu phòng ban. Vui lòng thử lại.";
}

export function toFriendlyDepartmentError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (raw.includes("23505") || raw.includes("duplicate") || raw.includes("already exists")) {
      return "Tên phòng ban đã tồn tại. Vui lòng dùng tên khác.";
    }
    if (raw.includes("42501") || raw.includes("permission denied") || raw.includes("row-level security")) {
      return "Bạn không có quyền thực hiện thao tác này. Chỉ HR/Admin được quản lý phòng ban.";
    }
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return "Thao tác chưa thành công. Vui lòng kiểm tra dữ liệu và thử lại.";
  }
  return "Thao tác chưa thành công. Vui lòng thử lại.";
}

/**
 * Danh sách phòng ban: tìm kiếm + sắp xếp + phân trang ở server, kèm số
 * nhân viên đếm THẬT (count exact từng phòng ban trong trang hiện tại —
 * chính xác với mọi quy mô, không đếm từ dữ liệu giả/tải hết bảng).
 */
export async function listDepartmentsPaged(params: DepartmentListParams): Promise<DepartmentListResult> {
  const page = Math.max(0, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), 50);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const search = params.search.trim();

  try {
    const client = getSupabaseClient();
    let query = client.from("departments").select("id, name, created_at", { count: "exact" });
    if (search) query = query.ilike("name", `%${escapeLike(search)}%`);
    query = query.order(params.sortField, { ascending: params.sortDirection === "asc" }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(toFriendlyReadError(error));

    const rows = (data ?? []) as Department[];
    const counts = await Promise.all(
      rows.map(async (d) => {
        const { count: c, error: cErr } = await client
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("department_id", d.id);
        if (cErr) throw cErr;
        return c ?? 0;
      }),
    );
    return {
      items: rows.map((d, i) => ({ ...d, employeeCount: counts[i] ?? 0 })),
      total: count ?? rows.length,
    };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

export async function createDepartment(name: string): Promise<Department> {
  const invalid = validateDepartmentName(name);
  if (invalid) throw new Error(invalid);
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("departments")
      .insert({ name: name.trim() })
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(toFriendlyDepartmentError(error));
    return data as Department;
  } catch (err) {
    throw new Error(toFriendlyDepartmentError(err));
  }
}

export async function updateDepartment(id: string, name: string): Promise<Department> {
  const invalid = validateDepartmentName(name);
  if (invalid) throw new Error(invalid);
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("departments")
      .update({ name: name.trim() })
      .eq("id", id)
      .select("id, name, created_at")
      .single();
    if (error) throw new Error(toFriendlyDepartmentError(error));
    return data as Department;
  } catch (err) {
    throw new Error(toFriendlyDepartmentError(err));
  }
}

/** Đếm nhân viên đang liên kết với phòng ban (dữ liệu thật). */
export async function countEmployeesInDepartment(departmentId: string): Promise<number> {
  try {
    const client = getSupabaseClient();
    const { count, error } = await client
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("department_id", departmentId);
    if (error) throw new Error(toFriendlyReadError(error));
    return count ?? 0;
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/**
 * Chuyển TOÀN BỘ nhân viên từ phòng ban nguồn sang phòng ban đích.
 * Chỉ cập nhật employees.department_id — không chạm chấm công/lịch sử.
 * Từ chối khi đích không tồn tại hoặc trùng nguồn.
 */
export async function transferEmployees(sourceId: string, targetId: string): Promise<number> {
  if (sourceId === targetId) throw new Error("Phòng ban đích phải khác phòng ban nguồn.");
  try {
    const client = getSupabaseClient();
    const { data: target, error: targetErr } = await client
      .from("departments")
      .select("id")
      .eq("id", targetId)
      .maybeSingle();
    if (targetErr) throw new Error(toFriendlyReadError(targetErr));
    if (!target) throw new Error("Phòng ban đích không tồn tại. Vui lòng chọn lại.");

    const { data, error } = await client
      .from("employees")
      .update({ department_id: targetId })
      .eq("department_id", sourceId)
      .select("id");
    if (error) throw new Error(toFriendlyDepartmentError(error));
    return (data ?? []).length;
  } catch (err) {
    throw new Error(toFriendlyDepartmentError(err));
  }
}

/**
 * Xóa phòng ban. CHẶN khi còn nhân viên liên kết — caller phải chuyển
 * nhân viên đi trước (transferEmployees) và xác nhận rõ ràng. Không bao
 * giờ xóa/chuyển ngầm, không chạm lịch sử chấm công.
 */
export async function deleteDepartment(id: string): Promise<void> {
  const count = await countEmployeesInDepartment(id);
  if (count > 0) {
    throw new Error(
      `Không thể xóa: còn ${count} nhân viên thuộc phòng ban này. ` +
        `Hãy chuyển họ sang phòng ban khác trước khi xóa. Lịch sử chấm công được giữ nguyên.`,
    );
  }
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("departments").delete().eq("id", id);
    if (error) throw new Error(toFriendlyDepartmentError(error));
  } catch (err) {
    throw new Error(toFriendlyDepartmentError(err));
  }
}
