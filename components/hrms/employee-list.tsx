"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutGrid, List, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmployeeCard, type EmployeeCardData } from "@/components/hrms/employee-card";
import { EmployeeDrawer } from "@/components/hrms/employee-drawer";
import { ModuleTable } from "@/components/hrms/module-table";
import { ModuleForm } from "@/components/hrms/module-form";
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
  dictionary: Dictionary;
  locale: Locale;
}

export function EmployeeList({ resource, records, totalCount, page, pageCount, search: initialSearch, dictionary, locale }: EmployeeListProps) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeCardData | null>(null);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  const stats = useMemo(() => {
    const active = records.filter((r) => r.status === "ACTIVE").length;
    const onLeave = records.filter((r) => r.status === "ON_LEAVE").length;
    const newThisMonth = records.filter((r) => {
      const d = new Date(r.hireDate); const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total: records.length, active, onLeave, newThisMonth };
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (departmentFilter) result = result.filter((r) => r.department?.name === departmentFilter);
    if (branchFilter) result = result.filter((r) => r.branch?.name === branchFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.firstName.toLowerCase().includes(q) || r.lastName.toLowerCase().includes(q) || r.employeeNumber.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q));
    }
    return result;
  }, [records, search, statusFilter, departmentFilter, branchFilter]);

  const departments = useMemo(() => [...new Set(records.map((r) => r.department?.name).filter(Boolean))] as string[], [records]);
  const branches = useMemo(() => [...new Set(records.map((r) => r.branch?.name).filter(Boolean))] as string[], [records]);

  const handleView = useCallback((id: string) => { const emp = records.find((r) => r.id === id); if (emp) { setSelectedEmployee(emp); setDrawerOpen(true); } }, [records]);
  const handleEdit = useCallback((id: string) => { router.push(`/employees/${id}`); }, [router]);
  const handleDocuments = useCallback((id: string) => { router.push(`/documents?employeeId=${id}`); }, [router]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    router.push(`/employees?${params.toString()}`);
  }, [search, statusFilter, router]);

  const handleCloseDrawer = useCallback(() => { setDrawerOpen(false); }, []);
  const handleCloseAddEmployee = useCallback((open: boolean) => { setAddEmployeeOpen(open); }, []);

  const isAr = locale === "ar";

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
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">{isAr ? "كل الحالات" : "All Status"}</option>
              <option value="ACTIVE">{isAr ? "نشط" : "Active"}</option>
              <option value="ON_LEAVE">{isAr ? "في إجازة" : "On Leave"}</option>
              <option value="INACTIVE">{isAr ? "غير نشط" : "Inactive"}</option>
              <option value="TERMINATED">{isAr ? "موقوف" : "Suspended"}</option>
            </select>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">{isAr ? "كل الأقسام" : "All Departments"}</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">{isAr ? "كل الفروع" : "All Branches"}</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <Button type="submit" size="sm"><SlidersHorizontal className="h-4 w-4 ml-1.5" />{isAr ? "تطبيق" : "Apply"}</Button>
          </form>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden">
              <Button variant={viewMode === "card" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("card")} className="rounded-none gap-1.5"><LayoutGrid className="h-4 w-4" />{isAr ? "بطاقات" : "Cards"}</Button>
              <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("table")} className="rounded-none gap-1.5"><List className="h-4 w-4" />{isAr ? "جدول" : "Table"}</Button>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setAddEmployeeOpen(true)}><Plus className="h-4 w-4" />{isAr ? "إضافة موظف" : "Add Employee"}</Button>
          </div>
        </div>
      </div>

      {viewMode === "card" && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRecords.map((employee) => (
            <EmployeeCard key={employee.id} employee={employee} locale={locale} onView={handleView} onEdit={handleEdit} onDocuments={handleDocuments} />
          ))}
          {filteredRecords.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">{isAr ? "لا توجد نتائج" : "No results found"}</p>
              <p className="text-xs mt-1">{isAr ? "حاول تعديل البحث أو التصفية" : "Try adjusting your search or filters"}</p>
            </div>
          )}
        </div>
      )}

      {viewMode === "table" && (
        <ModuleTable resource={resource} records={filteredRecords as unknown as (Record<string, unknown> & { id: string })[]} dictionary={dictionary} locale={locale} />
      )}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>{isAr ? `صفحة ${page} من ${pageCount} - ${totalCount} سجل` : `Page ${page} of ${pageCount} - ${totalCount} records`}</span>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm"><a href={`?page=${Math.max(page - 1, 1)}&search=${encodeURIComponent(search)}`}>{isAr ? "السابق" : "Previous"}</a></Button>
          <Button asChild variant="outline" size="sm"><a href={`?page=${Math.min(page + 1, pageCount)}&search=${encodeURIComponent(search)}`}>{isAr ? "التالي" : "Next"}</a></Button>
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

      <EmployeeDrawer employee={selectedEmployee} open={drawerOpen} onClose={handleCloseDrawer} locale={locale} onEdit={handleEdit} />
    </section>
  );
}
