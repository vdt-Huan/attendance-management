// Tầng gọi Supabase cho phân công ca + lịch làm việc (Ngày 4.2).
//
// Bám ĐÚNG schema thật trong supabase/migrations/0001_initial_schema.sql:
// - shift_assignments: id, employee_id (→ employees, CASCADE), shift_id
//   (→ work_shifts, RESTRICT), work_date (date NOT NULL), created_at,
//   UNIQUE (employee_id, work_date) → mỗi nhân viên TỐI ĐA 1 ca/ngày.
//   Hai ca "chồng lấn" cùng người cùng ngày = vi phạm unique → từ chối.
//   KHÔNG có cột trạng thái.
// - RLS: assignments_select_own_or_hr (nhân viên chỉ xem lịch mình),
//   assignments_write_hr (chỉ is_hr() được tạo/sửa/hủy). Employee không
//   có đường sửa lịch người khác — RLS chặn + UI ẩn.
// - Bảo vệ chấm công: attendance_records UNIQUE (employee_id, work_date).
//   Sửa/hủy phân công của ngày đã phát sinh chấm công bị CHẶN để giữ toàn
//   vẹn (chỉ đọc kiểm tra, không sửa/xóa attendance ở đây).
// - Không hard-code nhân viên/ca: mọi option lấy từ Supabase. Không
//   service-role key. Không migration (schema đã đủ).

import { getSupabaseClient } from "../lib/supabase";
import { shortTime } from "./workShifts";

export interface ScheduleAssignment {
  id: string;
  employee_id: string;
  shift_id: string;
  work_date: string;
  shift_name: string;
  shift_start: string;
  shift_end: string;
}

export interface ScheduleRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  department_name: string | null;
  is_active: boolean;
  /** key work_date (YYYY-MM-DD) → phân công. */
  byDate: Record<string, ScheduleAssignment>;
}

export interface AssignmentFormInput {
  employee_id: string;
  shift_id: string;
  work_date: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    return "Chưa tải được lịch làm việc. Vui lòng thử lại.";
  }
  return "Chưa tải được lịch làm việc. Vui lòng thử lại.";
}

export function toFriendlyAssignmentError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (raw.includes("23505") || raw.includes("duplicate") || raw.includes("already exists")) {
      return "Nhân viên đã có phân công trong ngày này (mỗi người 1 ca/ngày). Vui lòng sửa phân công hiện có thay vì tạo mới.";
    }
    if (raw.includes("23503") || raw.includes("foreign key")) {
      return "Nhân viên hoặc ca làm không tồn tại. Vui lòng chọn lại từ danh sách.";
    }
    if (raw.includes("42501") || raw.includes("permission denied") || raw.includes("row-level security")) {
      return "Bạn không có quyền thực hiện thao tác này. Chỉ HR/Admin được phân công ca.";
    }
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return "Thao tác chưa thành công. Vui lòng kiểm tra dữ liệu và thử lại.";
  }
  return "Thao tác chưa thành công. Vui lòng thử lại.";
}

// ---------------------------------------------------------------------------
// Tiện ích tuần (giờ VN là ngày date thuần, không dính múi giờ hiển thị)
// ---------------------------------------------------------------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Thứ Hai của tuần chứa mốc (tuần bắt đầu Thứ Hai). */
export function startOfWeek(anchor: Date): Date {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

export function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)));
}

const VN_WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function weekdayLabel(index: number): string {
  return VN_WEEKDAYS[index] ?? "";
}

// ---------------------------------------------------------------------------
// Đọc lịch tuần
// ---------------------------------------------------------------------------

export interface ScheduleFilter {
  employeeIds: string[];
  departmentId: string;
  shiftId: string;
  search: string;
  page: number;
  pageSize: number;
}

/**
 * Tải lịch tuần: nhân viên theo trang (lọc tìm kiếm/phòng ban) + toàn bộ
 * phân công của họ trong tuần. Lọc ca áp dụng trên phân công hiển thị.
 */
