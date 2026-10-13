import { useState } from "react";
import { ToastViewport } from "./components/Toast";
import { useToast } from "./hooks/useToast";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import type { PageKey } from "./components/navigation";
import type { IconName } from "./components/icons";

const PLACEHOLDERS: Record<Exclude<PageKey, "overview" | "history">, { icon: IconName; description: string }> = {
  checkin: {
    icon: "checkin",
    description:
      "Màn hình bấm giờ vào/ra của nhân viên sẽ được xây dựng cùng nghiệp vụ chấm công thật ở prompt tiếp theo.",
  },
  employees: {
    icon: "employees",
    description:
      "Danh sách, thêm/sửa nhân viên sẽ kết nối Supabase và phân quyền ở prompt tiếp theo.",
  },
  shifts: {
    icon: "shifts",
    description:
      "Định nghĩa ca làm việc, giờ vào/ra chuẩn sẽ được triển khai sau khi chốt schema.",
  },
  leave: {
    icon: "leave",
    description:
      "Gửi và duyệt đơn nghỉ phép là nghiệp vụ thật, chưa triển khai trong phạm vi giao diện này.",
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

function App() {
  const [active, setActive] = useState<PageKey>("overview");
  const { toasts, notify, dismiss } = useToast();

  return (
    <>
      <DashboardLayout active={active} onNavigate={setActive} notify={notify}>
        {active === "overview" && <DashboardPage onViewAll={() => setActive("history")} />}
        {active === "history" && <HistoryPage />}
        {active !== "overview" && active !== "history" && (
          <PlaceholderPage
            title={
              (
                {
                  checkin: "Chấm công",
                  employees: "Nhân viên",
                  shifts: "Ca làm việc",
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
      </DashboardLayout>
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </>
  );
}

export default App;
