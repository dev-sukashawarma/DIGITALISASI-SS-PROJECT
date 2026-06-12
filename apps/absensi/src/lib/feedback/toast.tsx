"use client";

import React, { createContext, useContext, useCallback, useState } from "react";
import { CircleCheck, CircleX, Info } from "lucide-react";
import { beep } from "./sound";

type ToastKind = "ok" | "err" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<{ show: (kind: ToastKind, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    if (kind !== "info") beep(kind);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((t) => {
          const Icon = t.kind === "ok" ? CircleCheck : t.kind === "err" ? CircleX : Info;
          const color = t.kind === "ok" ? "text-suka-green" : t.kind === "err" ? "text-red-600" : "text-suka-brown";
          return (
            <div key={t.id} className="flex items-center gap-2 bg-white border border-suka-gray-200 rounded-lg shadow-lg px-4 py-2.5">
              <Icon className={color} size={18} />
              <span className="text-sm text-suka-ink">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast harus di dalam ToastProvider");
  return ctx;
}
