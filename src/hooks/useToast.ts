import { useCallback, useRef, useState } from "react";
import type { ToastItem } from "../components/Toast";

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message: string) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list.slice(-2), { id, message }]);
      setTimeout(() => dismiss(id), 3200);
    },
    [dismiss],
  );

  return { toasts, notify, dismiss };
}
