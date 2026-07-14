"use client";

import { useCallback, useEffect, useState, memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { X, User, Briefcase, DollarSign, Clock, FileText, BarChart3, Package, Activity } from "lucide-react";
import type { EmployeeCardData } from "@/components/hrms/employee-card";

const tabs = [
  { id: "overview" as const, label: { en: "Overview", ar: "نظرة عامة" }, icon: User },
  { id: "personal" as const, label: { en: "Personal", ar: "شخصي" }, icon: User },
  { id: "job" as const, label: { en: "Job", ar: "وظيفي" }, icon: Briefcase },
  { id: "salary" as const, label: { en: "Salary", ar: "الراتب" }, icon: DollarSign },
  { id: "attendance" as const, label: { en: "Attendance", ar: "الحضور" }, icon: Clock },
  { id: "leave" as const, label: { en: "Leave", ar: "الإجازات" }, icon: Clock },
  { id: "documents" as const, label: { en: "Documents", ar: "المستندات" }, icon: FileText },
  { id: "performance" as const, label: { en: "Performance", ar: "الأداء" }, icon: BarChart3 },
  { id: "assets" as const, label: { en: "Assets", ar: "الأصول" }, icon: Package },
  { id: "activity" as const, label: { en: "Activity Log", ar: "سجل النشاط" }, icon: Activity },
];

type TabId = typeof tabs[number]["id"];

const InfoBlock = memo(function InfoBlock({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {children || <p className="text-sm font-medium text-foreground">{value || "-"}</p>}
    </div>
  );
});

const OverviewTab = memo(function OverviewTab({ employee, locale }: { employee: EmployeeCardData; locale: "en" | "ar" }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <InfoBlock label={locale === "ar" ? "الرقم الوظيفي" : "Employee ID"} value={employee.employeeNumber} />
        <InfoBlock label={locale === "ar" ? "الحالة" : "Status"}><StatusBadge status={employee.status} locale={locale} size="sm" /></InfoBlock>
        <InfoBlock label={locale === "ar" ? "القسم" : "Department"} value={employee.department?.name || "-"} />
        <InfoBlock label={locale === "ar" ? "المنصب" : "Position"} value={employee.position?.title || "-"} />
        <InfoBlock label={locale === "ar" ? "الفرع" : "Branch"} value={employee.branch?.name || "-"} />
        <InfoBlock label={locale === "ar" ? "تاريخ التعيين" : "Hire Date"} value={employee.hireDate} />
      </div>
    </div>
  );
});

const PersonalTab = memo(function PersonalTab({ employee, locale }: { employee: EmployeeCardData; locale: "en" | "ar" }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <InfoBlock label={locale === "ar" ? "الاسم الأول" : "First Name"} value={employee.firstName} />
        <InfoBlock label={locale === "ar" ? "اسم العائلة" : "Last Name"} value={employee.lastName} />
        <InfoBlock label={locale === "ar" ? "البريد الإلكتروني" : "Email"} value={employee.email || "-"} />
        <InfoBlock label={locale === "ar" ? "الهاتف" : "Phone"} value={employee.phone || "-"} />
      </div>
    </div>
  );
});

const JobTab = memo(function JobTab({ employee, locale }: { employee: EmployeeCardData; locale: "en" | "ar" }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <InfoBlock label={locale === "ar" ? "القسم" : "Department"} value={employee.department?.name || "-"} />
        <InfoBlock label={locale === "ar" ? "المنصب" : "Position"} value={employee.position?.title || "-"} />
        <InfoBlock label={locale === "ar" ? "الفرع" : "Branch"} value={employee.branch?.name || "-"} />
        <InfoBlock label={locale === "ar" ? "نوع التوظيف" : "Employment Type"} value={employee.employmentType?.name || "-"} />
        <InfoBlock label={locale === "ar" ? "تاريخ التعيين" : "Hire Date"} value={employee.hireDate} />
        <InfoBlock label={locale === "ar" ? "الحالة" : "Status"}><StatusBadge status={employee.status} locale={locale} size="sm" /></InfoBlock>
      </div>
    </div>
  );
});

