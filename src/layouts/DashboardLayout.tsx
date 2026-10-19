import { useState, type ReactNode } from "react";
import { Header } from "../components/Header";
import { NAV_ITEMS, type PageKey } from "../components/navigation";
import { Sidebar } from "../components/Sidebar";
import type { UserRole } from "../types/auth";

interface DashboardLayoutProps {
  active: PageKey;
  role: UserRole;
  onNavigate: (key: PageKey) => void;
  notify: (message: string) => void;
  accountName: string;
  accountRole: string;
  accountInitials: string;
  signingOut: boolean;
  onOpenProfile: () => void;
  onSignOut: () => void;
  children: ReactNode;
}

export function DashboardLayout({
  active,
  role,
  onNavigate,
  notify,
  accountName,
  accountRole,
  accountInitials,
  signingOut,
  onOpenProfile,
  onSignOut,
  children,
}: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pageTitle = NAV_ITEMS.find((i) => i.key === active)?.label ?? "Tổng quan";

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <Sidebar
        active={active}
        collapsed={collapsed}
        role={role}
        onNavigate={onNavigate}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          pageTitle={pageTitle}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
          notify={notify}
          accountName={accountName}
          accountRole={accountRole}
          accountInitials={accountInitials}
          signingOut={signingOut}
          onOpenProfile={onOpenProfile}
          onSignOut={onSignOut}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-slate-200 bg-white px-4 py-3 text-center text-xs text-slate-500 sm:px-6">
          Attendance Management — Múi giờ Asia/Ho_Chi_Minh · Số liệu demo phục vụ giao diện
        </footer>
      </div>
    </div>
  );
}
