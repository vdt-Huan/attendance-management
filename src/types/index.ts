// Kiểu dùng chung cho toàn ứng dụng.
//
// LƯU Ý DEMO (Prompt 2): các kiểu dưới đây mô tả hình dáng dữ liệu sẽ lấy
// từ Supabase ở prompt tiếp theo. Hiện tại dữ liệu được cấp bởi
// src/services/demoData.ts — TUYỆT ĐỐI không dùng để tuyên bố nghiệp vụ
// chấm công đã hoạt động.

export interface AppInfo {
  name: string;
  timezone: string;
  locale: string;
}

export type AttendanceStatus = "dung-gio" | "di-muon" | "ve-som" | "vang";

export interface AttendanceRecord {
  employeeCode: string;
  fullName: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
}

export interface DashboardStats {
  totalEmployees: number;
  checkedInToday: number;
  lateToday: number;
  pendingLeaveRequests: number;
}

export interface DailyCheckinPoint {
  /** Nhãn ngày, ví dụ "T2", "T3"... */
  day: string;
  /** Số lượt chấm công (dữ liệu demo). */
  count: number;
}

export interface DemoNotification {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

export type AttendanceFilter = "all" | AttendanceStatus;

export type DataState = "loading" | "ready" | "error";
