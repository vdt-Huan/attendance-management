// Hook lịch sử chấm công (Ngày 5.2): lọc, phân trang, sắp xếp server-side.
// Employee bị khóa chỉ xem lịch của mình; HR/Admin thấy bộ lọc đầy đủ.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { listAttendanceRecords, getAttendanceSummary, getVnToday, PAGE_SIZE, type AttendanceListParams, type AttendanceListResult, type AttendanceSummary } from "../services/attendanceHistory";
import { listDepartments } from "../services/employees";
import type { Department } from "../types/employees";
import { isHrOrAdmin } from "../types/rbac";

const DEBOUNCE_MS = 300;

export type HistoryDataState = "loading" | "ready" | "error";

export function useAttendanceHistory() {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);

  const [fromDate, setFromDate] = useState<string>(""); // YYYY-MM-DD
  const [toDate, setToDate] = useState<string>("");
  const [status, setStatus] = useState<"all" | "dung-gio" | "di-muon" | "ve-som" | "vang">("all");
  const [employeeId, setEmployeeId] = useState<string>(""); // HR/Admin dùng
  const [departmentId, setDepartmentId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"work_date" | "check_in" | "status">("work_date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const [state, setState] = useState<HistoryDataState>("loading");
  const [items, setItems] = useState<AttendanceListResult["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounce search
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [search]);

  // Reset page khi filter thay đổi
  useEffect(() => setPage(0), [debouncedSearch, status, fromDate, toDate, employeeId, departmentId, sortField, sortDirection]);

  // Load departments cho HR/Admin
  const [departments, setDepartments] = useState<Department[]>([]);
  useEffect(() => {
    if (canManage) {
      listDepartments().then(setDepartments).catch(() => setDepartments([]));
    }
  }, [canManage]);

  const params: AttendanceListParams = {
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    status,
    employeeId: canManage ? (employeeId || undefined) : undefined,
    departmentId: canManage ? (departmentId === "all" ? undefined : departmentId) : undefined,
    search: canManage ? debouncedSearch : "",
    page,
    pageSize: PAGE_SIZE,
    sortField,
    sortDirection,
  };

  // Load data
  useEffect(() => {
    let alive = true;
    setState("loading");
    setError(null);
    listAttendanceRecords(params)
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Chưa tải được dữ liệu.");
        setState("error");
      });
    return () => { alive = false; };
  }, [params, reloadKey]);

  // Summary
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  useEffect(() => {
    if (!canManage) { setSummary(null); return; }
    let alive = true;
    getAttendanceSummary({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      employeeId: employeeId || undefined,
      departmentId: departmentId === "all" ? undefined : departmentId,
    })
      .then((s) => { if (alive) setSummary(s); })
      .catch((err) => { if (alive) setSummaryError(err instanceof Error ? err.message : "Chưa tính được tổng hợp."); });
    return () => { alive = false; };
  }, [fromDate, toDate, employeeId, departmentId, reloadKey, canManage]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Quick set: hôm nay / tuần này / tháng này
  const setQuickRange = useCallback(async (preset: "today" | "week" | "month") => {
    const today = await getVnToday();
    const d = new Date(`${today}T00:00:00`);
    if (preset === "today") {
      setFromDate(today);
      setToDate(today);
    } else if (preset === "week") {
      const dow = (d.getDay() + 6) % 7; // Thứ 2 = 0
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setFromDate(monday.toISOString().split("T")[0]);
      setToDate(sunday.toISOString().split("T")[0]);
    } else if (preset === "month") {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setFromDate(first.toISOString().split("T")[0]);
      setToDate(last.toISOString().split("T")[0]);
    }
  }, []);

  // Employee: chỉ xem của mình (RLS siết thêm), nhưng UI ẩn bộ lọc
  return {
    canManage,
    profile,
    // filter
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    setQuickRange,
    status,
    setStatus,
    employeeId,
    setEmployeeId,
    departmentId,
    setDepartmentId,
    departments,
    search,
    setSearch,
    // sort
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    // pagination
    page,
    setPage,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
    // data
    state,
    items,
    error,
    reload,
    // summary
    summary,
    summaryError,
  };
}