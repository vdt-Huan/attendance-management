// Hook danh sách phòng ban (Ngày 3.2): tìm kiếm debounce + sắp xếp có
// kiểm soát (name/created_at) + phân trang server-side.

import { useCallback, useEffect, useRef, useState } from "react";
import { listDepartmentsPaged } from "../services/departments";
import type {
  DepartmentListParams,
  DepartmentSortDirection,
  DepartmentSortField,
  DepartmentWithCount,
} from "../services/departments";
import { DEPARTMENT_PAGE_SIZE } from "../services/departments";

export type DepartmentDataState = "loading" | "ready" | "error";

const DEBOUNCE_MS = 300;

export function useDepartmentsList() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortField, setSortField] = useState<DepartmentSortField>("name");
  const [sortDirection, setSortDirection] = useState<DepartmentSortDirection>("asc");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(DEPARTMENT_PAGE_SIZE);

  const [state, setState] = useState<DepartmentDataState>("loading");
  const [items, setItems] = useState<DepartmentWithCount[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [query]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQuery, sortField, sortDirection]);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setError(null);
    const params: DepartmentListParams = {
      search: debouncedQuery,
      page,
      pageSize,
      sortField,
      sortDirection,
    };
    listDepartmentsPaged(params)
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
  }, [debouncedQuery, page, pageSize, sortField, sortDirection, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    query,
    setQuery,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    page,
    setPage,
    pageSize,
    total,
    totalPages,
    state,
    items,
    error,
    reload,
  };
}
