// Tầng gọi Supabase cho quản lý nhân viên (Ngày 3.1).
//
// NGUYÊN TẮC:
// - Chỉ dùng anon/publishable key qua getSupabaseClient() — KHÔNG bao giờ
//   dùng service-role key trong frontend.
// - Bảo mật thật nằm ở RLS (employees_write_hr: chỉ is_hr() được ghi;
//   employees_select_own_or_hr: nhân viên chỉ thấy dòng của mình).
//   Frontend chỉ ẩn nút cho gọn + chuyển lỗi 42501 thành thông điệp rõ.
// - Chỉ đọc/ghi ĐÚNG cột trong migration 0001: employee_code, full_name,
//   department_id, phone, hire_date, is_active, user_id. Không chạm
//   id/created_at/updated_at.
// - Email nhân viên KHÔNG nằm ở bảng employees — lấy từ profiles.email
//   qua employees.user_id (2 truy vấn riêng để không phụ thuộc tên
//   constraint FK do PostgREST sinh tự động).

import { getSupabaseClient } from "../lib/supabase";
import type {
  AttendanceView,
  Department,
  EmployeeDetail,
  EmployeeFieldErrors,
  EmployeeFormInput,
  EmployeeListParams,
  EmployeeListResult,
  EmployeeWithRefs,
  LeaveView,
  LinkedProfile,
  RelatedCounts,
  ShiftAssignmentView,
} from "../types/employees";

const CODE_RE = /^[A-Za-z0-9_-]{2,20}$/;
const PHONE_DIGITS_RE = /^[+()\-.\s]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate frontend — trả về map lỗi theo trường, rỗng = hợp lệ. */
export function validateEmployeeForm(input: EmployeeFormInput): EmployeeFieldErrors {
  const errors: EmployeeFieldErrors = {};

  const code = input.employee_code.trim();
  if (!code) {
    errors.employee_code = "Vui lòng nhập mã nhân viên.";
  } else if (!CODE_RE.test(code)) {
    errors.employee_code = "Mã nhân viên 2–20 ký tự, chỉ gồm chữ, số, gạch ngang/gạch dưới.";
  }

  if (!input.full_name.trim()) {
    errors.full_name = "Vui lòng nhập họ tên nhân viên.";
  } else if (input.full_name.trim().length > 200) {
    errors.full_name = "Họ tên không được vượt quá 200 ký tự.";
  }

  if (input.phone != null && input.phone.trim() !== "") {
    const phone = input.phone.trim();
    const digits = phone.replace(/\D/g, "");
    if (!PHONE_DIGITS_RE.test(phone) || digits.length < 8 || digits.length > 15) {
      errors.phone = "Số điện thoại 8–15 chữ số (được phép +, khoảng trắng, gạch ngang).";
    } else if (phone.length > 30) {
      errors.phone = "Số điện thoại không được vượt quá 30 ký tự.";
    }
  }

  if (input.hire_date != null && input.hire_date !== "") {
    if (!DATE_RE.test(input.hire_date)) {
      errors.hire_date = "Ngày vào làm chưa đúng định dạng YYYY-MM-DD.";
    } else {
      const d = new Date(`${input.hire_date}T00:00:00`);
      if (Number.isNaN(d.getTime())) {
        errors.hire_date = "Ngày vào làm không phải ngày hợp lệ.";
      }
    }
  }

  if (input.user_id != null && input.user_id.trim() !== "") {
    if (!UUID_RE.test(input.user_id.trim())) {
      errors.user_id = "Mã tài khoản liên kết phải là UUID của profiles.id.";
    }
  }

  return errors;
}

function hasFieldErrors(e: EmployeeFieldErrors): boolean {
  return Object.values(e).some((v) => v != null && v !== "");
}

/** Chuẩn hóa input trước khi gửi: trim, rỗng → null. */
export function normalizeEmployeeInput(input: EmployeeFormInput): EmployeeFormInput {
  const phone = input.phone?.trim() ? input.phone.trim() : null;
  const hire = input.hire_date?.trim() ? input.hire_date.trim() : null;
  const userId = input.user_id?.trim() ? input.user_id.trim() : null;
  const dept = input.department_id?.trim() ? input.department_id.trim() : null;
  return {
    employee_code: input.employee_code.trim(),
    full_name: input.full_name.trim(),
    department_id: dept,
    phone,
    hire_date: hire,
    is_active: input.is_active,
    user_id: userId,
  };
}

/**
 * Chuyển lỗi Supabase/PostgREST thành thông điệp tiếng Việt thân thiện.
 * Không lộ chi tiết kỹ thuật nhạy cảm (không in SQL, constraint nội bộ).
 */
