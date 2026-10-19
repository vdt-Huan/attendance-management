import { useState } from "react";
import { ROLE_LABEL } from "../types/auth";
import { useAuth } from "../hooks/useAuth";
import { initialsOf } from "../services/auth";

/** Trang hồ sơ cá nhân: dữ liệu thật từ Supabase Auth + public.profiles. */
export function ProfilePage({ onBack }: { onBack: () => void }) {
  const { user, profile } = useAuth();

  return (
    <section aria-label="Hồ sơ cá nhân" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        ← Quay lại
      </button>
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
          {profile ? initialsOf(profile.full_name) : "?"}
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900">{profile?.full_name ?? "—"}</h2>
          <p className="text-sm text-slate-500">{profile ? ROLE_LABEL[profile.role] : "—"}</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Họ tên</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{profile?.full_name ?? "—"}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Email</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{profile?.email ?? user?.email ?? "—"}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Vai trò</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">
            {profile ? `${ROLE_LABEL[profile.role]} (${profile.role})` : "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 px-4 py-3">
          <dt className="text-xs text-slate-500">Mã người dùng</dt>
          <dd className="mt-0.5 break-all font-mono text-xs text-slate-700">{profile?.id ?? user?.id ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-slate-400">
        Thông tin lấy trực tiếp từ Supabase Auth và bảng public.profiles. Mọi thay đổi vai trò do quản trị viên thực
        hiện.
      </p>
    </section>
  );
}

/**
 * Màn hình khi Auth user chưa có dòng profiles tương ứng.
 * KHÔNG mặc định role, KHÔNG tự tạo profile đặc quyền — chỉ hướng dẫn.
 */
export function MissingProfilePage() {
  const { user, signOut, signingOut, reloadProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    try {
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng xuất chưa thành công. Vui lòng thử lại.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-700">
          !
        </span>
        <h1 className="mt-3 text-lg font-bold text-slate-900">Tài khoản chưa có hồ sơ</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tài khoản <span className="font-medium text-slate-900">{user?.email ?? "của bạn"}</span> đã đăng nhập thành
          công nhưng chưa có hồ sơ trong hệ thống. Tài khoản chưa được cấp quyền nào.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Vui lòng liên hệ quản trị viên (HR/Admin) để tạo hồ sơ nhân viên và gán vai trò phù hợp, sau đó nhấn{" "}
          <span className="font-medium">Tải lại</span>.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={reloadProfile}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Tải lại
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:bg-slate-50"
          >
            {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      </div>
    </div>
  );
}
