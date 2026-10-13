import type { DailyCheckinPoint } from "../types";

// Biểu đồ cột SVG thuần (không thêm thư viện), vẽ từ dữ liệu demo.
// Sẽ nhận dữ liệu Supabase qua props khi có backend thật.
export function AttendanceChart({ data }: { data: DailyCheckinPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const barW = 44;
  const gap = 18;
  const height = 180;
  const width = data.length * (barW + gap) + gap;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height + 48}`}
        className="min-w-[420px] w-full"
        role="img"
        aria-label="Biểu đồ lượt chấm công theo ngày trong tuần (dữ liệu demo)"
      >
        {data.map((d, i) => {
          const h = Math.round((d.count / max) * height);
          const x = gap + i * (barW + gap);
          const y = height - h;
          const isMax = d.count === max;
          return (
            <g key={d.day}>
              <title>{`${d.day}: ${d.count} lượt chấm công (demo)`}</title>
              <rect x={x} y={0} width={barW} height={height} rx={6} className="fill-slate-100" />
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={6}
                className={isMax ? "fill-blue-600" : "fill-blue-400"}
              />
              <text
                x={x + barW / 2}
                y={y - 8}
                textAnchor="middle"
                className="fill-slate-700 text-sm font-semibold"
              >
                {d.count}
              </text>
              <text
                x={x + barW / 2}
                y={height + 24}
                textAnchor="middle"
                className="fill-slate-500 text-sm"
              >
                {d.day}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
