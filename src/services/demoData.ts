// =====================================================================
// DỮ LIỆU DEMO — CHỈ PHỤC VỤ HOÀN THIỆN GIAO DIỆN (Prompt 2, Ngày 1).
// - Mọi số liệu/thông tin trong file này là GIẢ LẬP, không phải nghiệp vụ thật.
// - Đây là nơi DUY NHẤT chứa dữ liệu demo; component giao diện không
//   hard-code dữ liệu, chỉ đọc qua các hàm/hằng xuất ra từ file này.
// - Sẽ bị thay thế hoàn toàn bằng dữ liệu Supabase ở prompt tiếp theo.
// =====================================================================

import type {
  AttendanceRecord,
  AttendanceStatus,
  DailyCheckinPoint,
  DashboardStats,
  DemoNotification,
} from "../types";

/** Thống kê tổng quan (demo). */
export const DEMO_STATS: DashboardStats = {
  totalEmployees: 48,
  checkedInToday: 41,
  lateToday: 5,
  pendingLeaveRequests: 3,
};

/** Bản ghi chấm công gần đây (demo). */
export const DEMO_ATTENDANCE: AttendanceRecord[] = [
  { employeeCode: "NV001", fullName: "Nguyễn Văn An", checkIn: "07:52", checkOut: "17:05", status: "dung-gio" },
  { employeeCode: "NV002", fullName: "Trần Thị Bình", checkIn: "08:12", checkOut: "17:02", status: "di-muon" },
  { employeeCode: "NV003", fullName: "Lê Hoàng Cường", checkIn: "07:48", checkOut: "16:30", status: "ve-som" },
  { employeeCode: "NV004", fullName: "Phạm Thị Dung", checkIn: "07:55", checkOut: "17:10", status: "dung-gio" },
  { employeeCode: "NV005", fullName: "Hoàng Văn Em", checkIn: null, checkOut: null, status: "vang" },
  { employeeCode: "NV006", fullName: "Vũ Thị Phương", checkIn: "08:20", checkOut: "17:00", status: "di-muon" },
  { employeeCode: "NV007", fullName: "Đặng Văn Giang", checkIn: "07:50", checkOut: "17:08", status: "dung-gio" },
  { employeeCode: "NV008", fullName: "Bùi Thị Hằng", checkIn: "07:58", checkOut: "17:01", status: "dung-gio" },
];

/** Lượt chấm công theo ngày trong tuần (demo, dùng cho biểu đồ). */
export const DEMO_WEEKLY_CHECKINS: DailyCheckinPoint[] = [
  { day: "T2", count: 44 },
  { day: "T3", count: 46 },
  { day: "T4", count: 41 },
  { day: "T5", count: 45 },
  { day: "T6", count: 39 },
  { day: "T7", count: 12 },
  { day: "CN", count: 4 },
];

/** Thông báo demo cho nút chuông. */
export const DEMO_NOTIFICATIONS: DemoNotification[] = [
  {
    id: "n1",
    title: "Đơn nghỉ phép mới",
    description: "NV002 gửi đơn nghỉ phép ngày mai, chờ bạn duyệt.",
    time: "10 phút trước",
    unread: true,
  },
  {
    id: "n2",
    title: "5 nhân viên đi muộn hôm nay",
    description: "Danh sách đi muộn đã được cập nhật vào báo cáo ngày.",
    time: "1 giờ trước",
    unread: true,
  },
  {
    id: "n3",
    title: "Nhắc lịch kết ca",
    description: "Ca chiều kết thúc lúc 17:00 theo giờ Việt Nam.",
    time: "Hôm qua",
    unread: false,
  },
];

/** Người dùng demo hiển thị ở avatar header (chưa có xác thực thật). */
export const DEMO_USER = {
  name: "Quản trị viên",
  role: "HR Manager",
  initials: "QT",
};

export const STATUS_LABEL: Record<AttendanceRecord["status"], string> = {
  "dung-gio": "Đúng giờ",
  "di-muon": "Đi muộn",
  "ve-som": "Về sớm",
  vang: "Vắng",
};

// ---------------------------------------------------------------------
// DỮ LIỆU DEMO CÁ NHÂN — chỉ phục vụ Tổng quan nhân viên (employee).
// Tuyệt đối không chứa số liệu toàn công ty (không tổng nhân viên,
// không lượt chấm công của người khác). Sẽ thay bằng Supabase (bản ghi
// của chính user đăng nhập) ở prompt nghiệp vụ chấm công thật.
// ---------------------------------------------------------------------

/** Một ngày chấm công của chính nhân viên (không có mã/tên người khác). */
export interface PersonalDayRecord {
  /** Nhãn ngày, ví dụ "Hôm nay", "14/10", "T2 13/10". */
  dateLabel: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
}

/** Trạng thái hôm nay của chính nhân viên. */
export const DEMO_PERSONAL_TODAY: PersonalDayRecord = {
  dateLabel: "Hôm nay",
  checkIn: "08:02",
  checkOut: null,
  status: "di-muon",
};

/** Tổng hợp tháng này của chính nhân viên. */
export const DEMO_PERSONAL_MONTH = {
  /** Ngày công đã ghi nhận trong tháng. */
  workDays: 14,
  /** Số lần đi muộn của chính nhân viên trong tháng. */
  lateCount: 2,
  /** Số ngày nghỉ đã duyệt trong tháng (để nhân viên tự đối chiếu). */
  leaveDays: 1,
};

/** 5 ngày gần nhất của chính nhân viên (mới nhất trước). */
export const DEMO_PERSONAL_RECENT: PersonalDayRecord[] = [
  { dateLabel: "Hôm nay", checkIn: "08:02", checkOut: null, status: "di-muon" },
  { dateLabel: "Hôm qua", checkIn: "07:52", checkOut: "17:05", status: "dung-gio" },
  { dateLabel: "2 ngày trước", checkIn: "07:55", checkOut: "17:01", status: "dung-gio" },
  { dateLabel: "3 ngày trước", checkIn: "08:15", checkOut: "17:00", status: "di-muon" },
  { dateLabel: "4 ngày trước", checkIn: "07:48", checkOut: "17:10", status: "dung-gio" },
];
