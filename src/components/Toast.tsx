export interface ToastItem {
  id: number;
  message: string;
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-72 flex-col gap-2"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className="pointer-events-auto rounded-lg border border-blue-100 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-lg"
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
