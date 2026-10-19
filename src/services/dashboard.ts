// Service dashboard + báo cáo (Ngày 6.2).
//
// KPI thật từ Supabase (không hard-code):
// - totalActiveEmployees: count employees WHERE is_active = true
// - totalDepartments: count departments
// - totalShifts: count work_shifts
// - todayAttendance: count attendance_records WHERE work_date = vn_today()
// - pendingLeaveRequests: count leave_requests WHERE status = 'pending'
// - todayCheckedIn: count attendance_records WHERE work_date = vn_today() AND check_in IS NOT NULL
// - todayCheckedOut: count attendance_records WHERE work_date = vn_today() AND check_out IS NOT NULL
//
// Báo cáo chấm công: reuse listAttendanceRecords từ attendanceHistory.ts
// Báo cáo nghỉ phép: reuse listLeaveRequests từ leave.ts
//
// Export CSV: escape CSV injection (prefix dangerous chars with '), UTF-8 BOM.

import { getSupabaseClient } from "../lib/supabase";

export interface DashboardKPI {
  totalActiveEmployees: number;
  totalDepartments: number;
  totalShifts: number;
  todayAttendance: number;
  todayCheckedIn: number;
  todayCheckedOut: number;
  todayLate: number;
  todayEarly: number;
  pendingLeaveRequests: number;
  loading: boolean;
  error: string | null;
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
    return "Chưa tải được dữ liệu. Vui lòng thử lại.";
  }
  return "Chưa tải được dữ liệu. Vui lòng thử lại.";
}

export async function fetchDashboardKPI(): Promise<Omit<DashboardKPI, "loading" | "error">> {
  try {
    const client = getSupabaseClient();
    const { data: todayData, error: todayErr } = await client.rpc("vn_today");
    if (todayErr) throw new Error(toFriendlyReadError(todayErr));
    const todayISO = todayData as string;

    const [empRes, deptRes, shiftRes, attRes, attInRes, attOutRes, lateRes, earlyRes, leaveRes] = await Promise.all([
      client.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
      client.from("departments").select("id", { count: "exact", head: true }),
      client.from("work_shifts").select("id", { count: "exact", head: true }),
      client.from("attendance_records").select("id", { count: "exact", head: true }).eq("work_date", todayISO),
      client.from("attendance_records").select("id", { count: "exact", head: true }).eq("work_date", todayISO).not("check_in", "is", null),
      client.from("attendance_records").select("id", { count: "exact", head: true }).eq("work_date", todayISO).not("check_out", "is", null),
      client.from("attendance_records").select("id", { count: "exact", head: true }).eq("work_date", todayISO).eq("status", "di-muon"),
      client.from("attendance_records").select("id", { count: "exact", head: true }).eq("work_date", todayISO).eq("status", "ve-som"),
      client.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    if (empRes.error) throw new Error(toFriendlyReadError(empRes.error));
    if (deptRes.error) throw new Error(toFriendlyReadError(deptRes.error));
    if (shiftRes.error) throw new Error(toFriendlyReadError(shiftRes.error));
    if (attRes.error) throw new Error(toFriendlyReadError(attRes.error));
    if (attInRes.error) throw new Error(toFriendlyReadError(attInRes.error));
    if (attOutRes.error) throw new Error(toFriendlyReadError(attOutRes.error));
    if (lateRes.error) throw new Error(toFriendlyReadError(lateRes.error));
    if (earlyRes.error) throw new Error(toFriendlyReadError(earlyRes.error));
    if (leaveRes.error) throw new Error(toFriendlyReadError(leaveRes.error));

    return {
      totalActiveEmployees: empRes.count ?? 0,
      totalDepartments: deptRes.count ?? 0,
      totalShifts: shiftRes.count ?? 0,
      todayAttendance: attRes.count ?? 0,
      todayCheckedIn: attInRes.count ?? 0,
      todayCheckedOut: attOutRes.count ?? 0,
      todayLate: lateRes.count ?? 0,
      todayEarly: earlyRes.count ?? 0,
      pendingLeaveRequests: leaveRes.count ?? 0,
    };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

// ---------------------------------------------------------------------------
// CSV Export — chống injection, UTF-8 BOM, xử lý tiếng Việt
// ---------------------------------------------------------------------------

/**
 * Sanitize một giá trị để chống CSV formula injection.
 * Nếu giá trị bắt đầu bằng =, +, -, @, \t, \r → prefix bằng ' (single quote).
 */
export function sanitizeCsvValue(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Chuyển mảng bản ghi thành chuỗi CSV với UTF-8 BOM.
 * Xử lý ký tự đặc biệt: dấu phẩy, ngoặc kép, xuống dòng.
 */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const BOM = "\uFEFF";
  const escapeField = (val: unknown): string => {
    const sanitized = sanitizeCsvValue(val);
    if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n") || sanitized.includes("\r")) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  };

  const headerLine = headers.map(escapeField).join(",");
  const dataLines = rows.map((row) => row.map(escapeField).join(","));
  return BOM + [headerLine, ...dataLines].join("\r\n");
}

/**
 * Tải xuống file CSV.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export báo cáo chấm công ra CSV.
 */
export function exportAttendanceCsv(
  records: Array<{
    work_date: string;
    employee_code?: string;
    full_name?: string;
    department_name?: string | null;
    check_in: string | null;
    check_out: string | null;
    status: string;
    confirmed_at: string | null;
  }>,
  filename?: string,
): void {
  const headers = ["Ngày", "Mã NV", "Họ tên", "Phòng ban", "Giờ vào", "Giờ ra", "Trạng thái", "Xác nhận"];
  const rows = records.map((r) => [
    r.work_date,
    r.employee_code ?? "",
    r.full_name ?? "",
    r.department_name ?? "",
    r.check_in ? new Date(r.check_in).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
    r.check_out ? new Date(r.check_out).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
    r.status,
    r.confirmed_at ? "Đã xác nhận" : "Chưa",
  ]);
  const csv = toCsv(headers, rows);
  downloadCsv(filename ?? `bao-cao-cham-cong-${new Date().toISOString().split("T")[0]}.csv`, csv);
}

/**
 * Export báo cáo nghỉ phép ra CSV.
 */
export function exportLeaveCsv(
  records: Array<{
    start_date: string;
    end_date: string;
    full_name?: string;
    employee_code?: string;
    department_name?: string | null;
    reason: string;
    status: string;
    reviewer_name?: string | null;
    decided_at: string | null;
  }>,
  filename?: string,
): void {
  const headers = ["Từ ngày", "Đến ngày", "Mã NV", "Họ tên", "Phòng ban", "Lý do", "Trạng thái", "Người duyệt", "Ngày duyệt"];
  const rows = records.map((r) => [
    r.start_date,
    r.end_date,
    r.employee_code ?? "",
    r.full_name ?? "",
    r.department_name ?? "",
    r.reason,
    r.status,
    r.reviewer_name ?? "",
    r.decided_at ? new Date(r.decided_at).toLocaleString("vi-VN") : "",
  ]);
  const csv = toCsv(headers, rows);
  downloadCsv(filename ?? `bao-cao-nghi-phep-${new Date().toISOString().split("T")[0]}.csv`, csv);
}