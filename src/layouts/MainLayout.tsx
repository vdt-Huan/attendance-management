import type { ReactNode } from "react";
import { APP_NAME } from "../lib/constants";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold">{APP_NAME}</h1>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Ngày 1 — Khởi tạo dự án
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 text-sm text-slate-500">
          Múi giờ nghiệp vụ: Asia/Ho_Chi_Minh
        </div>
      </footer>
    </div>
  );
}
