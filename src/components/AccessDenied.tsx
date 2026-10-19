// Màn hình từ chối truy cập (403) — Ngày 2.2 RBAC.
// Hiển thị khi đã đăng nhập nhưng vai trò không đủ quyền vào trang.
// Phân biệt rõ với: đang tải session, chưa đăng nhập, lỗi tải profile.

import { ROLE_LABEL, type UserRole } from "../types/auth";

interface AccessDeniedProps {
  /** Trang người dùng cố truy cập. */
  pageLabel: string;
  /** Vai trò hiện tại (hiển thị nhãn thân thiện). */
  role: UserRole;
  /** Các vai trò được phép (hiển thị yêu cầu). */
  requiredRoles: readonly UserRole[];
  onBack: () => void;
}

export function AccessDenied({ pageLabel, role, requiredRoles, onBack }: AccessDeniedProps) {
  const required = requiredRoles.map((r) => ROLE_LABEL[r]).join(", ");
  return (
    <section
      aria-label="Không đủ quyền truy cập"
      data-testid="access-denied"
      className="rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-xl font-bold text-red-700">
        !
      </span>
      <h2 className="mt-3 text-lg font-bold text-slate-900">Không đủ quyền truy cập</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        Trang <span className="font-semibold text-slate-900">“{pageLabel}”</span> yêu cầu vai trò{" "}
        <span className="font-semibold text-slate-900">{required}</span>. Tài khoản của bạn đang có vai trò{" "}
        <span className="font-semibold text-slate-900">
          {ROLE_LABEL[role]} ({role})
        </span>
        .
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
        Việc chặn này thực hiện ở cả giao diện và database (RLS). Mọi thao tác trái quyền gọi trực tiếp Supabase API
        đều bị từ chối.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        ← Quay về Tổng quan
      </button>
    </section>
  );
}
