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
    <div className="employee-card group">
      <div className="p-5 pb-3">
        <div className="flex items-start gap-4">
          {employee.profilePhotoUrl ? (
            <img src={employee.profilePhotoUrl} alt={fullName} className="h-16 w-16 rounded-full object-cover ring-2 ring-background shadow-sm" />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg ring-2 ring-background shadow-sm">{initials}</div>
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

      <div className="border-t px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onView(employee.id)}>
            <Eye className="h-3.5 w-3.5" />{locale === "ar" ? "عرض" : "View"}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onEdit(employee.id)}>
            <Pencil className="h-3.5 w-3.5" />{locale === "ar" ? "تعديل" : "Edit"}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onDocuments(employee.id)}>
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
