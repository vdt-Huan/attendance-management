// Tầng gọi Supabase cho lịch sử chấm công + tổng hợp (Ngày 5.2).
//
// Bám ĐÚNG schema thật trong supabase/migrations/0001_initial_schema.sql:
// - attendance_records: id, employee_id, work_date (vn_today()), check_in,
//   check_out, status (dung-gio|di-muon|ve-som|vang), note, confirmed_at,
//   confirmed_by, created_at, updated_at.
// - RLS: attendance_select_own_or_hr → nhân viên chỉ thấy dòng của mình
//   (employee.user_id = auth.uid()), HR/Admin thấy tất cả.
// - Không tự thêm quy tắc làm tròn/phạt; chỉ đọc dữ liệu thật và hiển thị
//   định nghĩa mỗi chỉ số rõ ràng.
// - Tổng hợp: đếm ngày có bản ghi, ngày thiếu check-out, ngày vắng, v.v.
//   Công thức ghi rõ trên UI, không tự đặt quy tắc nghiệp vụ chưa thống nhất.

import { getSupabaseClient } from "../lib/supabase";

export interface AttendanceRecordFull {
  id: string;
  employee_id: string;
  work_date: string;
  check_in: string | null;
  check_out: string | null;
  status: "dung-gio" | "di-muon" | "ve-som" | "vang";
  note: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  late_minutes: number | null;
  created_at: string;
  updated_at: string;
  /** Join từ employees + profiles để hiển thị tên/mã. */
  employee_code?: string;
  full_name?: string;
  department_name?: string | null;
}

export interface AttendanceListParams {
  /** ISO date YYYY-MM-DD */
  fromDate?: string;
  toDate?: string;
  status?: "all" | "dung-gio" | "di-muon" | "ve-som" | "vang";
  employeeId?: string;
  departmentId?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortField: "work_date" | "check_in" | "status";
  sortDirection: "asc" | "desc";
}

export interface AttendanceListResult {
  items: AttendanceRecordFull[];
  total: number;
}

export interface AttendanceSummary {
  /** Số ngày có bản ghi chấm công (attendance_records row). */
  totalRecordDays: number;
  /** Số ngày check-in nhưng thiếu check-out. */
  missingCheckOut: number;
  /** Số ngày trạng thái 'vang'. */
  absentDays: number;
  /** Số ngày trạng thái 'di-muon'. */
  lateDays: number;
  /** Số ngày trạng thái 've-som'. */
  earlyLeaveDays: number;
  /** Số ngày trạng thái 'dung-gio'. */
  onTimeDays: number;
  /** Số ngày có confirmed_at (đã được HR/Admin xác nhận). */
  confirmedDays: number;
  /** Khoảng ngày của truy vấn. */
  fromDate: string | null;
  toDate: string | null;
}

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (c) => `\\${c}`);
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
    return "Chưa tải được lịch sử chấm công. Vui lòng thử lại.";
  }
  return "Chưa tải được lịch sử chấm công. Vui lòng thử lại.";
}

/**
 * Danh sách chấm công với lọc, sắp xếp, phân trang server-side.
 * RLS tự động giới hạn: nhân viên chỉ thấy dòng của mình (employee.user_id = auth.uid()).
 * HR/Admin thấy tất cả (is_hr()).
 */
