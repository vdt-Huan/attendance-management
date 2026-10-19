import type { IconName } from "./icons";
import type { UserRole } from "../types/auth";

export type PageKey =
  | "overview"
  | "checkin"
  | "history"
  | "employees"
  | "departments"
  | "shifts"
  | "schedule"
  | "leave"
  | "report"
  | "settings";

export interface NavItem {
  key: PageKey;
  label: string;
  icon: IconName;
  /** true = đã có giao diện thật; false = placeholder đang phát triển. */
  implemented: boolean;
  /** Các vai trò được thấy và vào trang (đồng bộ với PAGE_ACCESS trong types/rbac). */
  allowedRoles: readonly UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Tổng quan", icon: "overview", implemented: true, allowedRoles: ["admin", "hr", "employee"] },
  { key: "checkin", label: "Chấm công", icon: "checkin", implemented: true, allowedRoles: ["admin", "hr", "employee"] },
  { key: "history", label: "Lịch sử chấm công", icon: "history", implemented: true, allowedRoles: ["admin", "hr", "employee"] },
  { key: "employees", label: "Nhân viên", icon: "employees", implemented: true, allowedRoles: ["admin", "hr"] },
  { key: "departments", label: "Phòng ban", icon: "departments", implemented: true, allowedRoles: ["admin", "hr"] },
  { key: "shifts", label: "Ca làm việc", icon: "shifts", implemented: true, allowedRoles: ["admin", "hr"] },
  { key: "schedule", label: "Lịch làm việc", icon: "calendar", implemented: true, allowedRoles: ["admin", "hr", "employee"] },
  { key: "leave", label: "Nghỉ phép", icon: "leave", implemented: true, allowedRoles: ["admin", "hr", "employee"] },
  { key: "report", label: "Báo cáo", icon: "report", implemented: true, allowedRoles: ["admin", "hr"] },
  { key: "settings", label: "Cài đặt", icon: "settings", implemented: false, allowedRoles: ["admin"] },
];

/** Toàn bộ PageKey hợp lệ — dùng để parse hash URL an toàn. */
export const PAGE_KEYS: readonly PageKey[] = [
  "overview",
  "checkin",
  "history",
  "employees",
  "departments",
  "shifts",
  "schedule",
  "leave",
  "report",
  "settings",
];

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value);
}

/** Đọc PageKey từ location.hash dạng "#/employees". Trả null khi không hợp lệ. */
export function pageKeyFromHash(hash: string): PageKey | null {
  const cleaned = hash.replace(/^#\/?/, "").split("?")[0]?.split("/")[0] ?? "";
  return isPageKey(cleaned) ? cleaned : null;
}
