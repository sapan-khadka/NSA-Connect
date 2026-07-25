import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  Toast,
  ToastViewport,
  type ToastTone,
} from "../design-system/components/feedback/Toast";

export type AppToast = {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  href?: string;
  durationMs?: number;
};

type ToastContextValue = {
  pushToast: (toast: Omit<AppToast, "id"> & { id?: string }) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5_500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<AppToast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<AppToast, "id"> & { id?: string }) => {
      const id = toast.id ?? `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next: AppToast = {
        id,
        title: toast.title,
        description: toast.description,
        tone: toast.tone ?? "info",
        href: toast.href,
        durationMs: toast.durationMs ?? DEFAULT_DURATION_MS,
      };
      setToasts((current) =>
        [next, ...current.filter((toast) => toast.id !== id)].slice(0, 4),
      );
      window.setTimeout(() => {
        dismissToast(id);
      }, next.durationMs);
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({ pushToast, dismissToast }),
    [pushToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport position="top-right">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            title={toast.title}
            description={toast.description}
            tone={toast.tone}
            onClose={() => dismissToast(toast.id)}
            action={
              toast.href ? (
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => {
                    dismissToast(toast.id);
                    void navigate(toast.href!);
                  }}
                >
                  Open
                </button>
              ) : null
            }
          />
        ))}
      </ToastViewport>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value == null) {
    return {
      pushToast: () => undefined,
      dismissToast: () => undefined,
    };
  }
  return value;
}
