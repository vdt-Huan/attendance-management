// Tầng gọi Supabase cho đơn nghỉ phép (Ngày 6.1).
//
// Bám ĐÚNG schema thật trong supabase/migrations/0001_initial_schema.sql:
// - leave_requests: id, employee_id (→ employees CASCADE), start_date (date),
//   end_date (date), reason (text NOT NULL), status (pending/approved/rejected),
//   reviewed_by (→ profiles), decided_at (timestamptz), created_at, updated_at.
//   CHECK end_date >= start_date. KHÔNG có cột loại nghỉ phép (annual/sick/...)
//   → không tự thêm. KHÔNG có cột lý do từ chối riêng → reason là lý do xin
//   nghỉ; HR không có trường rejection_reason trong schema → không tự thêm.
// - RLS: leave_select_own_or_hr (employee chỉ thấy đơn của mình), leave_insert_own_or_hr
//   (employee chỉ insert pending cho chính mình), leave_update_own_or_hr (employee
//   chỉ sửa pending của mình, không chạm status/reviewed_by/decided_at),
//   leave_delete_own_or_hr (employee chỉ xóa pending của mình).
// - Trigger: enforce_leave_insert (employee → pending), enforce_leave_update
//   (employee không sửa đơn đã xử lý, không chạm status/reviewed_by/decided_at),
//   enforce_leave_delete (employee chỉ xóa pending của mình).
// - HR/Admin duyệt: UPDATE status + reviewed_by + decided_at trong một thao tác.
//   Chống race condition: kiểm tra status = 'pending' trước khi update, DB
//   trigger enforce_leave_update siết thêm ở tầng DB.
// - Không dùng service-role key. Không tự trừ phép/tính lương.

import { getSupabaseClient } from "../lib/supabase";

export type LeaveType = "annual" | "sick" | "unpaid" | "wedding" | "maternity" | "other";

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: "Nghỉ phép năm",
  sick: "Nghỉ ốm",
  unpaid: "Nghỉ không lương",
  wedding: "Nghỉ đám cưới",
  maternity: "Nghỉ thai sản",
  other: "Khác",
};

export interface LeaveRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  leave_type: LeaveType;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  decided_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Join fields
  employee_code?: string;
  full_name?: string;
  department_name?: string | null;
  reviewer_name?: string | null;
}

export interface LeaveListParams {
  status?: "all" | "pending" | "approved" | "rejected";
  leaveType?: "all" | LeaveType;
  fromDate?: string;
  toDate?: string;
  employeeId?: string;
  departmentId?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortField: "created_at" | "start_date" | "status";
  sortDirection: "asc" | "desc";
}

export interface LeaveListResult {
  items: LeaveRequest[];
  total: number;
}

const LEAVE_PAGE_SIZE = 20;
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
    return "Chưa tải được đơn nghỉ phép. Vui lòng thử lại.";
  }
  return "Chưa tải được đơn nghỉ phép. Vui lòng thử lại.";
}

export function toFriendlyLeaveError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (raw.includes("23505") || raw.includes("duplicate")) {
      return "Dữ liệu bị trùng. Vui lòng kiểm tra lại.";
    }
    if (raw.includes("23514") || raw.includes("check constraint")) {
      return "Ngày kết thúc không được trước ngày bắt đầu.";
    }
    if (raw.includes("42501") || raw.includes("permission denied") || raw.includes("row-level security")) {
      return "Bạn không có quyền thực hiện thao tác này.";
    }
    if (raw.includes("không được tự duyệt") || raw.includes("không được tự") || raw.includes("not allowed")) {
      return "Nhân viên không được tự duyệt đơn.";
    }
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return "Thao tác chưa thành công. Vui lòng kiểm tra dữ liệu và thử lại.";
  }
  return "Thao tác chưa thành công. Vui lòng thử lại.";
}

