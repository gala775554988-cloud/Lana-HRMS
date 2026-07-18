"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, GitBranch, Network, Save, ChevronRight, ChevronDown, Users, UserCheck, Loader2, Search, Briefcase, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type Employee = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  name?: string;
  branchId: string | null;
  departmentId: string | null;
  positionId: string | null;
  managerId?: string | null;
  profilePhotoUrl?: string | null;
  positionTitle?: string;
  departmentName?: string;
  branchName?: string;
  childrenCount?: number;
  branch?: { name: string } | null;
  department?: { name: string; code?: string } | null;
  position?: { title: string } | null;
};

type Department = {
  id: string;
  name: string;
  code: string;
  _count?: { employees: number };
};

type Branch = { id: string; name: string; code: string };
type Position = { id: string; title: string; code: string; departmentId: string | null };
type Store = {
  version: 1;
  directManagers: Record<string, string>;
  departmentManagers: Record<string, string>;
  branchManagers: Record<string, string>;
  hrManagers: string[];
  projects: Record<string, { name: string; managerEmployeeId?: string; employeeIds: string[] }>;
};

type Payload = {
  store: Store;
  topRoots?: Employee[];
  managers?: Employee[];
  employees: Employee[];
  branches: Branch[];
  departments: Department[];
  positions: Position[];
  company: { name: string };
};

