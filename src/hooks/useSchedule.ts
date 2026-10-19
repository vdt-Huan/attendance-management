// Hook lịch làm việc tuần (Ngày 4.2): chọn ngày/chuyển tuần, bộ lọc
// nhân viên–phòng ban–ca, phân trang nhân viên ở server.

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, listWeekSchedule, startOfWeek, weekDays } from "../services/schedule";
import type { ScheduleRow } from "../services/schedule";

export type ScheduleState = "loading" | "ready" | "error";

export const SCHEDULE_PAGE_SIZE = 10;

const DEBOUNCE_MS = 300;

interface UseScheduleOptions {
  /** employee: khóa cứng chỉ xem lịch chính mình. */
  lockedEmployeeIds: string[] | null;
}

export function useSchedule({ lockedEmployeeIds }: UseScheduleOptions) {
  const [monday, setMonday] = useState<Date>(() => startOfWeek(new Date()));
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [shiftId, setShiftId] = useState("all");
  const [page, setPage] = useState(0);

  const [state, setState] = useState<ScheduleState>("loading");
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, departmentId, shiftId, monday]);

  const days = weekDays(monday);
  const totalPages = Math.max(1, Math.ceil(totalEmployees / SCHEDULE_PAGE_SIZE));

  useEffect(() => {
    let alive = true;
    setState("loading");
    setError(null);
    listWeekSchedule(days[0] ?? "", days[6] ?? "", {
      employeeIds: lockedEmployeeIds ?? [],
      departmentId: lockedEmployeeIds ? "all" : departmentId,
      shiftId,
      search: lockedEmployeeIds ? "" : debouncedSearch,
      page: lockedEmployeeIds ? 0 : page,
      pageSize: SCHEDULE_PAGE_SIZE,
    })
      .then((res) => {
        if (!alive) return;
        setRows(res.rows);
        setTotalEmployees(res.totalEmployees);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Chưa tải được lịch.");
        setState("error");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0], page, debouncedSearch, departmentId, shiftId, reloadKey, lockedEmployeeIds?.join(",")]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const goWeek = useCallback((delta: number) => setMonday((m) => addDays(m, delta * 7)), []);
  const goToday = useCallback(() => setMonday(startOfWeek(new Date())), []);
  const pickDate = useCallback((iso: string) => {
    const d = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(d.getTime())) setMonday(startOfWeek(d));
  }, []);

  return {
    monday,
    days,
    totalPages,
    search,
    setSearch,
    departmentId,
    setDepartmentId,
    shiftId,
    setShiftId,
    page,
    setPage,
    state,
    rows,
    totalEmployees,
    error,
    reload,
    goWeek,
    goToday,
    pickDate,
  };
}
