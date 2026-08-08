"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ToastVariant = "success" | "info" | "error";
export type ToastPayload = { title: string; message: string; variant?: ToastVariant };
type ToastItem = ToastPayload & { id: number };

type Listener = (payload: ToastPayload) => void;
const listeners = new Set<Listener>();

// Permite disparar un toast desde fuera del árbol de React (helpers como
// permissionAlert) sin pasar por props/contexto en cada llamador.
export function pushToast(payload: ToastPayload) {
  listeners.forEach((listener) => listener(payload));
}

const ToastContext = createContext<{ showToast: (payload: ToastPayload) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback((payload: ToastPayload) => {
    const id = ++nextId.current;
    setItems((prev) => [...prev, { ...payload, id }]);
    window.setTimeout(() => dismiss(id), 4200);
  }, [dismiss]);

  useEffect(() => {
    listeners.add(showToast);
    return () => {
      listeners.delete(showToast);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {items.map((item) => (
          <div key={item.id} className={`toast-card ${item.variant || "info"}`} role="status" aria-live="polite">
            <strong>{item.title}</strong>
            <span>{item.message}</span>
            <button
              type="button"
              className="toast-card-close"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(item.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return ctx ? ctx.showToast : pushToast;
}
