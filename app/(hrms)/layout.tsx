import type { ReactNode } from "react";
import { AppShell } from "@/components/hrms/app-shell";

export default function HrmsLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
