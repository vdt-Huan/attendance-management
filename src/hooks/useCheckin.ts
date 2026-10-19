// Hook chấm công (Ngày 5.1): quản lý trạng thái hôm nay, loading,
// chống nhấn trùng, refresh sau khi thành công.

import { useCallback, useEffect, useState } from "react";
import { fetchTodayAttendance, doClockIn, doClockOut, type TodayAttendance } from "../services/checkin";

export type CheckinActionState = "idle" | "clocking_in" | "clocking_out";

export function useCheckin(employeeId: string | null) {
  const [state, setState] = useState<"loading" | "ready" | "error">(employeeId ? "loading" : "ready");
  const [attendance, setAttendance] = useState<TodayAttendance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<CheckinActionState>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!employeeId) {
      setState("ready");
      setAttendance(null);
      return;
    }
    setState("loading");
    setError(null);
    try {
      const data = await fetchTodayAttendance(employeeId);
      setAttendance(data);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa tải được trạng thái chấm công.");
      setState("error");
    }
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const clockIn = useCallback(async (note?: string) => {
    if (!employeeId || actionState !== "idle") return;
    setActionState("clocking_in");
    setActionError(null);
    try {
      const record = await doClockIn(employeeId, note ?? "");
      setAttendance((prev) => prev ? { ...prev, hasRecord: true, status: "checked_in", record } : null);
      setActionState("idle");
      // Reload để lấy trạng thái mới nhất từ DB (vn_today có thể khác nếu qua nửa đêm)
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Check-in chưa thành công.");
      setActionState("idle");
    }
  }, [employeeId, actionState, load]);

  const clockOut = useCallback(async (note?: string) => {
    if (!employeeId || actionState !== "idle") return;
    setActionState("clocking_out");
    setActionError(null);
    try {
      const record = await doClockOut(employeeId, note ?? "");
      setAttendance((prev) => prev ? { ...prev, status: "checked_out", record } : null);
      setActionState("idle");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Check-out chưa thành công.");
      setActionState("idle");
    }
  }, [employeeId, actionState, load]);

  const canClockIn = attendance?.status === "none";
  const canClockOut = attendance?.status === "checked_in";

  return {
    state,
    attendance,
    error,
    reload,
    actionState,
    actionError,
    clockIn,
    clockOut,
    canClockIn,
    canClockOut,
  };
}