import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

let nextId = 0;

const ToastContext = createContext(null);

/**
 * Toasts auto-dismiss after `duration` ms (default 4000). Pass `duration: 0`
 * for a sticky toast that only closes via the X button.
 *
 *   const toast = useToast();
 *   toast.success('Transaction saved');
 *   toast.error('Failed to delete', { duration: 0 });
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, variant, { duration = 4000 } = {}) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, message, variant }]);
      if (duration > 0) {
        // Idempotent: early manual dismiss is a no-op when this fires later.
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo(
    () => ({
      success: (msg, opts) => show(msg, 'success', opts),
      error: (msg, opts) => show(msg, 'error', opts),
      info: (msg, opts) => show(msg, 'info', opts),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-4 sm:bottom-6 sm:right-6 sm:inset-x-auto z-[60] flex flex-col gap-2 pointer-events-none px-4 sm:px-0 sm:max-w-sm"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}

const VARIANT_STYLES = {
  success: {
    container: 'bg-white border-l-4 border-l-emerald-500 ring-1 ring-emerald-100',
    icon: 'text-emerald-500',
    iconPath: 'M5 13l4 4L19 7',
  },
  error: {
    container: 'bg-white border-l-4 border-l-rose-500 ring-1 ring-rose-100',
    icon: 'text-rose-500',
    iconPath: 'M6 18L18 6M6 6l12 12',
  },
  info: {
    container: 'bg-white border-l-4 border-l-brand ring-1 ring-gray-200',
    icon: 'text-brand',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

function Toast({ toast, onDismiss }) {
  const style = VARIANT_STYLES[toast.variant] ?? VARIANT_STYLES.info;
  return (
    <div
      className={`pointer-events-auto rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 ${style.container} animate-[toastIn_0.2s_ease-out]`}
      role="status"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`h-5 w-5 flex-shrink-0 mt-0.5 ${style.icon}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={style.iconPath} />
      </svg>
      <p className="flex-1 text-sm text-gray-700 break-words leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 -mr-1 p-0.5"
        aria-label="Dismiss notification"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
