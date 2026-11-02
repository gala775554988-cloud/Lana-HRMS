import { Suspense } from "react";
import { AttendanceConsole } from "@/components/hrms/attendance-console";

export function BiometricLogsBody() {
  return <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl border bg-card"/>}><AttendanceConsole mode="biometrics"/></Suspense>;
}
