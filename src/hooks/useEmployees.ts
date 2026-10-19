// Hooks danh sách + chi tiết nhân viên (Ngày 3.1).
// Truy vấn Supabase có debounce tìm kiếm, phân trang server-side, sắp xếp
// theo các trường hợp lệ. Không tải toàn bộ dữ liệu vô hạn.

import { useCallback, useEffect, useRef, useState } from "react";
import { listDepartments, listEmployees } from "../services/employees";
import type {
  Department,
  EmployeeListParams,
  EmployeeSortField,
  EmployeeStatusFilter,
  EmployeeWithRefs,
  SortDirection,
} from "../types/employees";
import { EMPLOYEE_PAGE_SIZE } from "../types/employees";

export type EmployeeDataState = "loading" | "ready" | "error";

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setDepartments(await listDepartments());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa tải được phòng ban.");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { departments, error, reload };
}

const DEBOUNCE_MS = 300;

export function useEmployeesList() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [status, setStatus] = useState<EmployeeStatusFilter>("all");
  const [sortField, setSortField] = useState<EmployeeSortField>("full_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(EMPLOYEE_PAGE_SIZE);

  const [state, setState] = useState<EmployeeDataState>("loading");
  const [items, setItems] = useState<EmployeeWithRefs[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timer = useRef<number | null>(null);

  // Debounce ô tìm kiếm để không bắn query mỗi ký tự.
  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  // Đổi bộ lọc/sắp xếp → quay về trang đầu.
  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, departmentId, status, sortField, sortDirection]);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setError(null);
    const params: EmployeeListParams = {
      search: debouncedQuery,
      departmentId,
      status,
      page,
      pageSize,
      sortField,
      sortDirection,
    };
    listEmployees(params)
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
    return () => {
      alive = false;
    };
  }, [debouncedQuery, departmentId, status, page, pageSize, sortField, sortDirection, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    // bộ lọc
    query,
    setQuery,
    departmentId,
    setDepartmentId,
    status,
    setStatus,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    // phân trang
    page,
    setPage,
    pageSize,
    total,
    totalPages,
    // dữ liệu
    state,
    items,
    error,
    reload,
  };
}
