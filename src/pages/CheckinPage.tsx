// Trang chấm công cho Employee (Ngày 5.1).
//
// - Chỉ Employee truy cập (guard PAGE_ACCESS = admin, hr, employee).
// - Lấy employee_id từ hook useAuth (profile.id = employees.user_id).
// - Hiển thị ca làm hôm nay (nếu có phân công).
// - Trạng thái: Chưa chấm công → nút Check-in; Đã check-in → nút Check-out;
//   Đã check-out / Đã xác nhận → chỉ xem.
// - Chống nhấn trùng (actionState), loading, lỗi thân thiện từ RPC.
// - Ghi chú tùy chọn (max 1000 ký tự, RPC validate).
// - Thời gian hiển thị theo múi giờ local (format từ timestamptz DB).

import { useEffect, useState } from "react";
import { useCheckin } from "../hooks/useCheckin";
import { getMyEmployeeId } from "../services/schedule";
import { formatTime, formatDate, STATUS_LABEL } from "../services/checkin";

export function CheckinPage() {
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Employee: profile.id = employees.user_id → lấy employee.id
  useEffect(() => {
    if (checked) return;
    getMyEmployeeId()
      .then((id) => {
        setMyEmployeeId(id);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, []);

  const checkin = useCheckin(myEmployeeId);

  if (!checked) {
    return (
      <section aria-label="Đang tải thông tin" className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
        <p className="mt-3 text-sm text-slate-500">Đang tải hồ sơ nhân viên…</p>
      </section>
    );
  }

  if (!myEmployeeId) {
    return (
      <section aria-label="Chưa có hồ sơ" className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-700">!</span>
        <h2 className="mt-3 text-base font-bold text-slate-900">Chưa có hồ sơ nhân viên</h2>
        <p className="mt-2 text-sm text-slate-600">Tài khoản của bạn chưa được liên kết với hồ sơ nhân viên. Vui lòng liên hệ HR/Admin.</p>
      </section>
    );
  }

  const today = new Date();
  const todayVN = today.toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <section aria-label="Chấm công" className="space-y-4">
      {/* Header ngày & ca */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Chấm công</h2>
            <p className="text-xs text-slate-500">Ngày hôm nay: <span className="font-medium text-slate-700">{todayVN}</span></p>
          </div>
          <button
            type="button"
            onClick={checkin.reload}
            disabled={checkin.state === "loading" || checkin.actionState !== "idle"}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {checkin.state === "loading" ? "Đang tải…" : "Làm mới"}
          </button>
        </div>

        {/* Thông tin ca làm hôm nay */}
        {checkin.attendance?.shift && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3 border border-blue-100">
            <p className="text-xs font-medium text-blue-800">Ca làm hôm nay</p>
            <p className="mt-1 text-sm font-semibold text-blue-900">{checkin.attendance.shift.name}</p>
            <p className="text-xs text-blue-700">
              {formatTime(checkin.attendance.shift.start_time)} – {formatTime(checkin.attendance.shift.end_time)}
              {checkin.attendance.shift.late_after_minutes > 0 && (
                <> · Cho phép muộn {checkin.attendance.shift.late_after_minutes} phút</>
              )}
            </p>
          </div>
        )}

        {/* Không có ca */}
        {!checkin.attendance?.shift && checkin.state === "ready" && (
          <div className="mt-4 rounded-lg bg-amber-50 p-3 border border-amber-100">
            <p className="text-xs font-medium text-amber-800">Chưa có phân công ca hôm nay</p>
            <p className="mt-1 text-xs text-amber-700">Bạn vẫn có thể chấm công, nhưng không có giờ chuẩn để đối chiếu.</p>
          </div>
        )}
      </div>

      {/* Trạng thái chấm công */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {checkin.state === "loading" && (
          <div className="animate-pulse space-y-2">
            <div className="h-10 w-1/3 rounded bg-slate-100" />
            <div className="h-8 w-1/4 rounded bg-slate-100" />
          </div>
        )}

        {checkin.state === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p role="alert" className="text-sm text-red-700">{checkin.error}</p>
            <button
              type="button"
              onClick={checkin.reload}
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Thử lại
            </button>
          </div>
        )}

        {checkin.state === "ready" && checkin.attendance && (
          <>
            {/* Card trạng thái */}
            <div
              className={`rounded-xl p-4 text-center ${
                checkin.attendance.status === "none" ? "bg-slate-50 border border-slate-200" :
                checkin.attendance.status === "checked_in" ? "bg-blue-50 border border-blue-200" :
                checkin.attendance.status === "checked_out" ? "bg-green-50 border border-green-200" :
                "bg-indigo-50 border border-indigo-200"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Trạng thái</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {STATUS_LABEL[checkin.attendance.status]}
              </p>
              {checkin.attendance.record && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-white/70 p-2">
                    <p className="text-slate-500">Giờ vào</p>
                    <p className="font-mono font-medium text-slate-900">{formatTime(checkin.attendance.record.check_in)}</p>
                  </div>
                  <div className="rounded-lg bg-white/70 p-2">
                    <p className="text-slate-500">Giờ ra</p>
                    <p className="font-mono font-medium text-slate-900">{formatTime(checkin.attendance.record.check_out)}</p>
                  </div>
                  {checkin.attendance.record.confirmed_at && (
                    <div className="col-span-2 rounded-lg bg-white/70 p-2">
                      <p className="text-slate-500">Đã xác nhận lúc</p>
                      <p className="font-mono font-medium text-slate-900">
                        {formatTime(checkin.attendance.record.confirmed_at)} ({formatDate(checkin.attendance.record.confirmed_at.split("T")[0])})
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Form ghi chú + nút hành động */}
            <div className="mt-4 space-y-3">
              {checkin.canClockIn && (
                <CheckinForm
                  label="Ghi chú check-in (tùy chọn)"
                  placeholder="VD: Đi muộn do kẹt xe"
                  onSubmit={(note) => checkin.clockIn(note ?? "")}
                  loading={checkin.actionState === "clocking_in"}
                  error={checkin.actionError}
                />
              )}
              {checkin.canClockOut && (
                <CheckinForm
                  label="Ghi chú check-out (tùy chọn)"
                  placeholder="VD: Về sớm hoàn thành việc"
                  onSubmit={(note) => checkin.clockOut(note ?? "")}
                  loading={checkin.actionState === "clocking_out"}
                  error={checkin.actionError}
                />
              )}
              {checkin.attendance.status === "checked_out" && !checkin.canClockIn && !checkin.canClockOut && (
                <p className="text-center text-sm text-slate-500">Hoàn tất chấm công hôm nay. Cảm ơn bạn!</p>
              )}
              {checkin.attendance.status === "confirmed" && (
                <p className="text-center text-sm text-indigo-700">Bản ghi đã được HR/Admin xác nhận. Không thể sửa thêm.</p>
              )}
            </div>
          </>
        )}

        {checkin.state === "ready" && !checkin.attendance && (
          <p className="text-center text-sm text-slate-500">Không tải được trạng thái chấm công.</p>
        )}
      </div>

      {/* Ghi chú: thời gian do DB ghi */}
      <p className="text-center text-[11px] text-slate-400">
        Thời gian chấm công được ghi nhận bởi máy chủ (múi giờ Asia/Ho_Chi_Minh). Giao diện chỉ hiển thị.
      </p>
    </section>
  );
}

function CheckinForm({
  label,
  placeholder,
  onSubmit,
  loading,
  error,
}: {
  label: string;
  placeholder: string;
  onSubmit: (note: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(note.trim());
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={placeholder}
          maxLength={1000}
          rows={2}
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
        />
        <p className="mt-1 text-xs text-slate-400">Tối đa 1000 ký tự.</p>
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
          loading
            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
            : onSubmit.name === "clockIn" || onSubmit.toString().includes("clockIn")
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-green-600 text-white hover:bg-green-700"
        }`}
      >
        {loading ? "Đang xử lý…" : onSubmit.toString().includes("clockIn") ? "Check-in" : "Check-out"}
      </button>
    </form>
  );
}