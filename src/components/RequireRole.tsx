// Route guard dùng chung (Ngày 2.2 RBAC).
//
// Phân biệt 5 trạng thái theo yêu cầu:
// - "loading": đang tải session (booting) hoặc hồ sơ (loading-profile)
// - "unauthenticated": chưa đăng nhập → LoginPage
// - "profile-error": lỗi tải profile / role lạ / thiếu hồ sơ
// - "forbidden": đã đăng nhập nhưng role không đủ quyền
// - "allowed": cho render nội dung
//
// Dùng trong App.tsx cho mọi PageKey. Bảo mật thật nằm ở RLS database;
// component này chỉ đảm bảo UX đúng + không lộ nội dung trang cấm.

import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { canAccessPage, PAGE_ACCESS, PAGE_LABEL } from "../types/rbac";
import type { PageKey } from "./navigation";
import { AccessDenied } from "./AccessDenied";

interface RequireRoleProps {
  page: PageKey;
  children: ReactNode;
  onBack: () => void;
}

export function RequireRole({ page, children, onBack }: RequireRoleProps) {
  const { status, profile } = useAuth();

  // Các trạng thái tải / chưa đăng nhập / lỗi do App.tsx xử lý ở cổng ngoài.
  // Ở đây chỉ guard khi đã sẵn sàng.
  if (status !== "ready" || !profile) return null;

  if (!canAccessPage(profile.role, page)) {
    return (
      <AccessDenied
        pageLabel={PAGE_LABEL[page]}
        role={profile.role}
        requiredRoles={PAGE_ACCESS[page]}
        onBack={onBack}
      />
    );
  }

  return <>{children}</>;
}
