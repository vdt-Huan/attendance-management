// Tầng gọi Supabase cho quản lý ca làm việc (Ngày 4.1).
//
// Bám ĐÚNG schema thật trong supabase/migrations/0001_initial_schema.sql:
// - work_shifts: id (uuid PK), name (text NOT NULL, KHÔNG unique), start_time
//   (time NOT NULL), end_time (time NOT NULL), late_after_minutes (int,
//   default 15, CHECK >= 0), created_at, CHECK (start_time <> end_time).
//   KHÔNG có: mã ca, giờ nghỉ giữa ca, trạng thái/is_active → không vô hiệu
//   hóa, không migration.
// - Giờ lưu kiểu `time` (không ngày, không múi giờ) → gửi nguyên chuỗi
//   "HH:MM", TUYỆT ĐỐI không quy đổi múi giờ/ngày.
// - Ca qua đêm: schema chỉ cấm start = end nên end < start (VD 22:00–06:00)
//   được cho phép ngầm → hỗ trợ và tính thời lượng = 24h - start + end.
// - Trùng tên: DB không unique → kiểm tra trùng (không phân biệt hoa/thường)
//   ở tầng app như quy tắc nghiệp vụ trước khi ghi.
// - Xóa: shift_assignments.shift_id ON DELETE RESTRICT → DB đã chặn xóa ca
//   đang phân công; service đếm trước để báo rõ ràng, không xóa cứng.
// - RLS: shifts_select_auth (mọi authenticated được đọc), shifts_write_hr
//   (chỉ is_hr() được ghi). Không vô hiệu hóa RLS.

import { getSupabaseClient } from "../lib/supabase";

export interface WorkShift {
  id: string;
  name: string;
  /** Chuỗi "HH:MM(:SS)" như DB trả về cho kiểu time. */
  start_time: string;
  end_time: string;
  late_after_minutes: number;
  created_at: string;
}

export interface WorkShiftWithCount extends WorkShift {
  /** Số lượt phân công ca này — đếm THẬT bằng count exact trên DB. */
  assignmentCount: number;
}

export type ShiftSortField = "name" | "start_time" | "created_at";
export type ShiftSortDirection = "asc" | "desc";

export interface ShiftListParams {
  search: string;
  page: number;
  pageSize: number;
  sortField: ShiftSortField;
  sortDirection: ShiftSortDirection;
}

export interface ShiftListResult {
  items: WorkShiftWithCount[];
  total: number;
}

export interface ShiftFormInput {
  name: string;
  start_time: string;
  end_time: string;
  late_after_minutes: number;
}

export const SHIFT_PAGE_SIZE = 10;
const MAX_NAME_LENGTH = 100;
const MAX_LATE_MINUTES = 120;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
}

/** "HH:MM" hoặc "HH:MM:SS" → số phút từ 0h. null khi sai định dạng. */
export function timeToMinutes(value: string): number | null {
  const m = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Rút gọn "HH:MM:SS" của DB thành "HH:MM" để hiển thị và điền vào input. */
export function shortTime(value: string): string {
  const m = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return m ? `${m[1]}:${m[2]}` : value;
}

/**
 * Thời lượng ca (phút). Ca qua đêm (end <= start theo phút, VD 22:00–06:00)
 * tính vòng qua nửa đêm: 24h - start + end. start = end đã bị CHECK ở DB
 * và validate ở app chặn trước.
 */
export function shiftDurationMinutes(start: string, end: string): number | null {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s == null || e == null || s === e) return null;
  return e > s ? e - s : 24 * 60 - s + e;
}

