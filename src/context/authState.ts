import { createContext } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { fetchMyProfile } from "../services/auth";
import type { AuthState, UserProfile } from "../types/auth";

export interface AuthContextValue extends AuthState {
  /** Đăng nhập rồi đồng bộ profile; ném Error tiếng Việt khi thất bại. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Đăng xuất và về trạng thái signed-out; ném Error khi thất bại. */
  signOut: () => Promise<void>;
  /** Tải lại profile (dùng cho nút Thử lại). */
  reloadProfile: () => void;
  signingOut: boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const BOOTING_STATE: AuthState = { status: "booting", user: null, profile: null, error: null };

export const MISSING_ENV_STATE: AuthState = {
  status: "error",
  user: null,
  profile: null,
  error: "Chưa cấu hình Supabase. Sao chép .env.example thành .env và điền URL + publishable key.",
};

export async function loadProfileFor(user: SupabaseUser): Promise<AuthState> {
  const res = await fetchMyProfile(user.id);
  if (res.found) {
    const profile: UserProfile = res.profile;
    return { status: "ready", user, profile, error: null };
  }
  if (res.missing) {
    // Auth user tồn tại nhưng chưa có dòng profiles: KHÔNG cấp quyền,
    // KHÔNG tự tạo — UI hiển thị hướng dẫn liên hệ quản trị.
    return { status: "missing-profile", user, profile: null, error: null };
  }
  return { status: "error", user, profile: null, error: res.message };
}
