// Hook đơn nghỉ phép (Ngày 6.1): lọc, phân trang, server-side.
// Employee bị khóa chỉ xem/tạo đơn của mình; HR/Admin thấy bộ lọc đầy đủ.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { listLeaveRequests, getMyEmployeeId, type LeaveListParams, type LeaveListResult, type LeaveType } from "../services/leave";
import { listDepartments } from "../services/employees";
import type { Department } from "../types/employees";
import { isHrOrAdmin } from "../types/rbac";

const DEBOUNCE_MS = 300;
const LEAVE_PAGE_SIZE = 20;

export type LeaveDataState = "loading" | "ready" | "error";

export function useLeaveRequests() {
  const { profile } = useAuth();
  const canManage = isHrOrAdmin(profile?.role);

  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [leaveType, setLeaveType] = useState<"all" | LeaveType>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<"created_at" | "start_date" | "status">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const [state, setState] = useState<LeaveDataState>("loading");
  const [items, setItems] = useState<LeaveListResult["items"]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState<string | null>(null);

  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebouncedSearch(search), DEBOUNCE_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [search]);

  useEffect(() => { setPage(0); }, [debouncedSearch, status, leaveType, fromDate, toDate, employeeId, departmentId, sortField, sortDirection]);

  useEffect(() => {
    if (canManage) listDepartments().then(setDepartments).catch(() => setDepartments([]));
    getMyEmployeeId().then(setMyEmployeeId).catch(() => setMyEmployeeId(null));
  }, [canManage]);

  const params: LeaveListParams = {
    status,
    leaveType,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    employeeId: canManage ? (employeeId || undefined) : (myEmployeeId ?? undefined),
    departmentId: canManage ? (departmentId === "all" ? undefined : departmentId) : undefined,
    search: canManage ? debouncedSearch : "",
    page,
    pageSize: LEAVE_PAGE_SIZE,
    sortField,
    sortDirection,
  };

  useEffect(() => {
    let alive = true;
    setState("loading");
    setError(null);
    listLeaveRequests(params)
      .then((res) => { if (alive) { setItems(res.items); setTotal(res.total); setState("ready"); } })
      .catch((err) => { if (alive) { setError(err instanceof Error ? err.message : "Chưa tải được."); setState("error"); } });
    return () => { alive = false; };
  }, [params, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const totalPages = Math.max(1, Math.ceil(total / LEAVE_PAGE_SIZE));

  return {
    canManage,
    myEmployeeId,
    // filter
    status, setStatus,
    leaveType, setLeaveType,
    fromDate, setFromDate,
    toDate, setToDate,
    employeeId, setEmployeeId,
    departmentId, setDepartmentId,
    departments,
    search, setSearch,
    // sort
    sortField, setSortField,
    sortDirection, setSortDirection,
    // pagination
    page, setPage, pageSize: LEAVE_PAGE_SIZE, total, totalPages,
    // data
    state, items, error, reload,
  };
}