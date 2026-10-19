import { useState } from "react";
import { useDismiss } from "../hooks/useDismiss";
import { useNow } from "../hooks/useNow";
import { DEMO_NOTIFICATIONS } from "../services/demoData";
import { Icons } from "./icons";
import { formatDateShortInVietnamTimeZone, formatNowInVietnamTimeZone } from "../lib/timezone";

interface HeaderProps {
  pageTitle: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
  notify: (message: string) => void;
  accountName: string;
  accountRole: string;
  accountInitials: string;
  signingOut: boolean;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

export function Header({
  pageTitle,
  collapsed,
  onToggleCollapse,
  onOpenMobile,
  notify,
  accountName,
  accountRole,
  accountInitials,
  signingOut,
  onOpenProfile,
  onSignOut,
}: HeaderProps) {
  const now = useNow();
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [readAll, setReadAll] = useState(false);
  const bellRef = useDismiss(() => setBellOpen(false));
  const menuRef = useDismiss(() => setMenuOpen(false));

  const notifications = DEMO_NOTIFICATIONS.map((n) => ({
    ...n,
    unread: n.unread && !readAll,
  }));
  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3">
        {/* Mở drawer trên mobile */}
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Mở menu điều hướng"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Icons.menu />
        </button>
        {/* Thu gọn sidebar trên desktop */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:block"
        >
          <span className={`block transition-transform ${collapsed ? "rotate-180" : ""}`}>
            <Icons.chevronLeft />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">{pageTitle}</h1>
          <p className="hidden items-center gap-1 truncate text-xs text-slate-500 sm:flex">
            <Icons.calendar className="h-3.5 w-3.5" />
            {formatNowInVietnamTimeZone(now)}
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-slate-500 sm:hidden">
            <Icons.calendar className="h-3.5 w-3.5" />
            {formatDateShortInVietnamTimeZone(now)}
          </p>
        </div>

        {/* Thông báo */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setBellOpen((o) => !o)}
            aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ""}`}
            aria-expanded={bellOpen}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
          >
            <Icons.bell />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[85vw] rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Thông báo (demo)</p>
                <button
                  type="button"
                  onClick={() => {
                    setReadAll(true);
                    notify("Đã đánh dấu tất cả thông báo là đã đọc.");
                  }}
                  disabled={unreadCount === 0}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-slate-300"
                >
                  Đánh dấu đã đọc
                </button>
              </div>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {notifications.map((n) => (
                  <li key={n.id} className="px-4 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {n.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{n.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{n.time}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Tài khoản thật (Supabase Auth + profiles) */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu tài khoản"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {accountInitials}
            </span>
            <span className="hidden text-left md:block">
              <span className="block max-w-36 truncate text-sm font-medium leading-tight text-slate-900">
                {accountName}
              </span>
              <span className="block text-xs leading-tight text-slate-500">{accountRole}</span>
            </span>
            <Icons.chevronDown className="hidden h-4 w-4 text-slate-500 md:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <p className="truncate border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
                {accountName}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenProfile();
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Icons.user className="h-4 w-4 text-slate-400" />
                Hồ sơ cá nhân
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSignOut();
                }}
                disabled={signingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:text-slate-300"
              >
                <Icons.logout className="h-4 w-4 text-slate-400" />
                {signingOut ? "Đang đăng xuất…" : "Đăng xuất"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
