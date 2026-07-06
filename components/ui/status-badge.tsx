"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import type { EmployeeStatus } from "@/lib/design-system/tokens";
import { employeeStatusConfig } from "@/lib/design-system/tokens";

interface StatusBadgeProps {
  status: EmployeeStatus;
  locale?: "en" | "ar";
  size?: "sm" | "md" | "lg";
  dotOnly?: boolean;
  className?: string;
}

const sizeMap = { sm: "text-[11px] px-2 py-0.5 gap-1.5", md: "text-xs px-2.5 py-1 gap-1.5", lg: "text-sm px-3 py-1.5 gap-2" };
const dotSizeMap = { sm: "h-1.5 w-1.5", md: "h-2 w-2", lg: "h-2.5 w-2.5" };

const colorMap: Record<EmployeeStatus, { bg: string; text: string; dot: string; border: string }> = {
  ACTIVE: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-400", dot: "bg-emerald-500", border: "border-emerald-200 dark:border-emerald-800" },
  ON_LEAVE: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500", border: "border-orange-200 dark:border-orange-800" },
  INACTIVE: { bg: "bg-gray-50 dark:bg-gray-800/40", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-400", border: "border-gray-200 dark:border-gray-700" },
  TERMINATED: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400", dot: "bg-red-500", border: "border-red-200 dark:border-red-800" },
};

export const StatusBadge = memo(function StatusBadge({ status, locale = "ar", size = "md", dotOnly = false, className }: StatusBadgeProps) {
  const config = employeeStatusConfig[status];
  const colors = colorMap[status];
  const label = config.label[locale];

  if (dotOnly) {
    return <span className={cn("inline-block rounded-full shrink-0", dotSizeMap[size], colors.dot, className)} title={label} aria-label={label} />;
  }

  return (
    <span className={cn("inline-flex items-center rounded-full border font-medium whitespace-nowrap", sizeMap[size], colors.bg, colors.text, colors.border, className)}>
      <span className={cn("inline-block rounded-full shrink-0", dotSizeMap[size], colors.dot)} />
      {label}
    </span>
  );
});
