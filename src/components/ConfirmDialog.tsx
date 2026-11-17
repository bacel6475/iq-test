import { useEffect, useRef, type ReactNode } from 'react';

interface ConfirmDialogProps {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** 확인 버튼을 위험한 동작(빨강)으로 표시 */
  danger?: boolean;
}

/** 화면 가운데 뜨는 확인 창. Esc 키나 바깥을 누르면 취소. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-neutral-900 shadow-xl dark:bg-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-lg font-bold">
          {title}
        </h2>
        {children && <div className="mt-2 text-base leading-relaxed text-neutral-600 dark:text-neutral-300">{children}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-12 rounded-xl border border-neutral-300 font-semibold dark:border-neutral-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-12 rounded-xl font-semibold text-white ${danger ? 'bg-red-600' : 'bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
