import { APP_NAME } from "../lib/constants";
import { Icons } from "./icons";
import { NAV_ITEMS, type PageKey } from "./navigation";

interface SidebarProps {
  active: PageKey;
  collapsed: boolean;
  onNavigate: (key: PageKey) => void;
}

function SidebarBody({ active, collapsed, onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
          A
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{APP_NAME}</p>
            <p className="text-xs text-slate-500">Quản lý chấm công</p>
          </div>
        )}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Điều hướng chính">
        {NAV_ITEMS.map((item) => {
          const Icon = Icons[item.icon];
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              aria-current={selected ? "page" : undefined}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && !item.implemented && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  Sắp có
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {!collapsed && (
        <p className="px-4 pb-4 text-[11px] leading-relaxed text-slate-400">
          Số liệu trên giao diện hiện là dữ liệu demo.
        </p>
      )}
    </div>
  );
}

export function Sidebar(props: SidebarProps & { mobileOpen: boolean; onCloseMobile: () => void }) {
  const { mobileOpen, onCloseMobile, ...bodyProps } = props;
  const handleNavigate: SidebarProps["onNavigate"] = (key) => {
    props.onNavigate(key);
    onCloseMobile();
  };

  return (
    <>
      {/* Sidebar desktop */}
      <aside
        className={`hidden shrink-0 border-r border-slate-200 bg-white transition-all lg:block ${
          props.collapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarBody {...bodyProps} onNavigate={props.onNavigate} />
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <SidebarBody active={bodyProps.active} collapsed={false} onNavigate={handleNavigate} />
          </aside>
        </div>
      )}
    </>
  );
}