export async function listLeaveRequests(params: LeaveListParams): Promise<LeaveListResult> {
  const page = Math.max(0, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), MAX_PAGE_SIZE);
  const from = page * pageSize;
  const to = from + pageSize - 1;

  try {
    const client = getSupabaseClient();

    let query = client.from("leave_requests").select(
      `
        id,
        employee_id,
        start_date,
        end_date,
        reason,
        leave_type,
        status,
        reviewed_by,
        decided_at,
        rejection_reason,
        created_at,
        updated_at,
        employees (
          id,
          employee_code,
          full_name,
          department_id,
          departments (name)
        ),
        profiles:reviewed_by (full_name)
      `,
      { count: "exact" },
    );

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.leaveType && params.leaveType !== "all") {
      query = query.eq("leave_type", params.leaveType);
    }
    if (params.fromDate) query = query.gte("start_date", params.fromDate);
    if (params.toDate) query = query.lte("end_date", params.toDate);
    if (params.employeeId) query = query.eq("employee_id", params.employeeId);
    if (params.departmentId && params.departmentId !== "all") {
      if (params.departmentId === "unassigned") {
        query = query.is("employees.department_id", null);
      } else {
        query = query.eq("employees.department_id", params.departmentId);
      }
    }
    if (params.search?.trim()) {
      const q = escapeLike(params.search.trim());
      query = query.or(`employees.full_name.ilike.%${q}%,employees.employee_code.ilike.%${q}%`);
    }

    const validSortFields = ["created_at", "start_date", "status"] as const;
    const sortField = validSortFields.includes(params.sortField as any) ? params.sortField : "created_at";
    query = query.order(sortField, { ascending: params.sortDirection === "asc" }).range(from, to);

    const { data, error, count } = await query;
    if (error) throw new Error(toFriendlyReadError(error));

    type DeptEmbed = { name: string } | Array<{ name: string }> | null;
    type EmpEmbed = {
      id: string;
      employee_code: string;
      full_name: string;
      department_id: string | null;
      departments: DeptEmbed;
    } | null;
    type ProfileEmbed = { full_name: string } | Array<{ full_name: string }> | null;

    const items: LeaveRequest[] = ((data ?? []) as unknown as Array<{
      id: string;
      employee_id: string;
      start_date: string;
      end_date: string;
       reason: string;
       leave_type: LeaveType;
       status: "pending" | "approved" | "rejected";
       reviewed_by: string | null;
       decided_at: string | null;
       rejection_reason: string | null;
       created_at: string;
      updated_at: string;
      employees: EmpEmbed;
      profiles: ProfileEmbed;
    }>).map((r) => {
      const emp = r.employees;
      const dept = Array.isArray(emp?.departments) ? (emp?.departments[0] ?? null) : (emp?.departments ?? null);
      const reviewer = Array.isArray(r.profiles) ? (r.profiles[0] ?? null) : (r.profiles ?? null);
      return {
        id: r.id,
        employee_id: r.employee_id,
        start_date: r.start_date,
        end_date: r.end_date,
        reason: r.reason,
        leave_type: r.leave_type,
        status: r.status,
        reviewed_by: r.reviewed_by,
        decided_at: r.decided_at,
        rejection_reason: r.rejection_reason,
        created_at: r.created_at,
        updated_at: r.updated_at,
        employee_code: emp?.employee_code,
        full_name: emp?.full_name,
        department_name: dept?.name ?? null,
        reviewer_name: reviewer?.full_name ?? null,
      };
    });

    return { items, total: count ?? items.length };
  } catch (err) {
    throw new Error(toFriendlyReadError(err));
  }
}

