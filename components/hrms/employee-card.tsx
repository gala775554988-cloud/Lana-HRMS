"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, FileText, MoreHorizontal, Building2, Briefcase, Calendar, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { EmployeeStatus } from "@/lib/design-system/tokens";

export interface EmployeeCardData {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  profilePhotoUrl?: string | null;
  phone?: string | null;
  status: EmployeeStatus;
  hireDate: string;
  department?: { name: string; code?: string } | null;
  position?: { title: string } | null;
  branch?: { name: string } | null;
  employmentType?: { name: string } | null;
  lastLoginAt?: string | null;
}

interface EmployeeCardProps {
  employee: EmployeeCardData;
  locale?: "en" | "ar";
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDocuments: (id: string) => void;
  onMore?: (id: string) => void;
}

const InfoRow = memo(function InfoRow({ icon: Icon, value }: { icon: LucideIcon; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{value}</span>
    </div>
  );
});

export const EmployeeCard = memo(function EmployeeCard({ employee, locale = "ar", onView, onEdit, onDocuments, onMore }: EmployeeCardProps) {
  const fullName = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="employee-card group border-slate-200/80 bg-white/95 shadow-sm shadow-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/70 dark:border-slate-800 dark:bg-slate-900/85 dark:shadow-slate-950/30 dark:hover:border-indigo-500/40 dark:hover:shadow-indigo-950/30">
      <div className="p-5 pb-3">
        <div className="flex items-start gap-4">
          {employee.profilePhotoUrl ? (
            <img src={employee.profilePhotoUrl} alt={fullName} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white shadow-md shadow-slate-200/80 transition-transform duration-200 group-hover:scale-[1.03] dark:ring-slate-900 dark:shadow-slate-950/40" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-primary font-semibold text-lg ring-2 ring-white shadow-md shadow-slate-200/80 transition-transform duration-200 group-hover:scale-[1.03] dark:from-indigo-950/50 dark:to-violet-950/40 dark:ring-slate-900 dark:shadow-slate-950/40">{initials}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate text-base">{fullName}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{employee.employeeNumber}</p>
              </div>
              <StatusBadge status={employee.status} locale={locale} size="sm" />
            </div>
            {employee.position && <p className="text-sm text-muted-foreground mt-1 truncate">{employee.position.title}</p>}
          </div>
        </div>
      </div>

      <div className="px-5 pb-3 space-y-1.5">
        <InfoRow icon={Building2} value={employee.department?.name} />
        <InfoRow icon={Briefcase} value={employee.branch?.name} />
        <InfoRow icon={FileText} value={employee.employmentType?.name} />
        <InfoRow icon={Calendar} value={employee.hireDate} />
        <InfoRow icon={Clock} value={employee.lastLoginAt || (locale === "ar" ? "لم يسجل" : "Never")} />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 flex items-center justify-between dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300" onClick={() => onView(employee.id)}>
            <Eye className="h-3.5 w-3.5" />{locale === "ar" ? "عرض" : "View"}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300" onClick={() => onEdit(employee.id)}>
            <Pencil className="h-3.5 w-3.5" />{locale === "ar" ? "تعديل" : "Edit"}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-300 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300" onClick={() => onDocuments(employee.id)}>
            <FileText className="h-3.5 w-3.5" />{locale === "ar" ? "مستندات" : "Docs"}
          </Button>
        </div>
        {onMore && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onMore(employee.id)}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
});