const RelatedDataTab = memo(function RelatedDataTab({ tabId, employee, locale }: { tabId: string; employee: EmployeeCardData; locale: "en" | "ar" }) {
  const config: Record<string, { en: string; ar: string; href: string; description: { en: string; ar: string } }> = {
    salary: { en: "Salary Information", ar: "معلومات الراتب", href: `/payroll?tab=payroll-items&payroll-items__employeeId=${employee.id}`, description: { en: "Open payroll items filtered for this employee.", ar: "فتح بنود الرواتب المصفّاة لهذا الموظف." } },
    attendance: { en: "Attendance Records", ar: "سجلات الحضور", href: `/attendance?employeeId=${employee.id}`, description: { en: "Open attendance records filtered for this employee.", ar: "فتح سجلات الحضور المصفّاة لهذا الموظف." } },
    leave: { en: "Leave History", ar: "سجل الإجازات", href: `/leave?tab=leave-requests&leave-requests__employeeId=${employee.id}`, description: { en: "Open leave requests filtered for this employee.", ar: "فتح طلبات الإجازة المصفّاة لهذا الموظف." } },
    documents: { en: "Employee Documents", ar: "مستندات الموظف", href: `/contracts?tab=documents&documents__employeeId=${employee.id}`, description: { en: "Open documents filtered for this employee.", ar: "فتح مستندات الموظف." } },
    performance: { en: "Performance Reviews", ar: "تقييمات الأداء", href: `/performance?employeeId=${employee.id}`, description: { en: "Open performance reviews filtered for this employee.", ar: "فتح تقييمات الأداء المصفّاة لهذا الموظف." } },
    assets: { en: "Assigned Assets", ar: "الأصول المخصصة", href: `/assets?assignedEmployeeId=${employee.id}`, description: { en: "Open assigned assets for this employee.", ar: "فتح الأصول المسندة لهذا الموظف." } },
    activity: { en: "Activity Timeline", ar: "سجل النشاط", href: `/audit-logs?entityId=${employee.id}`, description: { en: "Open audit records related to this employee.", ar: "فتح سجلات التدقيق المرتبطة بهذا الموظف." } },
  };
  const item = config[tabId] || config.activity;
  return (
    <div className="space-y-4 animate-fade-in">
      <InfoBlock label={item[locale]} value={item.description[locale]} />
      <Button asChild variant="outline"><a href={item.href}>{locale === "ar" ? "فتح السجلات" : "Open records"}</a></Button>
    </div>
  );
});

interface EmployeeDrawerProps {
  employee: EmployeeCardData | null;
  open: boolean;
  onClose: () => void;
  locale?: "en" | "ar";
  onEdit?: (id: string) => void;
}

export function EmployeeDrawer({ employee, open, onClose, locale = "ar", onEdit }: EmployeeDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  useEffect(() => {
    if (employee) setActiveTab("overview");
  }, [employee]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Only manage body overflow if drawer is open (don't conflict with Dialog)
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const renderTabContent = useCallback(() => {
    if (!employee) return null;
    switch (activeTab) {
      case "overview": return <OverviewTab employee={employee} locale={locale} />;
      case "personal": return <PersonalTab employee={employee} locale={locale} />;
      case "job": return <JobTab employee={employee} locale={locale} />;
      default: return <RelatedDataTab tabId={activeTab} employee={employee} locale={locale} />;
    }
  }, [activeTab, employee, locale]);

  if (!open || !employee) return null;

  return (
    <>
      <div className="drawer-overlay animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={`${employee.firstName} ${employee.lastName}`}
        className={cn("fixed top-0 right-0 z-50 h-full w-full max-w-lg", "bg-background border-l shadow-drawer", "animate-slide-in-right", "flex flex-col")}
        style={{ direction: locale === "ar" ? "rtl" : "ltr" }}>
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            {employee.profilePhotoUrl ? (
              <img src={employee.profilePhotoUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-foreground truncate">{employee.firstName} {employee.lastName}</h2>
              <p className="text-xs text-muted-foreground">{employee.employeeNumber}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></Button>
        </div>
        <div className="border-b overflow-x-auto">
          <nav className="flex px-4 min-w-max" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} role="tab" aria-selected={isActive} onClick={() => setActiveTab(tab.id)}
                  className={cn("flex items-center gap-2 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                    isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30")}>
                  <Icon className="h-4 w-4" />{tab.label[locale]}
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{renderTabContent()}</div>
        {onEdit && (
          <div className="border-t px-6 py-4 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose}>{locale === "ar" ? "إغلاق" : "Close"}</Button>
            <Button onClick={() => onEdit(employee.id)}>{locale === "ar" ? "تعديل الموظف" : "Edit Employee"}</Button>
          </div>
        )}
      </div>
    </>
  );
}