// Expand-on-click lazy node component
function LazyTreeNode({ employee, level = 0 }: { employee: Employee; level?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(false);

  const hasChildren = (employee.childrenCount ?? 0) > 0;
  const fullName = employee.name || `${employee.firstName} ${employee.lastName}`.trim();
  const initials = `${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`.toUpperCase();

  const handleToggle = async () => {
    if (!hasChildren) return;
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    if (children === null && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/enterprise/hierarchy/nodes?parentId=${employee.id}`);
        const data = await res.json();
        if (data.success) {
          setChildren(data.nodes || []);
        } else {
          setChildren([]);
        }
      } catch {
        setChildren([]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="select-none text-sm">
      <div
        onClick={handleToggle}
        className={`flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary dark:hover:bg-primary/20 ${
          hasChildren ? "cursor-pointer font-medium" : "cursor-default text-slate-700 dark:text-slate-300"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {hasChildren ? (
            <div className="h-6 w-6 rounded-lg bg-primary/8 text-primary dark:bg-primary/60 dark:text-primary/50 flex items-center justify-center shrink-0">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
            </div>
          ) : (
            <div className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
              <UserCheck className="h-3.5 w-3.5" />
            </div>
          )}
          <Avatar className="h-9 w-9 rounded-xl border shrink-0">
            {employee.profilePhotoUrl ? (
              <AvatarImage src={employee.profilePhotoUrl} alt={fullName} className="object-cover" />
            ) : (
              <AvatarFallback className="bg-primary/12 text-primary dark:bg-primary dark:text-primary/30 font-bold text-xs">{initials}</AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 dark:text-slate-100 truncate">{fullName}</span>
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                {employee.employeeNumber}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {employee.positionTitle || employee.position?.title || "بدون منصب"} • {employee.departmentName || employee.department?.name || "بدون قسم"}
            </p>
          </div>
        </div>
        {hasChildren ? (
          <Badge className="bg-primary hover:bg-primary text-white rounded-xl px-2.5 py-0.5 text-xs font-semibold shrink-0 gap-1 shadow-xs">
            <Users className="h-3 w-3" />
            <span>{employee.childrenCount} مرؤوس</span>
          </Badge>
        ) : null}
      </div>

      {isOpen && (
        <div className="mt-2 ms-4 border-s-2 border-primary/80 ps-4 space-y-2 dark:border-primary/60 rtl:ms-0 rtl:me-4 rtl:border-s-0 rtl:border-e-2 rtl:ps-0 rtl:pe-4 animate-in fade-in duration-200">
          {loading ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-primary dark:text-primary/50" />
              <span>جاري تحميل المرؤوسين المباشرين للمدير ({fullName})...</span>
            </div>
          ) : children && children.length > 0 ? (
            children.map((child) => <LazyTreeNode key={child.id} employee={child} level={level + 1} />)
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-muted-foreground dark:border-slate-800">
              لا يوجد مرؤوسون مباشرون حالياً
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Expand-on-click lazy department container
function LazyDepartmentNode({ department }: { department: Department }) {
  const [isOpen, setIsOpen] = useState(false);
  const [roots, setRoots] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(false);

  const empCount = department._count?.employees ?? 0;

  const handleToggle = async () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }
    setIsOpen(true);
    if (roots === null && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/enterprise/hierarchy/nodes?departmentId=${department.id}&rootOnly=true`);
        const data = await res.json();
        if (data.success) {
          setRoots(data.nodes || []);
        } else {
          setRoots([]);
        }
      } catch {
        setRoots([]);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-2">
      <div
        onClick={handleToggle}
        className="flex items-center justify-between gap-4 rounded-2xl border border-primary/80 bg-primary/40 p-4 shadow-xs transition-all duration-200 hover:border-primary/30 hover:bg-primary/50 dark:border-primary/50 dark:bg-primary/20 dark:hover:border-primary dark:hover:bg-primary/40 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-sm">
            {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5 rtl:rotate-180" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{department.name}</h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">رمز القسم: {department.code}</p>
          </div>
        </div>
        <Badge variant="secondary" className="bg-white text-primary border-primary/20 dark:bg-slate-900 dark:text-primary/30 dark:border-primary px-3 py-1 text-xs font-bold gap-1.5 shadow-xs">
          <Briefcase className="h-3.5 w-3.5" />
          <span>{empCount} رؤساء/مدراء في المستوى الأعلى</span>
        </Badge>
      </div>

      {isOpen && (
        <div className="ms-4 border-s-2 border-primary/30 ps-4 space-y-2.5 dark:border-primary rtl:ms-0 rtl:me-4 rtl:border-s-0 rtl:border-e-2 rtl:ps-0 rtl:pe-4 animate-in fade-in duration-200">
          {loading ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-primary dark:text-primary/50" />
              <span>جاري تحميل المستوى الأعلى للمدراء ورؤساء الفرق في ({department.name})...</span>
            </div>
          ) : roots && roots.length > 0 ? (
            roots.map((root) => <LazyTreeNode key={root.id} employee={root} />)
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center text-xs text-muted-foreground dark:border-slate-800 dark:bg-slate-900">
              لا يوجد مدراء أو موظفون رئيسيون مسجلون حالياً في الإدارة الأعلى لهذا القسم
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrganizationHierarchyClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [searchOverride, setSearchOverride] = useState("");
  const [overridePage, setOverridePage] = useState(1);
  const overridePageSize = 25;

  useEffect(() => {
    fetch("/api/enterprise/hierarchy", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load hierarchy");
        setPayload(data);
        setStore(data.store);
      })
      .catch((error) => setMessage(error.message));
  }, []);

  const employeeOptions = useMemo(() => payload?.employees ?? [], [payload]);
  const managersList = useMemo(() => payload?.managers ?? employeeOptions, [payload, employeeOptions]);
  const empty = "";

  function employeeLabel(employee: Employee) {
    const fullName = employee.name || `${employee.firstName} ${employee.lastName}`.trim();
    return `${employee.employeeNumber} - ${fullName}`;
  }

  function updateStore(mutator: (draft: Store) => void) {
    setStore((current) => {
      if (!current) return current;
      const draft = JSON.parse(JSON.stringify(current)) as Store;
      mutator(draft);
      return draft;
    });
  }

  function save() {
    if (!store) return;
    startTransition(async () => {
      const response = await fetch("/api/enterprise/hierarchy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ store })
      });
      const data = await response.json().catch(() => ({ success: false, message: "فشل قراءة رد الحفظ" }));
      setMessage(data.success ? "تم حفظ التعديلات على الهيكل الإداري بنجاح" : data.message || "فشل حفظ الهيكل");
    });
  }

  const filteredOverrides = useMemo(() => {
    if (!searchOverride.trim()) return employeeOptions;
    const q = searchOverride.toLowerCase();
    return employeeOptions.filter((e) => {
      const name = `${e.firstName} ${e.lastName}`.toLowerCase();
      return name.includes(q) || e.employeeNumber.toLowerCase().includes(q);
    });
  }, [employeeOptions, searchOverride]);

  const paginatedOverrides = useMemo(() => {
    const start = (overridePage - 1) * overridePageSize;
    return filteredOverrides.slice(start, start + overridePageSize);
  }, [filteredOverrides, overridePage]);

  const totalPages = Math.ceil(filteredOverrides.length / overridePageSize) || 1;

  if (!payload || !store) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-white p-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-10 w-10 animate-spin text-primary dark:text-primary/50 mb-4" />
        <p className="text-base font-bold text-slate-900 dark:text-slate-100">جاري تحميل المستوى الأعلى للهيكل التنظيمي التفاعلي...</p>
        <p className="text-xs text-muted-foreground mt-1">يتم الآن تفعيل التحميل الكسول (Lazy Loading) لمنع تجمد المتصفح</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <Badge className="bg-primary/8 text-primary border-primary/20 dark:bg-primary/60 dark:text-primary/30 dark:border-primary mb-2 px-3 py-1 text-xs font-bold gap-1.5">
            <Network className="h-3.5 w-3.5" />
            <span>نظام الهيكل التنظيمي التدريجي (Lazy OrgChart)</span>
          </Badge>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">الهيكل التنظيمي والتسلسل الإداري للمؤسسة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            تم تفعيل التحميل عند الطلب (Expand-on-Click) لمنع تجمد النظام والتعامل الفوري مع آلاف الموظفين بكفاءة فائقة.
          </p>
        </div>
        <div className="flex items-center gap-3 self-end lg:self-auto">
          <Button onClick={save} disabled={isPending} className="rounded-xl px-6 h-11 gap-2 bg-primary hover:bg-primary text-white shadow-md font-bold">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>حفظ التعديلات</span>
          </Button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/80 p-4 text-sm font-semibold text-primary shadow-xs dark:border-primary dark:bg-primary/40 dark:text-primary/20 animate-in fade-in">
          {message}
        </div>
      ) : null}

      <Tabs defaultValue="chart" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 rounded-2xl bg-slate-100 p-1.5 h-auto dark:bg-slate-800">
          <TabsTrigger value="chart" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-primary/50 gap-2">
            <Network className="h-4 w-4" />
            <span>الهيكل الشجري التفاعلي</span>
          </TabsTrigger>
          <TabsTrigger value="departments" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-primary/50 gap-2">
            <Building2 className="h-4 w-4" />
            <span>مدراء الإدارات والأقسام</span>
          </TabsTrigger>
          <TabsTrigger value="overrides" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-primary/50 gap-2">
            <Users className="h-4 w-4" />
            <span>المدراء المباشرون (استثناءات)</span>
          </TabsTrigger>
          <TabsTrigger value="projects" className="rounded-xl py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-primary/50 gap-2">
            <GitBranch className="h-4 w-4" />
            <span>مدراء الموارد البشرية والمشاريع</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Interactive Lazy OrgChart */}
        <TabsContent value="chart" className="mt-6 space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">شجرة التنظيم الإداري (التحميل التدريجي)</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    اضغط على الإدارة أو اسم المدير لتوسيع المستوى المستهدف وجلب مرؤوسيه لحظياً (Expand-on-Click).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Department level tree containers */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary dark:text-primary/50" />
                  <span>الإدارات والأقسام الرئيسية ({payload.departments.length} قسم)</span>
                </h3>
                <div className="grid gap-3">
                  {payload.departments.map((department) => (
                    <LazyDepartmentNode key={department.id} department={department} />
                  ))}
                </div>
              </div>

              {/* Top roots container */}
              {payload.topRoots && payload.topRoots.length > 0 ? (
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary dark:text-primary/50" />
                    <span>القيادات ورؤساء الفرق الرئيسية (المستوى الأعلى - Top Level Roots)</span>
                  </h3>
                  <div className="space-y-2">
                    {payload.topRoots.map((root) => (
                      <LazyTreeNode key={root.id} employee={root} />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Department Managers */}
        <TabsContent value="departments" className="mt-6">
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <CardTitle className="text-lg font-bold">تعيين مدير لكل إدارة أو قسم</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                حدد المدير المعتمد لكل قسم ليتم اعتماده كمرجع أعلى للطلبات والموافقات في حال عدم وجود مدير مباشر.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {payload.departments.map((department) => (
                <div key={department.id} className="rounded-2xl border border-slate-200/80 p-4 space-y-2.5 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{department.name}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">{department.code}</Badge>
                  </div>
                  <select
                    value={store.departmentManagers[department.id] ?? empty}
                    onChange={(event) => updateStore((draft) => {
                      if (event.target.value) draft.departmentManagers[department.id] = event.target.value;
                      else delete draft.departmentManagers[department.id];
                    })}
                    className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary"
                  >
                    <option value="">بدون مدير (غير محدد)</option>
                    {managersList.map((m) => (
                      <option key={m.id} value={m.id}>{employeeLabel(m)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Direct Manager Overrides (Paginated & Searchable to prevent freeze) */}
        <TabsContent value="overrides" className="mt-6 space-y-4">
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold">تحديد المدراء المباشرين (Overrides)</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    يتم عرض الموظفين على دفعات (25 موظف لكل صفحة) مع بحث فوري لتجنب تجمد المتصفح نهائياً.
                  </CardDescription>
                </div>
                <div className="relative w-full md:w-80">
                  <Search className="absolute right-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchOverride}
                    onChange={(e) => { setSearchOverride(e.target.value); setOverridePage(1); }}
                    placeholder="ابحث عن موظف بالاسم أو الرقم..."
                    className="pr-10 h-10 rounded-xl bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {paginatedOverrides.map((employee) => (
                  <div key={employee.id} className="rounded-2xl border border-slate-200/80 p-4 space-y-2 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{employeeLabel(employee)}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0">{employee.department?.name || "بدون قسم"}</Badge>
                    </div>
                    <select
                      value={store.directManagers[employee.id] ?? empty}
                      onChange={(event) => updateStore((draft) => {
                        if (event.target.value) draft.directManagers[employee.id] = event.target.value;
                        else delete draft.directManagers[employee.id];
                      })}
                      className="h-10 w-full rounded-xl border bg-background px-3 text-xs font-medium focus:ring-2 focus:ring-primary"
                    >
                      <option value="">تلقائي من Odoo / غير محدد</option>
                      {managersList.filter((m) => m.id !== employee.id).map((manager) => (
                        <option key={manager.id} value={manager.id}>{employeeLabel(manager)}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800 text-xs text-muted-foreground">
                <span>عرض الصفحة {overridePage} من {totalPages} (إجمالي المطابق: {filteredOverrides.length} موظف)</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={overridePage <= 1} onClick={() => setOverridePage((p) => Math.max(p - 1, 1))} className="rounded-xl h-8">
                    السابق
                  </Button>
                  <Button variant="outline" size="sm" disabled={overridePage >= totalPages} onClick={() => setOverridePage((p) => Math.min(p + 1, totalPages))} className="rounded-xl h-8">
                    التالي
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: HR Managers & Projects */}
        <TabsContent value="projects" className="mt-6 space-y-6">
          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <CardTitle className="text-lg font-bold">مدراء الموارد البشرية المعتمدون</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">يتمتع هؤلاء المدراء بصلاحيات اعتماد الطلبات وإدارة الهيكل.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid gap-2 md:grid-cols-3">
              {managersList.map((m) => (
                <label key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 p-3 text-xs font-medium hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900 cursor-pointer">
                  <span className="truncate">{employeeLabel(m)}</span>
                  <input
                    type="checkbox"
                    checked={store.hrManagers.includes(m.id)}
                    onChange={(event) => updateStore((draft) => {
                      draft.hrManagers = event.target.checked
                        ? Array.from(new Set([...draft.hrManagers, m.id]))
                        : draft.hrManagers.filter((id) => id !== m.id);
                    })}
                    className="h-4 w-4 rounded text-primary focus:ring-primary shrink-0"
                  />
                </label>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <CardTitle className="text-lg font-bold">المشاريع ومدراء المشاريع</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">إدارة المشاريع وتحديد مدير وفريق عمل لكل مشروع.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {Object.entries(store.projects).map(([projectId, project]) => (
                <div key={projectId} className="rounded-2xl border border-slate-200/80 p-4 space-y-3 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      value={project.name}
                      onChange={(event) => updateStore((draft) => { draft.projects[projectId].name = event.target.value; })}
                      placeholder="اسم المشروع"
                      className="rounded-xl h-10 bg-white dark:bg-slate-900 font-bold"
                    />
                    <select
                      value={project.managerEmployeeId ?? empty}
                      onChange={(event) => updateStore((draft) => { draft.projects[projectId].managerEmployeeId = event.target.value || undefined; })}
                      className="h-10 rounded-xl border bg-white dark:bg-slate-900 px-3 text-xs font-medium"
                    >
                      <option value="">حدد مدير المشروع</option>
                      {managersList.map((m) => <option key={m.id} value={m.id}>{employeeLabel(m)}</option>)}
                    </select>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={() => updateStore((draft) => { draft.projects[`project-${Date.now()}`] = { name: "مشروع جديد", employeeIds: [] }; })} className="rounded-xl gap-2">
                <Plus className="h-4 w-4" />
                <span>إضافة مشروع جديد</span>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