export function isOvernightShift(start: string, end: string): boolean {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  return s != null && e != null && e < s;
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

export type ShiftFieldErrors = Partial<Record<keyof ShiftFormInput, string>>;

/** Validate frontend: tên + giờ bắt buộc, đúng định dạng, khác nhau. */
export function validateShiftForm(input: ShiftFormInput): ShiftFieldErrors {
  const errors: ShiftFieldErrors = {};
  if (!input.name.trim()) {
    errors.name = "Vui lòng nhập tên ca.";
  } else if (input.name.trim().length > MAX_NAME_LENGTH) {
    errors.name = `Tên ca không được vượt quá ${MAX_NAME_LENGTH} ký tự.`;
  }
  if (!input.start_time) {
    errors.start_time = "Vui lòng chọn giờ bắt đầu.";
  } else if (!TIME_RE.test(input.start_time)) {
    errors.start_time = "Giờ bắt đầu chưa đúng định dạng HH:MM.";
  }
  if (!input.end_time) {
    errors.end_time = "Vui lòng chọn giờ kết thúc.";
  } else if (!TIME_RE.test(input.end_time)) {
    errors.end_time = "Giờ kết thúc chưa đúng định dạng HH:MM.";
  }
  if (
    TIME_RE.test(input.start_time) &&
    TIME_RE.test(input.end_time) &&
    input.start_time === input.end_time
  ) {
    errors.end_time = "Giờ kết thúc phải khác giờ bắt đầu (ca qua đêm VD 22:00–06:00 vẫn hợp lệ).";
  }
  if (
    !Number.isInteger(input.late_after_minutes) ||
    input.late_after_minutes < 0 ||
    input.late_after_minutes > MAX_LATE_MINUTES
  ) {
    errors.late_after_minutes = `Số phút cho phép muộn phải là số nguyên 0–${MAX_LATE_MINUTES}.`;
  }
  return errors;
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
    return "Chưa tải được dữ liệu ca làm việc. Vui lòng thử lại.";
  }
  return "Chưa tải được dữ liệu ca làm việc. Vui lòng thử lại.";
}

export function toFriendlyShiftError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (raw.includes("23505") || raw.includes("duplicate") || raw.includes("already exists")) {
      return "Dữ liệu bị trùng với bản ghi đã có. Vui lòng kiểm tra lại.";
    }
    if (raw.includes("23514") || raw.includes("check constraint")) {
      return "Giờ ca hoặc số phút cho phép muộn không hợp lệ. Vui lòng kiểm tra lại.";
    }
    if (raw.includes("23503") || raw.includes("foreign key") || raw.includes("restrict")) {
      return "Ca này đang được phân công cho nhân viên nên không thể xóa. Hãy gỡ phân công trước.";
    }
    if (raw.includes("42501") || raw.includes("permission denied") || raw.includes("row-level security")) {
      return "Bạn không có quyền thực hiện thao tác này. Chỉ HR/Admin được quản lý ca làm việc.";
    }
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return "Thao tác chưa thành công. Vui lòng kiểm tra dữ liệu và thử lại.";
  }
  return "Thao tác chưa thành công. Vui lòng thử lại.";
}

