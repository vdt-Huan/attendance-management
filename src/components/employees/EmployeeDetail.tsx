// Chi tiết nhân viên (Ngày 3.1): thông tin + phòng ban + dữ liệu liên quan
// đọc THẬT từ Supabase (phân ca, chấm công, đơn nghỉ). Không có dữ liệu
// thì hiển thị empty state đúng nghĩa, không tạo dữ liệu giả.

import { useEffect, useState } from "react";
import { getEmployeeDetail } from "../../services/employees";
import type { EmployeeDetail } from "../../types/employees";

interface EmployeeDetailViewProps {
  employeeId: string;
  onEdit: () => void;
  onToggleActive: () => void;
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {title} ({count})
      </h4>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-2 text-center text-xs text-slate-400">{text}</p>;
}

export function EmployeeDetailView({ employeeId, onEdit, onToggleActive }: EmployeeDetailViewProps) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setError(null);
    getEmployeeDetail(employeeId)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Chưa tải được chi tiết.");
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [employeeId]);

  if (state === "loading") {
    return (
      <div aria-label="Đang tải chi tiết" className="animate-pulse space-y-2 py-4">
        <div className="h-5 w-2/3 rounded bg-slate-100" />
        <div className="h-4 w-1/2 rounded bg-slate-100" />
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-full rounded bg-slate-100" />
      </div>
    );
  }

  if (state === "error" || !detail) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-3 text-center text-sm text-red-700">
        {error ?? "Chưa tải được chi tiết nhân viên."}
      </p>
    );
  }

  return (
    <div aria-label="Chi tiết nhân viên">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900">{detail.full_name}</h3>
          <p className="font-mono text-xs text-slate-500">{detail.employee_code}</p>
          <p className="mt-1">
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                detail.is_active ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-600"
              }`}
            >
              {detail.is_active ? "Đang làm việc" : "Ngừng hoạt động"}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Chỉnh sửa
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {detail.is_active ? "Vô hiệu hóa" : "Kích hoạt lại"}
          </button>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ["Email", detail.profile_email ?? "Chưa liên kết tài khoản"],
          ["Số điện thoại", detail.phone ?? "—"],
          ["Phòng ban", detail.department?.name ?? detail.department_name ?? "Chưa phân công"],
          ["Ngày vào làm", detail.hire_date ?? "—"],
          ["Tài khoản", detail.user_id ?? "Chưa liên kết"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="mt-0.5 break-all text-sm font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>

      <Section title="Lịch phân công gần đây" count={detail.assignments.length}>
        {detail.assignments.length === 0 ? (
          <EmptyLine text="Chưa có lịch phân công cho nhân viên này." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.assignments.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 py-1.5">
                <span className="font-medium text-slate-800">{a.work_date}</span>
                <span className="text-right text-xs text-slate-500">
                  {a.shift_name ?? "Ca đã bị xóa"} {a.start_time && a.end_time ? `(${a.start_time}–${a.end_time})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Lịch sử chấm công gần đây" count={detail.attendance.length}>
        {detail.attendance.length === 0 ? (
          <EmptyLine text="Chưa có bản ghi chấm công cho nhân viên này." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.attendance.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 py-1.5">
                <span className="font-medium text-slate-800">{a.work_date}</span>
                <span className="text-right text-xs text-slate-500">
                  {a.status}
                  {a.confirmed_at ? " · đã xác nhận" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Đơn nghỉ phép" count={detail.leaveRequests.length}>
        {detail.leaveRequests.length === 0 ? (
          <EmptyLine text="Chưa có đơn nghỉ phép của nhân viên này." />
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {detail.leaveRequests.map((l) => (
              <li key={l.id} className="flex justify-between gap-2 py-1.5">
                <span className="font-medium text-slate-800">
                  {l.start_date} → {l.end_date}
                </span>
                <span className="text-right text-xs text-slate-500">{l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
