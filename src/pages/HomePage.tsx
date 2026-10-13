import { StatusCard } from "../components/StatusCard";
import { useNow } from "../hooks/useNow";
import { APP_TIMEZONE } from "../lib/constants";
import { formatNowInVietnamTimeZone } from "../lib/timezone";

export function HomePage() {
  const now = useNow();

  return (
    <section className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold">Attendance Management</h2>
        <p className="mt-2 text-slate-600">
          Website quản lý chấm công nhân viên. Dự án đang ở bước khởi tạo —
          chức năng chấm công, xác thực và kết nối cơ sở dữ liệu sẽ được triển
          khai ở các prompt tiếp theo.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Giờ hiện tại ({APP_TIMEZONE}):{" "}
          <span className="font-medium text-slate-800">
            {formatNowInVietnamTimeZone(now)}
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusCard
          title="Frontend"
          description="React + TypeScript + Vite đã chạy được trên localhost."
        />
        <StatusCard
          title="Cơ sở dữ liệu"
          description="Supabase PostgreSQL sẽ được cấu hình ở Prompt 2."
        />
        <StatusCard
          title="Triển khai"
          description="Tương thích Vercel, build bằng npm run build."
        />
      </div>
    </section>
  );
}
