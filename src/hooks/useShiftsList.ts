// Hook danh sách ca làm việc (Ngày 4.1): tìm kiếm debounce + sắp xếp có
// kiểm soát (name/start_time/created_at) + phân trang server-side.

import { useCallback, useEffect, useRef, useState } from "react";
import { listShiftsPaged } from "../services/workShifts";
import type {
  ShiftListParams,
  ShiftSortDirection,
  ShiftSortField,
  WorkShiftWithCount,
} from "../services/workShifts";
import { SHIFT_PAGE_SIZE } from "../services/workShifts";

export type ShiftDataState = "loading" | "ready" | "error";

const DEBOUNCE_MS = 300;

export function useShiftsList() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sortField, setSortField] = useState<ShiftSortField>("name");
  const [sortDirection, setSortDirection] = useState<ShiftSortDirection>("asc");
  const [page, setPage] = useState(0);
  const [pageSize] = useState(SHIFT_PAGE_SIZE);

  const [state, setState] = useState<ShiftDataState>("loading");
  const [items, setItems] = useState<WorkShiftWithCount[]>([]);
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
    const params: ShiftListParams = {
      search: debouncedQuery,
      page,
      pageSize,
      sortField,
      sortDirection,
    };
    listShiftsPaged(params)
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