export async function listWeekSchedule(
  mondayISO: string,
  sundayISO: string,
  filter: ScheduleFilter,
): Promise<{ rows: ScheduleRow[]; totalEmployees: number }> {
  try {
    const client = getSupabaseClient();
    const from = filter.page * filter.pageSize;
    const to = from + filter.pageSize - 1;

    let empQuery = client
      .from("employees")
      .select("id, employee_code, full_name, department_id, is_active, departments(id, name)", {
        count: "exact",
      });
    if (filter.employeeIds.length > 0) empQuery = empQuery.in("id", filter.employeeIds);
    if (filter.departmentId === "unassigned") empQuery = empQuery.is("department_id", null);
    else if (filter.departmentId !== "all") empQuery = empQuery.eq("department_id", filter.departmentId);
    if (filter.search.trim()) {
      const q = filter.search.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
      empQuery = empQuery.or(`full_name.ilike.%${q}%,employee_code.ilike.%${q}%`);
    }
    empQuery = empQuery.order("full_name", { ascending: true }).range(from, to);

    const { data: empData, error: empErr, count } = await empQuery;
    if (empErr) throw new Error(toFriendlyReadError(empErr));

    type DeptEmbed = { name: string } | Array<{ name: string }> | null;
    const emps = ((empData ?? []) as unknown as Array<{
      id: string;
      employee_code: string;
      full_name: string;
      is_active: boolean;
      departments: DeptEmbed;
    }>).map((e) => ({
      ...e,
      departments: Array.isArray(e.departments) ? (e.departments[0] ?? null) : e.departments,
    }));
    if (emps.length === 0) return { rows: [], totalEmployees: count ?? 0 };

    const ids = emps.map((e) => e.id);
    let asgQuery = client
      .from("shift_assignments")
      .select("id, employee_id, shift_id, work_date, work_shifts(id, name, start_time, end_time)")
      .in("employee_id", ids)
      .gte("work_date", mondayISO)
      .lte("work_date", sundayISO);
    if (filter.shiftId !== "all") asgQuery = asgQuery.eq("shift_id", filter.shiftId);
    const { data: asgData, error: asgErr } = await asgQuery;
    if (asgErr) throw new Error(toFriendlyReadError(asgErr));

    type ShiftEmbed = { name: string; start_time: string; end_time: string } | Array<{
      name: string;
      start_time: string;
      end_time: string;
    }> | null;
    const byEmp = new Map<string, Record<string, ScheduleAssignment>>();
    for (const a of (asgData ?? []) as unknown as Array<{
      id: string;
      employee_id: string;
      shift_id: string;
      work_date: string;
      work_shifts: ShiftEmbed;
    }>) {
      const s = Array.isArray(a.work_shifts) ? (a.work_shifts[0] ?? null) : a.work_shifts;
      if (!s) continue;
      const rec: ScheduleAssignment = {
        id: String(a.id),
        employee_id: String(a.employee_id),
        shift_id: String(a.shift_id),
        work_date: String(a.work_date),
        shift_name: String(s.name),
        shift_start: shortTime(String(s.start_time)),
        shift_end: shortTime(String(s.end_time)),
      };
      const map = byEmp.get(rec.employee_id) ?? {};
      map[rec.work_date] = rec;
      byEmp.set(rec.employee_id, map);
    }

    return {
      rows: emps.map((e) => ({
        employee_id: e.id,
        employee_code: e.employee_code,
        full_name: e.full_name,
        department_name: e.departments?.name ?? null,
        is_active: e.is_active,
        byDate: byEmp.get(e.id) ?? {},
      })),
      totalEmployees: count ?? emps.length,
    };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/** Hồ sơ employee của chính user đang đăng nhập (qua user_id = auth uid). */
export async function getMyEmployeeId(): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const { data: session } = await client.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return null;
    const { data, error } = await client.from("employees").select("id").eq("user_id", uid).maybeSingle();
    if (error) throw new Error(toFriendlyReadError(error));
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

// ---------------------------------------------------------------------------
// Tạo / sửa / hủy phân công (HR/Admin — RLS siết thêm ở DB)
// ---------------------------------------------------------------------------

function validateAssignmentInput(input: AssignmentFormInput): string | null {
  if (!input.employee_id) return "Vui lòng chọn nhân viên.";
  if (!input.shift_id) return "Vui lòng chọn ca làm.";
  if (!input.work_date) return "Vui lòng chọn ngày làm việc.";
  if (!DATE_RE.test(input.work_date)) return "Ngày làm việc chưa đúng định dạng YYYY-MM-DD.";
  const d = new Date(`${input.work_date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Ngày làm việc không phải ngày hợp lệ.";
  return null;
}

/** Kiểm tra nhân viên/ca có tồn tại và nhân viên đang hoạt động. */
async function assertAssignable(employeeId: string, shiftId: string): Promise<void> {
  const client = getSupabaseClient();
  const [{ data: emp, error: empErr }, { data: shift, error: shiftErr }] = await Promise.all([
    client.from("employees").select("id, is_active").eq("id", employeeId).maybeSingle(),
    client.from("work_shifts").select("id").eq("id", shiftId).maybeSingle(),
  ]);
  if (empErr) throw new Error(toFriendlyAssignmentError(empErr));
  if (shiftErr) throw new Error(toFriendlyAssignmentError(shiftErr));
  if (!emp) throw new Error("Nhân viên không tồn tại (có thể đã bị xóa). Vui lòng chọn lại.");
  if ((emp as { is_active: boolean }).is_active === false) {
    throw new Error("Nhân viên đang ngừng hoạt động nên không thể phân công ca mới.");
  }
  if (!shift) throw new Error("Ca làm không tồn tại (có thể đã bị xóa). Vui lòng chọn lại.");
}

/** Ngày đã phát sinh chấm công chưa (bảo vệ toàn vẹn khi sửa/hủy). */
async function hasAttendance(employeeId: string, workDate: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("work_date", workDate)
    .limit(1);
  if (error) throw new Error(toFriendlyAssignmentError(error));
  return (data ?? []).length > 0;
}

export async function createAssignment(input: AssignmentFormInput): Promise<void> {
  const invalid = validateAssignmentInput(input);
  if (invalid) throw new Error(invalid);
  await assertAssignable(input.employee_id, input.shift_id);
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("shift_assignments").insert({
      employee_id: input.employee_id,
      shift_id: input.shift_id,
      work_date: input.work_date,
    });
    if (error) throw new Error(toFriendlyAssignmentError(error));
  } catch (err) {
    throw new Error(toFriendlyAssignmentError(err));
  }
}

export async function updateAssignment(
  id: string,
  input: AssignmentFormInput,
): Promise<void> {
  const invalid = validateAssignmentInput(input);
  if (invalid) throw new Error(invalid);
  await assertAssignable(input.employee_id, input.shift_id);
  try {
    const client = getSupabaseClient();
    const { data: current, error: curErr } = await client
      .from("shift_assignments")
      .select("id, employee_id, work_date")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(toFriendlyAssignmentError(curErr));
    if (!current) throw new Error("Phân công không tồn tại (có thể đã bị hủy).");
    const cur = current as { employee_id: string; work_date: string };
    // Ngày cũ đã có chấm công → chặn sửa để giữ toàn vẹn (ghi nhận rõ).
    if (await hasAttendance(cur.employee_id, cur.work_date)) {
      throw new Error(
        `Ngày ${cur.work_date} đã phát sinh bản ghi chấm công nên không thể sửa phân công. ` +
          `Trường hợp bị chặn đã được ghi nhận — liên hệ HR để xử lý nghiệp vụ.`,
      );
    }
    const { error } = await client
      .from("shift_assignments")
      .update({
        employee_id: input.employee_id,
        shift_id: input.shift_id,
        work_date: input.work_date,
      })
      .eq("id", id);
    if (error) throw new Error(toFriendlyAssignmentError(error));
  } catch (err) {
    throw new Error(toFriendlyAssignmentError(err));
  }
}

export async function deleteAssignment(id: string): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { data: current, error: curErr } = await client
      .from("shift_assignments")
      .select("id, employee_id, work_date")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(toFriendlyAssignmentError(curErr));
    if (!current) throw new Error("Phân công không tồn tại (có thể đã bị hủy).");
    const cur = current as { employee_id: string; work_date: string };
    // Ngày đã có chấm công → chặn hủy, không xóa lịch sử chấm công.
    if (await hasAttendance(cur.employee_id, cur.work_date)) {
      throw new Error(
        `Ngày ${cur.work_date} đã phát sinh bản ghi chấm công nên không thể hủy phân công. ` +
          `Trường hợp bị chặn đã được ghi nhận — bản ghi chấm công được giữ nguyên.`,
      );
    }
    const { error } = await client.from("shift_assignments").delete().eq("id", id);
    if (error) throw new Error(toFriendlyAssignmentError(error));
  } catch (err) {
    throw new Error(toFriendlyAssignmentError(err));
  }
}
