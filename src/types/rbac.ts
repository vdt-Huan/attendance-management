// Phân quyền vai trò frontend (Ngày 2.2 — RBAC).
//
// NGUỒN SỰ THẬT VỀ ROLE: chữ thường đúng như CHECK constraint trong
// supabase/migrations/0001_initial_schema.sql:
//   role in ('admin', 'hr', 'employee')
// KHÔNG tự chuẩn hoá hoa/thường, KHÔNG mặc định role.
//
// Nguyên tắc:
// - Frontend chỉ ẨN menu/nút cho gọn; bảo mật thật nằm ở RLS + trigger
//   trong database (xem migration 0001). Mọi trang nhạy cảm đều bị guard
//   chặn ngay cả khi người dùng đoán URL/hash.
// - settings (quản lý quyền/cấu hình) CHỈ admin — để phân biệt 3 tier
//   admin/hr/employee trong kiểm thử.

import type { UserRole } from "./auth";
import type { PageKey } from "../components/navigation";

/** Vai trò được phép truy cập từng trang. */
export const PAGE_ACCESS: Record<PageKey, readonly UserRole[]> = {
  // Mọi vai trò: dashboard cá nhân + bấm giờ + lịch sử của mình.
  overview: ["admin", "hr", "employee"],
  checkin: ["admin", "hr", "employee"],
  history: ["admin", "hr", "employee"],
  // Quản trị nhân sự: HR/Admin theo policy employees_write_hr.
  employees: ["admin", "hr"],
  // Quản lý phòng ban: HR/Admin theo policy departments_write_hr.
  departments: ["admin", "hr"],
  // Quản lý ca làm (định nghĩa ca): HR/Admin theo shifts_write_hr.
  // Nhân viên xem lịch cá nhân ở trang Lịch làm việc (bị khóa chỉ xem dòng
  // của mình + RLS assignments_select_own_or_hr), không vào trang quản lý.
  shifts: ["admin", "hr"],
  // Lịch làm việc: mọi vai trò (nhân viên chỉ lịch của mình; HR/Admin toàn
  // phạm vi được cấp; ghi phân công chỉ HR qua assignments_write_hr).
  schedule: ["admin", "hr", "employee"],
  // Nghỉ phép: mọi vai trò vào trang (nhân viên chỉ đơn của mình,
  // HR/Admin duyệt) — RLS leave_*_own_or_hr + trigger siết thêm.
  leave: ["admin", "hr", "employee"],
  // Báo cáo tổng hợp: HR/Admin.
  report: ["admin", "hr"],
  // Cài đặt + quản lý quyền: CHỈ admin (phân biệt HR không tự nâng quyền).
  settings: ["admin"],
};

/** Tên hiển thị của trang (dùng cho màn hình từ chối). */
export const PAGE_LABEL: Record<PageKey, string> = {
  overview: "Tổng quan",
  checkin: "Chấm công",
  history: "Lịch sử chấm công",
  employees: "Nhân viên",
  departments: "Phòng ban",
  shifts: "Ca làm việc",
  schedule: "Lịch làm việc",
  leave: "Nghỉ phép",
  report: "Báo cáo",
  settings: "Cài đặt",
};

/** Role có được vào trang không. role null = chưa rõ vai trò → từ chối. */
export function canAccessPage(role: UserRole | null | undefined, page: PageKey): boolean {
  if (!role) return false;
  return PAGE_ACCESS[page].includes(role);
}

/** Lọc menu theo vai trò — mục không phép bị ẩn khỏi sidebar. */
export function getVisiblePageKeys(role: UserRole): PageKey[] {
  return (Object.keys(PAGE_ACCESS) as PageKey[]).filter((page) => canAccessPage(role, page));
}

export function isHrOrAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin" || role === "hr";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "admin";
}
