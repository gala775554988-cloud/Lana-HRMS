"use client";

import { SystemErrorState } from "@/components/hrms/system-error-state";

export default function EmployeeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SystemErrorState error={error} reset={reset} />;
}
