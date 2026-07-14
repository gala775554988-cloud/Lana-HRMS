"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export type ToastState = { success: boolean; message: string } | null;

export function ToastMessage({ state }: { state: ToastState }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!state) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  if (!state || !visible) return null;

  return (
    <div
      role="status"
      className={`fixed inset-x-0 bottom-6 z-[100] mx-auto flex w-fit max-w-[90vw] items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg transition-opacity ${
        state.success
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      }`}
    >
      {state.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
      {state.message}
    </div>
  );
}