export async function listAttendanceRecords(params: AttendanceListParams): Promise<AttendanceListResult> {
  const page = Math.max(0, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  try {
    const client = getSupabaseClient();

    // Query cơ bản: join employees + profiles + departments để lấy tên/mã phòng ban
    let query = client
      .from("attendance_records")
      .select(
        `
        id,
        employee_id,
        work_date,
        check_in,
        check_out,
        status,
        note,
         confirmed_at,
         confirmed_by,
         late_minutes,
         created_at,
         updated_at,
        employees (
          id,
          employee_code,
          full_name,
          department_id,
          departments (name)
        )
      `,
        { count: "exact" },
      );

    // Lọc theo ngày
    if (params.fromDate) query = query.gte("work_date", params.fromDate);
    if (params.toDate) query = query.lte("work_date", params.toDate);

    // Lọc trạng thái
    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    // Lọc nhân viên cụ thể (HR/Admin dùng)
    if (params.employeeId) {
      query = query.eq("employee_id", params.employeeId);
    }

    // Lọc phòng ban (HR/Admin dùng) - join qua employees.department_id
    if (params.departmentId && params.departmentId !== "all") {
      if (params.departmentId === "unassigned") {
        query = query.is("employees.department_id", null);
      } else {
        query = query.eq("employees.department_id", params.departmentId);
      }
    }

    // Tìm kiếm theo tên/mã nhân viên
    if (params.search?.trim()) {
      const q = escapeLike(params.search.trim());
      query = query.or(`employees.full_name.ilike.%${q}%,employees.employee_code.ilike.%${q}%`);
    }

    // Sắp xếp
    const validSortFields = ["work_date", "check_in", "status"] as const;
    const sortField = validSortFields.includes(params.sortField as any) ? params.sortField : "work_date";
    query = query.order(sortField, { ascending: params.sortDirection === "asc" });

    // Phân trang
    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(toFriendlyReadError(error));

    const items: AttendanceRecordFull[] = ((data ?? []) as unknown as Array<{
      id: string;
      employee_id: string;
      work_date: string;
      check_in: string | null;
      check_out: string | null;
      status: "dung-gio" | "di-muon" | "ve-som" | "vang";
      note: string | null;
       confirmed_at: string | null;
       confirmed_by: string | null;
       late_minutes: number | null;
       created_at: string;
      updated_at: string;
      employees: {
        id: string;
        employee_code: string;
        full_name: string;
        department_id: string | null;
        departments: { name: string } | null;
      } | null;
    }>).map((r) => ({
      id: r.id,
      employee_id: r.employee_id,
      work_date: r.work_date,
      check_in: r.check_in,
      check_out: r.check_out,
      status: r.status,
      note: r.note,
       confirmed_at: r.confirmed_at,
       confirmed_by: r.confirmed_by,
       late_minutes: r.late_minutes,
       created_at: r.created_at,
      updated_at: r.updated_at,
      employee_code: r.employees?.employee_code,
      full_name: r.employees?.full_name,
      department_name: r.employees?.departments?.name ?? null,
    }));

    return { items, total: count ?? items.length };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/**
 * Tổng hợp chấm công trong khoảng ngày.
 * Chỉ đọc dữ liệu thật — không tự thêm quy tắc làm tròn/phạt.
 * Định nghĩa mỗi chỉ số:
 * - totalRecordDays: số dòng attendance_records trong khoảng (mỗi dòng = 1 ngày/người).
 * - missingCheckOut: có check_in nhưng không có check_out.
 * - absentDays: status = 'vang'.
 * - lateDays: status = 'di-muon'.
 * - earlyLeaveDays: status = 've-som'.
 * - onTimeDays: status = 'dung-gio'.
 * - confirmedDays: confirmed_at không null.
 */
export async function getAttendanceSummary(params: {
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  departmentId?: string;
}): Promise<AttendanceSummary> {
  try {
    const client = getSupabaseClient();

    let query = client.from("attendance_records").select(
      `
      work_date,
      check_in,
      check_out,
      status,
      confirmed_at,
      employees!inner (
        id,
        department_id
      )
    `, { count: "exact" });

    if (params.fromDate) query = query.gte("work_date", params.fromDate);
    if (params.toDate) query = query.lte("work_date", params.toDate);
    if (params.employeeId) query = query.eq("employee_id", params.employeeId);
    if (params.departmentId && params.departmentId !== "all") {
      if (params.departmentId === "unassigned") {
        query = query.is("employees.department_id", null);
      } else {
        query = query.eq("employees.department_id", params.departmentId);
      }
    }

    // Lấy tất cả bản ghi trong khoảng để tính tổng hợp (không phân trang)
    // Giới hạn an toàn: nếu quá nhiều bản ghi, client nên hẹp khoảng ngày
    const { data, error } = await query.limit(5000);
    if (error) throw new Error(toFriendlyReadError(error));

    const records = (data ?? []) as Array<{
      work_date: string;
      check_in: string | null;
      check_out: string | null;
      status: "dung-gio" | "di-muon" | "ve-som" | "vang";
      confirmed_at: string | null;
    }>;

    let totalRecordDays = 0;
    let missingCheckOut = 0;
    let absentDays = 0;
    let lateDays = 0;
    let earlyLeaveDays = 0;
    let onTimeDays = 0;
    let confirmedDays = 0;

    for (const r of records) {
      totalRecordDays++;
      if (r.check_in && !r.check_out) missingCheckOut++;
      switch (r.status) {
        case "vang":
          absentDays++;
          break;
        case "di-muon":
          lateDays++;
          break;
        case "ve-som":
          earlyLeaveDays++;
          break;
        case "dung-gio":
          onTimeDays++;
          break;
      }
      if (r.confirmed_at) confirmedDays++;
    }

    return {
      totalRecordDays,
      missingCheckOut,
      absentDays,
      lateDays,
      earlyLeaveDays,
      onTimeDays,
      confirmedDays,
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
    };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

/** Lấy ngày VN từ DB (vn_today function). */
export async function getVnToday(): Promise<string> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("vn_today");
    if (error) throw new Error(toFriendlyReadError(error));
    return data as string;
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

export interface AttendanceDayCount {
  date: string;
  total: number;
  onTime: number;
  late: number;
  early: number;
  absent: number;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export async function getAttendanceLast7Days(departmentId?: string): Promise<AttendanceDayCount[]> {
  try {
    const client = getSupabaseClient();
    const today = await getVnToday();
    const from = addDaysISO(today, -6);

    let query = client
      .from("attendance_records")
      .select("work_date, status, employees(department_id)")
      .gte("work_date", from)
      .lte("work_date", today);

    if (departmentId && departmentId !== "all") {
      if (departmentId === "unassigned") {
        query = query.is("employees.department_id", null);
      } else {
        query = query.eq("employees.department_id", departmentId);
      }
    }

    const { data, error } = await query.limit(5000);
    if (error) throw new Error(toFriendlyReadError(error));

    const rows = (data ?? []) as Array<{ work_date: string; status: string }>;

    const map = new Map<string, AttendanceDayCount>();
    for (let i = 0; i < 7; i++) {
      const d = addDaysISO(from, i);
      map.set(d, { date: d, total: 0, onTime: 0, late: 0, early: 0, absent: 0 });
    }

    for (const r of rows) {
      const entry = map.get(r.work_date);
      if (!entry) continue;
      entry.total += 1;
      switch (r.status) {
        case "dung-gio":
          entry.onTime += 1;
          break;
        case "di-muon":
          entry.late += 1;
          break;
        case "ve-som":
          entry.early += 1;
          break;
        case "vang":
          entry.absent += 1;
          break;
      }
    }

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

export { PAGE_SIZE };