export async function listShiftsPaged(params: ShiftListParams): Promise<ShiftListResult> {
  const page = Math.max(0, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), 50);
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const search = params.search.trim();

  try {
    const client = getSupabaseClient();
    let query = client
      .from("work_shifts")
      .select("id, name, start_time, end_time, late_after_minutes, created_at", { count: "exact" });
    if (search) query = query.ilike("name", `%${escapeLike(search)}%`);
    query = query.order(params.sortField, { ascending: params.sortDirection === "asc" }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(toFriendlyReadError(error));

    const rows = (data ?? []) as WorkShift[];
    const counts = await Promise.all(
      rows.map(async (s) => {
        const { count: c, error: cErr } = await client
          .from("shift_assignments")
          .select("id", { count: "exact", head: true })
          .eq("shift_id", s.id);
        if (cErr) throw cErr;
        return c ?? 0;
      }),
    );
    return {
      items: rows.map((s, i) => ({ ...s, assignmentCount: counts[i] ?? 0 })),
      total: count ?? rows.length,
    };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/**
 * Quy tắc nghiệp vụ: tránh 2 ca trùng tên (không phân biệt hoa/thường).
 * Schema không có unique nên đây là kiểm tra tầng app; `excludeId` dùng khi
 * sửa để bỏ qua chính bản ghi đang sửa.
 */
async function assertUniqueName(name: string, excludeId?: string): Promise<void> {
  const client = getSupabaseClient();
  let query = client.from("work_shifts").select("id").ilike("name", name.trim());
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(toFriendlyShiftError(error));
  if ((data ?? []).length > 0) {
    throw new Error(`Đã có ca tên “${name.trim()}”. Vui lòng dùng tên khác.`);
  }
}

function normalizeInput(input: ShiftFormInput): ShiftFormInput {
  return {
    name: input.name.trim(),
    start_time: input.start_time,
    end_time: input.end_time,
    late_after_minutes: input.late_after_minutes,
  };
}

export async function createShift(input: ShiftFormInput): Promise<WorkShift> {
  const normalized = normalizeInput(input);
  const fieldErrors = validateShiftForm(normalized);
  const first = Object.values(fieldErrors).find((v) => v);
  if (first) throw new Error(first);
  await assertUniqueName(normalized.name);
  try {
    const client = getSupabaseClient();
    // Gửi nguyên "HH:MM" cho cột time — không quy đổi múi giờ/ngày.
    const { data, error } = await client
      .from("work_shifts")
      .insert({
        name: normalized.name,
        start_time: normalized.start_time,
        end_time: normalized.end_time,
        late_after_minutes: normalized.late_after_minutes,
      })
      .select("id, name, start_time, end_time, late_after_minutes, created_at")
      .single();
    if (error) throw new Error(toFriendlyShiftError(error));
    return data as WorkShift;
  } catch (err) {
    throw new Error(toFriendlyShiftError(err));
  }
}

export async function updateShift(id: string, input: ShiftFormInput): Promise<WorkShift> {
  const normalized = normalizeInput(input);
  const fieldErrors = validateShiftForm(normalized);
  const first = Object.values(fieldErrors).find((v) => v);
  if (first) throw new Error(first);
  await assertUniqueName(normalized.name, id);
  try {
    const client = getSupabaseClient();
    // CHỈ cập nhật 4 trường nghiệp vụ — không chạm id/created_at.
    const { data, error } = await client
      .from("work_shifts")
      .update({
        name: normalized.name,
        start_time: normalized.start_time,
        end_time: normalized.end_time,
        late_after_minutes: normalized.late_after_minutes,
      })
      .eq("id", id)
      .select("id, name, start_time, end_time, late_after_minutes, created_at")
      .single();
    if (error) throw new Error(toFriendlyShiftError(error));
    return data as WorkShift;
  } catch (err) {
    throw new Error(toFriendlyShiftError(err));
  }
}

/** Số lượt phân công đang dùng ca này (dữ liệu thật). */
export async function countShiftAssignments(shiftId: string): Promise<number> {
  try {
    const client = getSupabaseClient();
    const { count, error } = await client
      .from("shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shiftId);
    if (error) throw new Error(toFriendlyReadError(error));
    return count ?? 0;
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/**
 * Xóa ca. CHẶN khi còn phân công (giữ lịch sử; FK RESTRICT cũng chặn ở DB).
 * Schema không có trạng thái ngừng hoạt động nên không có vô hiệu hóa.
 */
export async function deleteShift(id: string): Promise<void> {
  const count = await countShiftAssignments(id);
  if (count > 0) {
    throw new Error(
      `Không thể xóa: ca này còn ${count} lượt phân công cho nhân viên. ` +
        `Hãy gỡ phân công trước khi xóa để giữ lịch sử.`,
    );
  }
  try {
    const client = getSupabaseClient();
    const { error } = await client.from("work_shifts").delete().eq("id", id);
    if (error) throw new Error(toFriendlyShiftError(error));
  } catch (err) {
    throw new Error(toFriendlyShiftError(err));
  }
}