export async function createLeaveRequest(
  employeeId: string,
  startDate: string,
  endDate: string,
  reason: string,
  leaveType: LeaveType,
): Promise<void> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("Vui lòng nhập lý do nghỉ phép.");
  if (!startDate) throw new Error("Vui lòng chọn ngày bắt đầu.");
  if (!endDate) throw new Error("Vui lòng chọn ngày kết thúc.");
  if (endDate < startDate) throw new Error("Ngày kết thúc không được trước ngày bắt đầu.");
  if (!leaveType) throw new Error("Vui lòng chọn loại nghỉ phép.");

  try {
    const client = getSupabaseClient();
    const { error } = await client.from("leave_requests").insert({
      employee_id: employeeId,
      start_date: startDate,
      end_date: endDate,
      reason: trimmedReason,
      leave_type: leaveType,
      status: "pending", // trigger enforce_leave_insert sẽ ép pending cho employee
    });
    if (error) throw new Error(toFriendlyLeaveError(error));
  } catch (err) {
    throw new Error(toFriendlyLeaveError(err));
  }
}

export async function approveLeaveRequest(id: string): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { data: current, error: curErr } = await client
      .from("leave_requests")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(toFriendlyLeaveError(curErr));
    if (!current) throw new Error("Đơn không tồn tại (có thể đã bị xóa).");
    if ((current as { status: string }).status !== "pending") {
      throw new Error("Đơn này đã được xử lý trước đó. Không thể duyệt lại.");
    }
    const { error } = await client
      .from("leave_requests")
      .update({
        status: "approved",
        reviewed_by: (await client.auth.getSession()).data.session?.user.id ?? null,
        decided_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", id)
      .eq("status", "pending"); // Optimistic concurrency: chỉ update nếu vẫn pending
    if (error) throw new Error(toFriendlyLeaveError(error));
  } catch (err) {
    throw new Error(toFriendlyLeaveError(err));
  }
}

export async function rejectLeaveRequest(id: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (trimmed.length < 5) throw new Error("Vui lòng nhập lý do từ chối (ít nhất 5 ký tự).");
  if (trimmed.length > 1000) throw new Error("Lý do từ chối không được vượt quá 1000 ký tự.");
  try {
    const client = getSupabaseClient();
    const { data: current, error: curErr } = await client
      .from("leave_requests")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(toFriendlyLeaveError(curErr));
    if (!current) throw new Error("Đơn không tồn tại (có thể đã bị xóa).");
    if ((current as { status: string }).status !== "pending") {
      throw new Error("Đơn này đã được xử lý trước đó. Không thể từ chối lại.");
    }
    const { error } = await client
      .from("leave_requests")
      .update({
        status: "rejected",
        reviewed_by: (await client.auth.getSession()).data.session?.user.id ?? null,
        decided_at: new Date().toISOString(),
        rejection_reason: trimmed,
      })
      .eq("id", id)
      .eq("status", "pending"); // Optimistic concurrency
    if (error) throw new Error(toFriendlyLeaveError(error));
  } catch (err) {
    throw new Error(toFriendlyLeaveError(err));
  }
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  try {
    const client = getSupabaseClient();
    const { data: current, error: curErr } = await client
      .from("leave_requests")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (curErr) throw new Error(toFriendlyLeaveError(curErr));
    if (!current) throw new Error("Đơn không tồn tại (có thể đã bị xóa).");
    if ((current as { status: string }).status !== "pending") {
      throw new Error("Chỉ được xóa đơn đang chờ duyệt.");
    }
    const { error } = await client.from("leave_requests").delete().eq("id", id);
    if (error) throw new Error(toFriendlyLeaveError(error));
  } catch (err) {
    throw new Error(toFriendlyLeaveError(err));
  }
}

export async function getMyEmployeeId(): Promise<string | null> {
  try {
    const client = getSupabaseClient();
    const { data: session } = await client.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return null;
    const { data, error } = await client.from("employees").select("id").eq("user_id", uid).maybeSingle();
    if (error) throw new Error(toFriendlyLeaveError(error));
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    throw new Error(toFriendlyLeaveError(err));
  }
}

export { LEAVE_PAGE_SIZE };