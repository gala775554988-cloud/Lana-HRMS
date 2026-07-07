"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutGrid, List, Plus, SlidersHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmployeeCard, type EmployeeCardData } from "@/components/hrms/employee-card";
import { EmployeeDrawer } from "@/components/hrms/employee-drawer";
import { ModuleTable } from "@/components/hrms/module-table";
import { ModuleForm } from "@/components/hrms/module-form";
import { EmployeeBulkImportDialog } from "@/components/hrms/employee-bulk-import-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Users, UserCheck, Clock, UserPlus, FileWarning } from "lucide-react";
import type { HrmsModule } from "@/config/hrms";
import type { Dictionary, Locale } from "@/lib/i18n";

type ViewMode = "card" | "table";

interface EmployeeListProps {
  resource: HrmsModule;
  records: EmployeeCardData[];
  totalCount: number;
  page: number;
  pageCount: number;
  search: string;
  filters?: Record<string, string | undefined>;
  pageSize: number;
  dictionary: Dictionary;
  locale: Locale;
}

export function EmployeeList({ resource, records, totalCount, page, pageCount, search: initialSearch, filters = {}, pageSize, dictionary, locale }: EmployeeListProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [search, setSearch] = useState(initialSearch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeCardData | null>(null);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const isAr = locale === "ar";

  const stats = useMemo(() => {
    const active = records.filter((r) => r.status === "ACTIVE").length;
    const onLeave = records.filter((r) => r.status === "ON_LEAVE").length;
    const newThisMonth = records.filter((r) => {
      const d = new Date(r.hireDate); const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total: records.length, active, onLeave, newThisMonth };
  }, [records]);

  const filterFields = useMemo(() => [
    ["department", isAr ? "الإدارة" : "Department"],
    ["branch", isAr ? "الفرع" : "Branch"],
    ["project", isAr ? "المشروع" : "Project"],
    ["section", isAr ? "القسم" : "Section"],
    ["position", isAr ? "المنصب" : "Position"],
    ["status", isAr ? "الحالة" : "Status"],
    ["nationality", isAr ? "الجنسية" : "Nationality"],
    ["employmentType", isAr ? "نوع التوظيف" : "Employment Type"],
    ["manager", isAr ? "المدير المباشر" : "Direct Manager"],
    ["hireDate", isAr ? "تاريخ التعيين" : "Hire Date"]
  ] as const, [isAr]);

  const buildQuery = useCallback((updates: Record<string, string | number | undefined> = {}) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    params.set("pageSize", String(pageSize));
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, String(value));
    });
    return params.toString();
  }, [filters, pageSize, search]);

  const handleView = useCallback((id: string) => { const emp = records.find((r) => r.id === id); if (emp) { setSelectedEmployee(emp); setDrawerOpen(true); } }, [records]);
  const handleEdit = useCallback((id: string) => { router.push(`/employees/${id}`); }, [router]);
  const handleDocuments = useCallback((id: string) => { router.push(`/documents?employeeId=${id}`); }, [router]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/employees?${buildQuery({ search, page: 1 })}`);
  }, [buildQuery, search, router]);

  const handleApplyFilters = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates: Record<string, string | number | undefined> = { page: 1 };
    filterFields.forEach(([name]) => {
      const value = String(formData.get(name) ?? "").trim();
      updates[name] = value || undefined;
    });
    router.push(`/employees?${buildQuery(updates)}`);
  }, [buildQuery, filterFields, router]);

  const handleResetFilters = useCallback(() => {
    setSearch("");
    router.push(`/employees?pageSize=${pageSize}`);
  }, [pageSize, router]);

  const handleCloseDrawer = useCallback(() => { setDrawerOpen(false); }, []);
  const handleCloseAddEmployee = useCallback((open: boolean) => { setAddEmployeeOpen(open); }, []);

  return (
    <section className="space-y-6" dir={isAr ? "rtl" : "ltr"}>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCard title={isAr ? "إجمالي الموظفين" : "Total Employees"} value={totalCount} icon={Users} description={isAr ? "جميع الموظفين" : "All employees"} />
        <StatCard title={isAr ? "نشط" : "Active"} value={stats.active} icon={UserCheck} description={isAr ? "حالياً في العمل" : "Currently working"} />
        <StatCard title={isAr ? "في إجازة" : "On Leave"} value={stats.onLeave} icon={Clock} description={isAr ? "في إجازة حالياً" : "Currently on leave"} />
        <StatCard title={isAr ? "موظفون جدد" : "New Employees"} value={stats.newThisMonth} icon={UserPlus} description={isAr ? "هذا الشهر" : "This month"} />
        <StatCard title={isAr ? "عقود منتهية" : "Expiring Contracts"} value={0} icon={FileWarning} description={isAr ? "خلال 30 يوم" : "Within 30 days"} />
      </div>

      <div className="rounded-xl border bg-card shadow-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <form onSubmit={handleSearch} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="text" placeholder={isAr ? "بحث بالاسم أو الرقم الوظيفي..." : "Search by name or ID..."} value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
            </div>
            <Button type="submit" size="sm"><Search className="h-4 w-4 ml-1.5" />{isAr ? "بحث" : "Search"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setFiltersOpen((value) => !value)}><SlidersHorizontal className="h-4 w-4 ml-1.5" />الفلاتر</Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <select value={pageSize} onChange={(event) => router.push(`/employees?${buildQuery({ pageSize: event.target.value, page: 1 })}`)} className="h-9 rounded-md border bg-background px-3 text-sm">
              {[30, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <div className="flex rounded-lg border overflow-hidden">
              <Button variant={viewMode === "card" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("card")} className="rounded-none gap-1.5"><LayoutGrid className="h-4 w-4" />{isAr ? "بطاقات" : "Cards"}</Button>
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none gap-1.5"><List className="h-4 w-4" />{isAr ? "جدول" : "Table"}</Button>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkImportOpen(true)}><Upload className="h-4 w-4" />{isAr ? "استيراد الموظفين" : "Bulk Import"}</Button>
            <Button size="sm" className="gap-1.5" onClick={() => setAddEmployeeOpen(true)}><Plus className="h-4 w-4" />{isAr ? "إضافة موظف" : "Add Employee"}</Button>
          </div>
        </div>
        {filtersOpen ? (
          <form onSubmit={handleApplyFilters} className="mt-4 rounded-xl border bg-background p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {filterFields.map(([name, label]) => (
                <label key={name} className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <Input name={name} type={name === "hireDate" ? "date" : "text"} defaultValue={filters[name] ?? ""} />
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="submit">تطبيق</Button>
              <Button type="button" variant="outline" onClick={handleResetFilters}>إعادة تعيين</Button>
            </div>
          </form>
        ) : null}
      </div>

      {viewMode === "card" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {records.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} locale={locale} onView={handleView} onEdit={handleEdit} onDocuments={handleDocuments} />
          ))}
          {records.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">{isAr ? "لا توجد نتائج" : "No results found"}</p>
              <p className="text-xs mt-1">{isAr ? "حاول تعديل البحث أو التصفية" : "Try adjusting your search or filters"}</p>
            </div>
          )}
        </div>
      )}

      {viewMode === "table" && (
        <ModuleTable resource={resource} records={records as unknown as (Record<string, unknown> & { id: string })[]} dictionary={dictionary} locale={locale} />
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{isAr ? `صفحة ${page} من ${pageCount} - ${totalCount} سجل` : `Page ${page} of ${pageCount} - ${totalCount} records`}</span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><a href={`?${buildQuery({ page: Math.max(page - 1, 1) })}`}>{isAr ? "السابق" : "Previous"}</a></Button>
          <Button asChild variant="outline" size="sm"><a href={`?${buildQuery({ page: Math.min(page + 1, pageCount) })}`}>{isAr ? "التالي" : "Next"}</a></Button>
        </div>
      </div>

      <Dialog open={addEmployeeOpen} onOpenChange={handleCloseAddEmployee}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isAr ? "إضافة موظف جديد" : "Add New Employee"}</DialogTitle>
            <DialogClose onClick={() => setAddEmployeeOpen(false)} />
          </DialogHeader>
          <ModuleForm resource={resource} dictionary={dictionary} locale={locale} />
        </DialogContent>
      </Dialog>

      <EmployeeBulkImportDialog open={bulkImportOpen} onOpenChange={setBulkImportOpen} locale={locale} />
      <EmployeeDrawer employee={selectedEmployee} open={drawerOpen} onClose={handleCloseDrawer} locale={locale} onEdit={handleEdit} />
    </section>
  );
}
