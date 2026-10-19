// Tầng gọi RPC chấm công (Ngày 5.1).
//
// NGUYÊN TẮC:
// - Employee CHỈ được chấm công qua RPC clock_in/clock_out (SECURITY DEFINER).
// - RPC tự kiểm tra: employee.user_id = auth.uid(), is_active, trùng ngày,
//   thứ tự check-in → check-out, bản ghi đã xác nhận.
// - Frontend KHÔNG bao giờ INSERT/UPDATE trực tiếp attendance_records.
// - Thời gian do DB ghi (now()) — không tin thời gian client.
// - Ghi chú tối đa 1000 ký tự (theo RPC).
// - Lỗi từ RPC chuyển thành thông điệp tiếng Việt thân thiện, không lộ chi tiết kỹ thuật.

import { getSupabaseClient } from "../lib/supabase";

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  status: "dung-gio" | "di-muon" | "ve-som" | "vang";
  note: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type CheckinStatus = "none" | "checked_in" | "checked_out" | "confirmed";

export interface TodayAttendance {
  /** Có bản ghi hôm nay không. */
  hasRecord: boolean;
  /** Trạng thái hiển thị cho UI. */
  status: CheckinStatus;
  /** Bản ghi đầy đủ nếu có. */
  record: AttendanceRecord | null;
  /** Ca làm việc hôm nay (nếu có phân công). */
  shift: { name: string; start_time: string; end_time: string; late_after_minutes: number } | null;
}

function toFriendlyClockError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (raw.includes("không tìm thấy hồ sơ nhân viên") || raw.includes("not found")) {
      return "Không tìm thấy hồ sơ nhân viên. Vui lòng liên hệ HR.";
    }
    if (raw.includes("chỉ được chấm công cho chính mình") || raw.includes("owner")) {
      return "Bạn chỉ được chấm công cho chính mình.";
    }
    if (raw.includes("hồ sơ nhân viên đã bị vô hiệu hóa") || raw.includes("inactive")) {
      return "Hồ sơ nhân viên đã bị vô hiệu hóa. Liên hệ HR.";
    }
    if (raw.includes("hôm nay đã có bản ghi chấm công") || raw.includes("already")) {
      return "Hôm nay bạn đã check-in rồi. Hãy bấm giờ ra.";
    }
    if (raw.includes("chưa có giờ vào") || raw.includes("check.*in.*trước")) {
      return "Chưa check-in hôm nay. Hãy bấm giờ vào trước.";
    }
    if (raw.includes("bản ghi thiếu giờ vào") || raw.includes("missing check")) {
      return "Dữ liệu check-in không hợp lệ. Liên hệ HR.";
    }
    if (raw.includes("đã được xác nhận") || raw.includes("confirmed")) {
      return "Bản ghi đã được xác nhận, không thể sửa.";
    }
    if (raw.includes("đã bấm giờ ra") || raw.includes("check.*out.*rồi")) {
      return "Hôm nay bạn đã check-out rồi.";
    }
    if (raw.includes("ghi chú không được vượt quá") || raw.includes("note.*1000")) {
      return "Ghi chú không được vượt quá 1000 ký tự.";
    }
    if (raw.includes("failed to fetch") || raw.includes("networkerror") || raw.includes("fetch failed") || raw.includes("timeout")) {
      return "Không kết nối được tới máy chủ. Kiểm tra mạng rồi thử lại.";
    }
    if (raw.includes("42501") || raw.includes("permission denied") || raw.includes("row-level security")) {
      return "Bạn không có quyền thực hiện thao tác này.";
    }
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return "Thao tác chấm công chưa thành công. Vui lòng thử lại.";
  }
  return "Thao tác chấm công chưa thành công. Vui lòng thử lại.";
}

/** Lấy bản ghi chấm công hôm nay của employee (dùng vn_today() ở DB). */
export async function fetchTodayAttendance(employeeId: string): Promise<TodayAttendance> {
  try {
    const client = getSupabaseClient();
    // Gọi function vn_today() để lấy ngày VN, sau đó query bản ghi
    const { data: todayData, error: todayErr } = await client.rpc("vn_today");
    if (todayErr) throw new Error(toFriendlyClockError(todayErr));
    const todayISO = todayData as string; // YYYY-MM-DD

    const { data: record, error: recErr } = await client
      .from("attendance_records")
      .select("id, employee_id, work_date, check_in, check_out, status, note, confirmed_at, confirmed_by, created_at, updated_at")
      .eq("employee_id", employeeId)
      .eq("work_date", todayISO)
      .maybeSingle();
    if (recErr) throw new Error(toFriendlyClockError(recErr));

    // Lấy ca phân công hôm nay (nếu có)
    let shift: TodayAttendance["shift"] = null;
    if (record) {
      const { data: asg, error: asgErr } = await client
        .from("shift_assignments")
        .select("shift_id, work_shifts(name, start_time, end_time, late_after_minutes)")
        .eq("employee_id", employeeId)
        .eq("work_date", todayISO)
        .maybeSingle();
      if (!asgErr && asg) {
        type ShiftEmbed = { name: string; start_time: string; end_time: string; late_after_minutes: number } | Array<{ name: string; start_time: string; end_time: string; late_after_minutes: number }> | null;
        const raw = (asg as { work_shifts: ShiftEmbed }).work_shifts;
        const s = Array.isArray(raw) ? (raw[0] ?? null) : raw;
        if (s) shift = { name: s.name, start_time: s.start_time, end_time: s.end_time, late_after_minutes: s.late_after_minutes };
      }
    }

    if (!record) {
      return { hasRecord: false, status: "none", record: null, shift };
    }

    const r = record as AttendanceRecord;
    let status: CheckinStatus = "none";
    if (r.check_in && !r.check_out) status = "checked_in";
    else if (r.check_out) status = r.confirmed_at ? "confirmed" : "checked_out";

    return { hasRecord: true, status, record: r, shift };
  } catch (err) {
    throw new Error(toFriendlyClockError(err));
  }
}

/** Gọi RPC clock_in. Trả về bản ghi mới. */
export async function doClockIn(employeeId: string, note?: string): Promise<AttendanceRecord> {
  try {
    const client = getSupabaseClient();
    if (note && note.length > 1000) throw new Error("Ghi chú không được vượt quá 1000 ký tự.");
    const { data, error } = await client.rpc("clock_in", { p_employee_id: employeeId, p_note: note ?? null });
    if (error) throw new Error(toFriendlyClockError(error));
    return data as AttendanceRecord;
  } catch (err) {
    throw new Error(toFriendlyClockError(err));
  }
}

/** Gọi RPC clock_out. Trả về bản ghi đã cập nhật. */
export async function doClockOut(employeeId: string, note?: string): Promise<AttendanceRecord> {
  try {
    const client = getSupabaseClient();
    if (note && note.length > 1000) throw new Error("Ghi chú không được vượt quá 1000 ký tự.");
    const { data, error } = await client.rpc("clock_out", { p_employee_id: employeeId, p_note: note ?? null });
    if (error) throw new Error(toFriendlyClockError(error));
    return data as AttendanceRecord;
  } catch (err) {
    throw new Error(toFriendlyClockError(err));
  }
}

/** Format giờ "HH:MM" từ timestamptz ISO. */
export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false });
  } catch {
    return iso;
  }
}

/** Format ngày "DD/MM/YYYY" từ YYYY-MM-DD. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
}

/** Label trạng thái. */
export const STATUS_LABEL: Record<CheckinStatus, string> = {
  none: "Chưa chấm công",
  checked_in: "Đã check-in",
  checked_out: "Đã check-out",
  confirmed: "Đã xác nhận",
};