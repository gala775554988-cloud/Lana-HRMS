"use client";

import { SystemErrorState } from "@/components/hrms/system-error-state";

export default function HrmsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SystemErrorState error={error} reset={reset} />;
}
