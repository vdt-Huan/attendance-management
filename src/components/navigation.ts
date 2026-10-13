import type { IconName } from "./icons";

export type PageKey =
  | "overview"
  | "checkin"
  | "history"
  | "employees"
  | "shifts"
  | "leave"
  | "report"
  | "settings";

export interface NavItem {
  key: PageKey;
  label: string;
  icon: IconName;
  /** true = đã có giao diện thật; false = placeholder đang phát triển. */
  implemented: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Tổng quan", icon: "overview", implemented: true },
  { key: "checkin", label: "Chấm công", icon: "checkin", implemented: false },
  { key: "history", label: "Lịch sử chấm công", icon: "history", implemented: true },
  { key: "employees", label: "Nhân viên", icon: "employees", implemented: false },
  { key: "shifts", label: "Ca làm việc", icon: "shifts", implemented: false },
  { key: "leave", label: "Nghỉ phép", icon: "leave", implemented: false },
  { key: "report", label: "Báo cáo", icon: "report", implemented: false },
  { key: "settings", label: "Cài đặt", icon: "settings", implemented: false },
];