export function toFriendlyEmployeeError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    const msg = err.message;
    // Trùng unique (mã nhân viên / user_id đã liên kết).
    if (raw.includes("23505") || raw.includes("duplicate") || raw.includes("already exists")) {
      if (raw.includes("employee_code") || raw.includes("mã nhân viên")) {
        return "Mã nhân viên đã tồn tại. Vui lòng dùng mã khác.";
      }
      if (raw.includes("user_id")) {
        return "Tài khoản này đã liên kết với một hồ sơ nhân viên khác.";
      }
      return "Dữ liệu bị trùng với bản ghi đã có. Vui lòng kiểm tra lại mã nhân viên.";
    }
    // Vi phạm khóa ngoại (phòng ban / tài khoản không tồn tại).
    if (raw.includes("23503") || raw.includes("foreign key") || raw.includes("violates")) {
      return "Phòng ban hoặc tài khoản liên kết không tồn tại. Vui lòng chọn lại.";
    }
    // Không đủ quyền (RLS chặn).
    if (raw.includes("42501") || raw.includes("permission denied") || raw.includes("row-level security")) {
      return "Bạn không có quyền thực hiện thao tác này. Chỉ HR/Admin được quản lý nhân viên.";
    }
    if (raw.includes("22p02") || raw.includes("invalid input syntax") || raw.includes("invalid uuid")) {
      return "Mã định danh không hợp lệ. Vui lòng tải lại và thử lại.";
    }
    // Giữ message tiếng Việt do service/validate tự ném.
    if (/[\u00C0-\u1EF9]/.test(msg)) return msg;
    return "Thao tác chưa thành công. Vui lòng kiểm tra dữ liệu và thử lại.";
  }
  return "Thao tác chưa thành công. Vui lòng thử lại.";
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
    return "Chưa tải được dữ liệu nhân viên. Vui lòng thử lại.";
  }
  return "Chưa tải được dữ liệu nhân viên. Vui lòng thử lại.";
}

// ---------------------------------------------------------------------------
// Phòng ban
// ---------------------------------------------------------------------------

export async function listDepartments(): Promise<Department[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("departments")
      .select("id, name, created_at")
      .order("name", { ascending: true })
      .limit(200);
    if (error) throw new Error(toFriendlyReadError(error));
    return (data ?? []) as Department[];
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

// ---------------------------------------------------------------------------
// Danh sách nhân viên (tìm kiếm + lọc + sắp xếp + phân trang ở server)
// ---------------------------------------------------------------------------

const EMPLOYEE_SELECT =
  "id, user_id, employee_code, full_name, department_id, phone, hire_date, is_active, created_at, updated_at, departments(id, name)";

interface EmployeeRowRaw {
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
  departments: { id: string; name: string } | null;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

export async function listEmployees(params: EmployeeListParams): Promise<EmployeeListResult> {
  const page = Math.max(0, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), 50);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const search = params.search.trim();

  try {
    const client = getSupabaseClient();

    // Email nằm ở profiles — tra cứu riêng để hỗ trợ tìm theo email mà
    // không phụ thuộc tên constraint FK. HR đọc được mọi profile nhờ
    // policy profiles_select_own (is_hr()).
    let emailUserIds: string[] | null = null;
    if (search) {
      const { data: matched } = await client
        .from("profiles")
        .select("id")
        .ilike("email", `%${escapeLike(search)}%`)
        .limit(20);
      emailUserIds = (matched ?? []).map((r) => String((r as { id: string }).id));
    }

    let query = client.from("employees").select(EMPLOYEE_SELECT, { count: "exact" });

    if (search) {
      const clauses = [
        `full_name.ilike.%${escapeLike(search)}%`,
        `employee_code.ilike.%${escapeLike(search)}%`,
      ];
      if (emailUserIds && emailUserIds.length > 0) {
        clauses.push(`user_id.in.(${emailUserIds.join(",")})`);
      }
      query = query.or(clauses.join(","));
    }
    if (params.departmentId === "unassigned") {
      query = query.is("department_id", null);
    } else if (params.departmentId !== "all") {
      query = query.eq("department_id", params.departmentId);
    }
    if (params.status === "active") query = query.eq("is_active", true);
    if (params.status === "inactive") query = query.eq("is_active", false);

    query = query
      .order(params.sortField, { ascending: params.sortDirection === "asc" })
      .range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(toFriendlyReadError(error));

    const rows = (data ?? []) as unknown as EmployeeRowRaw[];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
    let emailByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await client.from("profiles").select("id, email").in("id", userIds);
      emailByUser = new Map(
        ((profs ?? []) as Array<{ id: string; email: string }>).map((p) => [String(p.id), String(p.email)]),
      );
    }

    const items: EmployeeWithRefs[] = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      department_id: r.department_id,
      phone: r.phone,
      hire_date: r.hire_date,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      department_name: r.departments?.name ?? null,
      profile_email: r.user_id ? (emailByUser.get(r.user_id) ?? null) : null,
    }));
    return { items, total: count ?? items.length };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

