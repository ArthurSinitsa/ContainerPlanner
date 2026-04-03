import { AnimatePresence, motion } from "framer-motion";
import { createContext, PropsWithChildren, useContext, useMemo, useState } from "react";

export type ToastType = "success" | "error";

export interface ToastPayload {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  pushToast: (payload: Omit<ToastPayload, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);

  const value = useMemo<ToastContextValue>(
    () => ({
      pushToast: (payload) => {
        const toast: ToastPayload = {
          id: makeId(),
          durationMs: 4000,
          ...payload
        };
        setToasts((prev) => [toast, ...prev].slice(0, 5));
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, toast.durationMs ?? 4000);
      }
    }),
    []
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastViewport" aria-live="polite" aria-relevant="additions removals" />
      <div className="toastStack">
        <AnimatePresence initial={false}>
          {toasts.map((t, index) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.18, delay: index * 0.02 }}
              className={`toast ${t.type}`}
            >
              {t.title ? <div className="toastTitle">{t.title}</div> : null}
              <div className="toastMessage">{t.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

