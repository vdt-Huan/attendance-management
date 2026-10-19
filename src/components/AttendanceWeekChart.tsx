// Biểu đồ chấm công 7 ngày gần nhất (CSS bar chart, không thêm dependency).

import type { AttendanceDayCount } from "../services/attendanceHistory";

interface AttendanceWeekChartProps {
  data: AttendanceDayCount[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  title?: string;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function AttendanceWeekChart({ data, loading, error, onRetry, title }: AttendanceWeekChartProps) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const hasData = data.some((d) => d.total > 0);

  return (
    <section aria-label={title ?? "Biểu đồ chấm công 7 ngày"} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-bold text-slate-900">{title ?? "Chấm công 7 ngày gần nhất"}</h2>
        <p className="text-xs text-slate-500">Số bản ghi theo ngày (Asia/Ho_Chi_Minh).</p>
      </div>

      {loading && (
        <div aria-label="Đang tải" className="h-40 animate-pulse rounded-lg bg-slate-100" />
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p role="alert" className="text-sm text-red-700">{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Thử lại
            </button>
          )}
        </div>
      )}

      {!loading && !error && !hasData && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm font-medium text-slate-700">Chưa có dữ liệu chấm công trong 7 ngày gần nhất.</p>
        </div>
      )}

      {!loading && !error && hasData && (
        <>
          <div className="flex items-end gap-2" style={{ height: 160 }}>
            {data.map((d) => {
              const totalH = (d.total / max) * 100;
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className="w-full max-w-[44px] overflow-hidden rounded-t-md bg-slate-200"
                      style={{ height: `${totalH}%` }}
                      title={`${shortDate(d.date)}: ${d.total} bản ghi (đúng giờ ${d.onTime}, đi muộn ${d.late}, về sớm ${d.early}, vắng ${d.absent})`}
                    >
                      <div className="bg-slate-400" style={{ height: `${(d.absent / Math.max(1, d.total)) * 100}%` }} />
                      <div className="bg-blue-500" style={{ height: `${(d.early / Math.max(1, d.total)) * 100}%` }} />
                      <div className="bg-amber-500" style={{ height: `${(d.late / Math.max(1, d.total)) * 100}%` }} />
                      <div className="bg-green-500" style={{ height: `${(d.onTime / Math.max(1, d.total)) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500">{shortDate(d.date)}</span>
                  <span className="text-[10px] font-semibold text-slate-700">{d.total}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" />Đúng giờ</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />Đi muộn</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Về sớm</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Vắng</span>
          </div>
        </>
      )}
    </section>
  );
}
