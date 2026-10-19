import { useEffect, useState } from "react";
import { ToastViewport } from "./components/Toast";
import { useToast } from "./hooks/useToast";
import { useAuth } from "./hooks/useAuth";
import { AccessDenied } from "./components/AccessDenied";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { CheckinPage } from "./pages/CheckinPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DepartmentsPage } from "./pages/DepartmentsPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { LeavePage } from "./pages/LeavePage";
import { ReportPage } from "./pages/ReportPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SchedulePage } from "./pages/SchedulePage";
import { WorkShiftsPage } from "./pages/WorkShiftsPage";
import { LoginPage } from "./pages/LoginPage";
import { MissingProfilePage, ProfilePage } from "./pages/ProfilePage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { PAGE_KEYS, pageKeyFromHash, type PageKey } from "./components/navigation";
import type { IconName } from "./components/icons";
import { initialsOf } from "./services/auth";
import { ROLE_LABEL } from "./types/auth";
import { canAccessPage, PAGE_ACCESS, PAGE_LABEL } from "./types/rbac";

function initialPageFromHash(): PageKey {
  if (typeof window === "undefined") return "overview";
  return pageKeyFromHash(window.location.hash) ?? "overview";
}

const PLACEHOLDERS: Record<Exclude<PageKey, "overview" | "history">, { icon: IconName; description: string }> = {
  checkin: {
    icon: "checkin",
    description: "Trang chấm công đã có giao diện thật (không dùng placeholder này nữa).",
  },
  employees: {
    icon: "employees",
    description: "Trang nhân viên đã có giao diện thật (không dùng placeholder này nữa).",
  },
  departments: {
    icon: "departments",
    description: "Trang phòng ban đã có giao diện thật (không dùng placeholder này nữa).",
  },
  shifts: {
    icon: "shifts",
    description: "Trang ca làm việc đã có giao diện thật (không dùng placeholder này nữa).",
  },
  schedule: {
    icon: "calendar",
    description: "Trang lịch làm việc đã có giao diện thật (không dùng placeholder này nữa).",
  },
  leave: {
    icon: "leave",
    description: "Trang nghỉ phép đã có giao diện thật (không dùng placeholder này nữa).",
  },
  report: {
    icon: "report",
    description:
      "Báo cáo tổng hợp đi muộn, vắng, công tháng sẽ tính từ dữ liệu chấm công thật.",
  },
  settings: {
    icon: "settings",
    description:
      "Cấu hình công ty, quy tắc chấm công và tài khoản sẽ bổ sung sau.",
  },
};

function FullScreenState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span
          aria-hidden="true"
          className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600"
        />
        <h1 className="mt-4 text-base font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}

function AuthErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { signOut, signingOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : "Đăng xuất chưa thành công. Vui lòng thử lại.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-lg font-bold text-slate-900">Chưa tải được thông tin đăng nhập</h1>
        <p role="alert" className="mt-2 text-sm text-slate-600">
          {message}
        </p>
        {signOutError && (
          <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {signOutError}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Thử lại
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

function SignedInApp() {
  const { profile, signOut, signingOut } = useAuth();
  const [active, setActive] = useState<PageKey>(initialPageFromHash);
  const [showProfile, setShowProfile] = useState(false);
  const { toasts, notify, dismiss } = useToast();

  // Đồng bộ hash URL để hỗ trợ tải trực tiếp URL, refresh và nút back/forward.
  useEffect(() => {
    function onHashChange() {
      const next = pageKeyFromHash(window.location.hash);
      if (next && PAGE_KEYS.includes(next)) {
        setShowProfile(false);
        setActive(next);
      }
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  if (!profile) return null;

  const allowed = canAccessPage(profile.role, active);

  async function handleSignOut() {
    try {
      await signOut();
      setShowProfile(false);
      setActive("overview");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Đăng xuất chưa thành công. Vui lòng thử lại.");
    }
  }

  function handleNavigate(key: PageKey) {
    setShowProfile(false);
    setActive(key);
    // Ghi hash để refresh / chia sẻ URL giữ đúng trang; guard vẫn chặn
    // nội dung khi vai trò không đủ quyền.
    if (typeof window !== "undefined") {
      const nextHash = `#/${key}`;
      if (window.location.hash !== nextHash) window.location.hash = nextHash;
    }
  }

  function handleBackToOverview() {
    handleNavigate("overview");
  }

  const roleBanner =
    profile.role === "admin"
      ? "Chế độ quản trị — toàn quyền nghiệp vụ theo chính sách hệ thống."
      : profile.role === "hr"
        ? "Chế độ nhân sự (HR) — quản lý nhân sự và duyệt nghiệp vụ được cấp quyền."
        : "Chế độ nhân viên — chỉ dữ liệu của chính bạn.";

  return (
    <>
      <DashboardLayout
        active={active}
        role={profile.role}
        onNavigate={handleNavigate}
        notify={notify}
        accountName={profile.full_name}
        accountRole={ROLE_LABEL[profile.role]}
        accountInitials={initialsOf(profile.full_name)}
        signingOut={signingOut}
        onOpenProfile={() => setShowProfile(true)}
        onSignOut={handleSignOut}
      >
        {showProfile ? (
          <ProfilePage onBack={() => setShowProfile(false)} />
        ) : !allowed ? (
          <AccessDenied
            pageLabel={PAGE_LABEL[active]}
            role={profile.role}
            requiredRoles={PAGE_ACCESS[active]}
            onBack={handleBackToOverview}
          />
        ) : (
          <>
            <p
              data-testid="role-banner"
              className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 shadow-sm"
            >
              {roleBanner}
            </p>
            {active === "overview" && (
              <DashboardPage
                role={profile.role}
                onViewAll={() => handleNavigate("history")}
                onCheckin={() => handleNavigate("checkin")}
              />
            )}
            {active === "history" && <HistoryPage />}
            {active === "checkin" && <CheckinPage />}
            {active === "employees" && <EmployeesPage notify={notify} />}
            {active === "departments" && <DepartmentsPage notify={notify} />}
            {active === "shifts" && <WorkShiftsPage notify={notify} />}
            {active === "schedule" && <SchedulePage notify={notify} />}
            {active === "leave" && <LeavePage notify={notify} />}
            {active === "report" && <ReportPage />}
            {active !== "overview" && active !== "history" && active !== "checkin" && active !== "employees" && active !== "departments" && active !== "shifts" && active !== "schedule" && active !== "leave" && (
              <PlaceholderPage
                title={
                  (
                    {
                      checkin: "Chấm công",
                      employees: "Nhân viên",
                      departments: "Phòng ban",
                      shifts: "Ca làm việc",
                      schedule: "Lịch làm việc",
                      leave: "Nghỉ phép",
                      report: "Báo cáo",
                      settings: "Cài đặt",
                    } as const
                  )[active]
                }
                icon={PLACEHOLDERS[active].icon}
                description={PLACEHOLDERS[active].description}
              />
            )}
          </>
        )}
      </DashboardLayout>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

function App() {
  const { status, error, reloadProfile } = useAuth();

  if (status === "booting") {
    return <FullScreenState title="Đang khởi động…" message="Đang khôi phục phiên đăng nhập." />;
  }
  if (status === "signed-out") {
    return <LoginPage />;
  }
  if (status === "loading-profile") {
    return <FullScreenState title="Đang tải hồ sơ…" message="Đang lấy thông tin người dùng từ hệ thống." />;
  }
  if (status === "missing-profile") {
    return <MissingProfilePage />;
  }
  if (status === "error") {
    return <AuthErrorState message={error ?? "Đã xảy ra lỗi."} onRetry={reloadProfile} />;
  }
  return <SignedInApp />;
}

export default App;
