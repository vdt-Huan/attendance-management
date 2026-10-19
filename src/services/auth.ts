// Tầng gọi Supabase Auth + public.profiles (Ngày 2.1).
//
// NGUYÊN TẮC:
// - Không lưu mật khẩu/token bằng cơ chế tự viết (supabase-js tự quản lý
//   session trong storage của nó).
// - Không tự tạo profile từ frontend, không mặc định role.
// - Mọi lỗi đều chuyển thành thông điệp tiếng Việt thân thiện, không lộ
//   chi tiết kỹ thuật hay bí mật.

import type { User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase";
import { isUserRole, type UserProfile } from "../types/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInInput {
  email: string;
  password: string;
}

export interface FieldErrors {
  email?: string;
  password?: string;
}

/** Validate client-side: trường bắt buộc + định dạng email. */
export function validateSignIn(input: SignInInput): FieldErrors {
  const errors: FieldErrors = {};
  const email = input.email.trim();
  if (!email) {
    errors.email = "Vui lòng nhập email.";
  } else if (!EMAIL_RE.test(email)) {
    errors.email = "Email chưa đúng định dạng (ví dụ: ten@congty.vn).";
  }
  if (!input.password) {
    errors.password = "Vui lòng nhập mật khẩu.";
  }
  return errors;
}

/** Chuyển lỗi Supabase/mạng thành thông điệp tiếng Việt thân thiện. */
export function toFriendlyAuthError(err: unknown): string {
  if (err instanceof Error) {
    const raw = `${err.name}: ${err.message}`.toLowerCase();
    if (
      raw.includes("invalid login credentials") ||
      raw.includes("invalid password") ||
      raw.includes("user not found")
    ) {
      return "Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.";
    }
    if (raw.includes("email not confirmed") || raw.includes("not confirmed")) {
      return "Tài khoản chưa xác nhận email. Vui lòng kiểm tra hộp thư hoặc liên hệ quản trị viên.";
    }
    if (
      raw.includes("too many requests") ||
      raw.includes("rate limit") ||
      raw.includes("over request rate")
    ) {
      return "Bạn thao tác quá nhanh. Vui lòng đợi một lúc rồi thử lại.";
    }
    if (
      raw.includes("failed to fetch") ||
      raw.includes("networkerror") ||
      raw.includes("network request failed") ||
      raw.includes("fetch failed") ||
      raw.includes("enotfound") ||
      raw.includes("timeout")
    ) {
      return "Không kết nối được tới máy chủ đăng nhập. Kiểm tra mạng rồi thử lại.";
    }
    // Giữ message gốc nếu đã là tiếng Việt từ service (ví dụ lỗi validate).
    if (/[\u00C0-\u1EF9]/.test(err.message)) return err.message;
    return `Đăng nhập chưa thành công: ${err.message}`;
  }
  return "Đăng nhập chưa thành công. Vui lòng thử lại.";
}

/**
 * Đăng nhập bằng email + mật khẩu.
 * Chỉ resolve khi Supabase xác nhận thành công — caller KHÔNG được hiện
 * thông báo thành công trước lúc này.
 */
export async function signInWithPassword(input: SignInInput): Promise<SupabaseUser> {
  const fieldErrors = validateSignIn(input);
  if (fieldErrors.email ?? fieldErrors.password) {
    throw new Error(fieldErrors.email ?? fieldErrors.password ?? "Dữ liệu nhập chưa hợp lệ.");
  }
  const client = getSupabaseClient();
  let result: Awaited<ReturnType<typeof client.auth.signInWithPassword>>;
  try {
    result = await client.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
  } catch (err) {
    throw new Error(toFriendlyAuthError(err));
  }
  if (result.error) throw new Error(toFriendlyAuthError(result.error));
  if (!result.data.user) throw new Error("Đăng nhập chưa thành công. Vui lòng thử lại.");
  return result.data.user;
}

export type SignOutResult = { ok: true } | { ok: false; message: string };

/** Đăng xuất: xóa session theo cơ chế Supabase. */
export async function signOutEverywhere(): Promise<SignOutResult> {
  try {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) return { ok: false, message: toFriendlyAuthError(error) };
    return { ok: true };
  } catch (err) {
    return { ok: false, message: toFriendlyAuthError(err) };
  }
}

export type ProfileResult =
  | { found: true; profile: UserProfile }
  | { found: false; missing: true }
  | { found: false; missing: false; message: string };

/** Lấy profile của chính user đang đăng nhập. Không tự tạo, không mặc định role. */
export async function fetchMyProfile(userId: string): Promise<ProfileResult> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) {
      const msg = `${error.name}: ${error.message}`.toLowerCase();
      if (msg.includes("expired") || msg.includes("invalid") || error.status === 401) {
        return { found: false, missing: false, message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
      }
      return { found: false, missing: false, message: toFriendlyAuthError(error) };
    }
    if (!data.session) {
      return { found: false, missing: false, message: "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại." };
    }
    const { data: row, error: qErr } = await client
      .from("profiles")
      .select("id, email, full_name, role, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle();
    if (qErr) {
      return { found: false, missing: false, message: toFriendlyAuthError(qErr) };
    }
    if (!row) return { found: false, missing: true };
    if (typeof row.full_name !== "string" || typeof row.email !== "string") {
      return { found: false, missing: false, message: "Hồ sơ người dùng chưa đầy đủ. Liên hệ quản trị viên." };
    }
    if (typeof row.role !== "string" || !isUserRole(row.role)) {
      // Role lạ trong DB: không tự gán, coi như lỗi dữ liệu an toàn.
      return { found: false, missing: false, message: "Vai trò trong hồ sơ chưa hợp lệ. Liên hệ quản trị viên." };
    }
    return {
      found: true,
      profile: {
        id: String(row.id),
        email: row.email,
        full_name: row.full_name,
        role: row.role,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      },
    };
  } catch (err) {
    return { found: false, missing: false, message: toFriendlyAuthError(err) };
  }
}

/** Lấy chữ cái viết tắt cho avatar từ họ tên. */
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase();
}
