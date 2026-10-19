// Kiểu xác thực và hồ sơ người dùng (Ngày 2.1).
// Dữ liệu lấy từ Supabase Auth + bảng public.profiles thật —
// KHÔNG mặc định role, KHÔNG tự nâng quyền ở bất kỳ đâu.

import type { User as SupabaseUser } from "@supabase/supabase-js";

export type UserRole = "admin" | "hr" | "employee";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type AuthStatus =
  | "booting"
  | "signed-out"
  | "loading-profile"
  | "ready"
  | "missing-profile"
  | "error";

export interface AuthState {
  status: AuthStatus;
  /** Auth user từ Supabase Auth (null khi chưa đăng nhập). */
  user: SupabaseUser | null;
  /** Hồ sơ từ public.profiles (null khi chưa đăng nhập / chưa có). */
  profile: UserProfile | null;
  /** Thông điệp lỗi thân thiện khi status === "error". */
  error: string | null;
}

export function isUserRole(value: string): value is UserRole {
  return value === "admin" || value === "hr" || value === "employee";
}

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Quản trị viên",
  hr: "Nhân sự (HR)",
  employee: "Nhân viên",
};
