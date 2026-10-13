import { useEffect, useState } from "react";
import {
  DEMO_ATTENDANCE,
  DEMO_STATS,
  DEMO_WEEKLY_CHECKINS,
} from "../services/demoData";
import type {
  AttendanceFilter,
  AttendanceRecord,
  DailyCheckinPoint,
  DashboardStats,
  DataState,
} from "../types";

interface DemoAttendance {
  state: DataState;
  stats: DashboardStats | null;
  records: AttendanceRecord[];
  weekly: DailyCheckinPoint[];
  error: string | null;
  reload: () => void;
}

function matches(record: AttendanceRecord, query: string, filter: AttendanceFilter) {
  const q = query.trim().toLowerCase();
  const byQuery =
    q.length === 0 ||
    record.fullName.toLowerCase().includes(q) ||
    record.employeeCode.toLowerCase().includes(q);
  const byFilter = filter === "all" || record.status === filter;
  return byQuery && byFilter;
}

// Hook cấp dữ liệu demo cho giao diện (Prompt 2).
// Giả lập độ trễ tải lần đầu để thể hiện loading state; mọi lỗi đều được
// bắt và chuyển sang error state kèm nút thử lại. Sẽ thay bằng Supabase.
export function useDemoAttendance(
  query = "",
  filter: AttendanceFilter = "all",
  reloadKey = 0,
): DemoAttendance {
  const [state, setState] = useState<DataState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        // Đọc từ nguồn demo duy nhất; throw nếu nguồn lỗi để test error state.
        if (!DEMO_ATTENDANCE || !DEMO_STATS || !DEMO_WEEKLY_CHECKINS) {
          throw new Error("Không tải được dữ liệu demo.");
        }
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định.");
        setState("error");
      }
    }, 400);
    return () => clearTimeout(id);
  }, [reloadKey, attempt]);

  return {
    state,
    stats: state === "ready" ? DEMO_STATS : null,
    records:
      state === "ready"
        ? DEMO_ATTENDANCE.filter((r) => matches(r, query, filter))
        : [],
    weekly: state === "ready" ? DEMO_WEEKLY_CHECKINS : [],
    error,
    reload: () => {
      setState("loading");
      setError(null);
      setAttempt((n) => n + 1);
    },
  };
}