// ---------------------------------------------------------------------------
// Chi tiết nhân viên + dữ liệu liên quan (không tạo dữ liệu giả)
// ---------------------------------------------------------------------------

export async function getEmployeeDetail(id: string): Promise<EmployeeDetail> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("employees")
      .select(EMPLOYEE_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(toFriendlyReadError(error));
    if (!data) throw new Error("Không tìm thấy hồ sơ nhân viên. Có thể bản ghi đã bị xóa.");

    const row = data as unknown as EmployeeRowRaw;
    const base: EmployeeWithRefs = {
      id: row.id,
      user_id: row.user_id,
      employee_code: row.employee_code,
      full_name: row.full_name,
      department_id: row.department_id,
      phone: row.phone,
      hire_date: row.hire_date,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      department_name: row.departments?.name ?? null,
      profile_email: null,
    };

    let department: Department | null = null;
    if (row.department_id) {
      const { data: dept } = await client
        .from("departments")
        .select("id, name, created_at")
        .eq("id", row.department_id)
        .maybeSingle();
      if (dept) department = dept as Department;
    }

    let linkedProfile: LinkedProfile | null = null;
    if (row.user_id) {
      const { data: prof } = await client
        .from("profiles")
        .select("id, email, full_name")
        .eq("id", row.user_id)
        .maybeSingle();
      if (prof) {
        const p = prof as { id: string; email: string; full_name: string };
        linkedProfile = { id: String(p.id), email: String(p.email), full_name: String(p.full_name) };
        base.profile_email = linkedProfile.email;
      }
    }

    // Dữ liệu liên quan: đọc thật, thiếu thì trả mảng rỗng (empty state).
    const [assignRes, attendRes, leaveRes] = await Promise.all([
      client
        .from("shift_assignments")
        .select("id, work_date, shift_id, work_shifts(id, name, start_time, end_time)")
        .eq("employee_id", id)
        .order("work_date", { ascending: false })
        .limit(30),
      client
        .from("attendance_records")
        .select("id, work_date, check_in, check_out, status, confirmed_at")
        .eq("employee_id", id)
        .order("work_date", { ascending: false })
        .limit(30),
      client
        .from("leave_requests")
        .select("id, start_date, end_date, reason, status, created_at")
        .eq("employee_id", id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    type ShiftEmbed = { name: string; start_time: string; end_time: string } | Array<{
      name: string;
      start_time: string;
      end_time: string;
    }> | null;
    const assignments: ShiftAssignmentView[] = ((assignRes.data ?? []) as unknown as Array<{
      id: string;
      work_date: string;
      work_shifts: ShiftEmbed;
    }>).map((a) => {
      const s = Array.isArray(a.work_shifts) ? (a.work_shifts[0] ?? null) : a.work_shifts;
      return {
        id: String(a.id),
        work_date: String(a.work_date),
        shift_name: s?.name ?? null,
        start_time: s?.start_time ?? null,
        end_time: s?.end_time ?? null,
      };
    });

    const attendance: AttendanceView[] = ((attendRes.data ?? []) as Array<{
      id: string;
      work_date: string;
      check_in: string | null;
      check_out: string | null;
      status: string;
      confirmed_at: string | null;
    }>).map((a) => ({
      id: String(a.id),
      work_date: String(a.work_date),
      check_in: a.check_in,
      check_out: a.check_out,
      status: String(a.status),
      confirmed_at: a.confirmed_at,
    }));

    const leaveRequests: LeaveView[] = ((leaveRes.data ?? []) as Array<{
      id: string;
      start_date: string;
      end_date: string;
      reason: string;
      status: string;
      created_at: string;
    }>).map((l) => ({
      id: String(l.id),
      start_date: String(l.start_date),
      end_date: String(l.end_date),
      reason: String(l.reason),
      status: String(l.status),
      created_at: String(l.created_at),
    }));

    return { ...base, department, linkedProfile, assignments, attendance, leaveRequests };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

// ---------------------------------------------------------------------------
// Tạo / sửa — chỉ các trường được phép
// ---------------------------------------------------------------------------

export async function createEmployee(input: EmployeeFormInput): Promise<EmployeeWithRefs> {
  const normalized = normalizeEmployeeInput(input);
  const fieldErrors = validateEmployeeForm(normalized);
  if (hasFieldErrors(fieldErrors)) {
    const first = Object.values(fieldErrors).find((v) => v) ?? "Dữ liệu nhập chưa hợp lệ.";
    throw new Error(first);
  }
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from("employees")
      .insert({
        employee_code: normalized.employee_code,
        full_name: normalized.full_name,
        department_id: normalized.department_id,
        phone: normalized.phone,
        hire_date: normalized.hire_date,
        is_active: normalized.is_active,
        user_id: normalized.user_id,
      })
      .select(EMPLOYEE_SELECT)
      .single();
    if (error) throw new Error(toFriendlyEmployeeError(error));
    const r = data as unknown as EmployeeRowRaw;
    return {
      id: r.id,
      user_id: r.user_id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      department_id: r.department_id,
      phone: r.phone,
      hire_date: r.hire_date,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      department_name: r.departments?.name ?? null,
      profile_email: null,
    };
  } catch (err) {
    throw new Error(toFriendlyEmployeeError(err));
  }
}

export async function updateEmployee(id: string, input: EmployeeFormInput): Promise<EmployeeWithRefs> {
  const normalized = normalizeEmployeeInput(input);
  const fieldErrors = validateEmployeeForm(normalized);
  if (hasFieldErrors(fieldErrors)) {
    const first = Object.values(fieldErrors).find((v) => v) ?? "Dữ liệu nhập chưa hợp lệ.";
    throw new Error(first);
  }
  try {
    const client = getSupabaseClient();
    // CHỈ cập nhật 7 trường được phép — không chạm id/created_at/updated_at.
    const { data, error } = await client
      .from("employees")
      .update({
        employee_code: normalized.employee_code,
        full_name: normalized.full_name,
        department_id: normalized.department_id,
        phone: normalized.phone,
        hire_date: normalized.hire_date,
        is_active: normalized.is_active,
        user_id: normalized.user_id,
      })
      .eq("id", id)
      .select(EMPLOYEE_SELECT)
      .single();
    if (error) throw new Error(toFriendlyEmployeeError(error));
    const r = data as unknown as EmployeeRowRaw;
    return {
      id: r.id,
      user_id: r.user_id,
      employee_code: r.employee_code,
      full_name: r.full_name,
      department_id: r.department_id,
      phone: r.phone,
      hire_date: r.hire_date,
      is_active: r.is_active,
      created_at: r.created_at,
      updated_at: r.updated_at,
      department_name: r.departments?.name ?? null,
      profile_email: null,
    };
  } catch (err) {
    throw new Error(toFriendlyEmployeeError(err));
  }
}

export async function setEmployeeActive(id: string, isActive: boolean): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("employees").update({ is_active: isActive }).eq("id", id);
    if (error) throw new Error(toFriendlyEmployeeError(error));
  } catch (err) {
    throw new Error(toFriendlyEmployeeError(err));
  }
}

// ---------------------------------------------------------------------------
// Xóa: kiểm tra ràng buộc khóa ngoại trước; ưu tiên vô hiệu hóa
// ---------------------------------------------------------------------------

export async function countRelatedRecords(id: string): Promise<RelatedCounts> {
  try {
    const client = getSupabaseClient();
    const [a, b, c] = await Promise.all([
      client.from("shift_assignments").select("id", { count: "exact", head: true }).eq("employee_id", id),
      client.from("attendance_records").select("id", { count: "exact", head: true }).eq("employee_id", id),
      client.from("leave_requests").select("id", { count: "exact", head: true }).eq("employee_id", id),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    if (c.error) throw c.error;
    return {
      assignments: a.count ?? 0,
      attendance: b.count ?? 0,
      leaveRequests: c.count ?? 0,
    };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/**
 * Xóa nhân viên. Nếu còn dữ liệu liên quan (phân ca / chấm công / đơn
 * nghỉ) thì TỪ CHỐI xóa để giữ lịch sử — caller phải dùng vô hiệu hóa
 * (is_active = false). Không xóa dây chuyền dữ liệu lịch sử.
 */
export async function deleteEmployee(id: string): Promise<void> {
  const related = await countRelatedRecords(id);
  const total = related.assignments + related.attendance + related.leaveRequests;
  if (total > 0) {
    throw new Error(
      `Không thể xóa: nhân viên còn ${total} bản ghi liên quan ` +
        `(phân ca: ${related.assignments}, chấm công: ${related.attendance}, đơn nghỉ: ${related.leaveRequests}). ` +
        `Hãy dùng "Vô hiệu hóa" để giữ lại lịch sử.`,
    );
  }
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("employees").delete().eq("id", id);
    if (error) throw new Error(toFriendlyEmployeeError(error));
  } catch (err) {
    throw new Error(toFriendlyEmployeeError(err));
  }
}
