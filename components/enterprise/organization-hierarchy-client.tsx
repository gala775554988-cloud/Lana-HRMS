"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Building2, GitBranch, Network, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string; branchId: string | null; departmentId: string | null; positionId: string | null; branch?: { name: string } | null; department?: { name: string } | null; position?: { title: string } | null };
type Branch = { id: string; name: string; code: string };
type Department = { id: string; name: string; code: string };
type Position = { id: string; title: string; code: string; departmentId: string | null };
type Store = { version: 1; directManagers: Record<string, string>; departmentManagers: Record<string, string>; branchManagers: Record<string, string>; hrManagers: string[]; projects: Record<string, { name: string; managerEmployeeId?: string; employeeIds: string[] }> };

type Payload = { store: Store; employees: Employee[]; branches: Branch[]; departments: Department[]; positions: Position[]; company: { name: string } };

export function OrganizationHierarchyClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

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
  const empty = "";

  function employeeLabel(employee: Employee) {
    return `${employee.employeeNumber} - ${employee.firstName} ${employee.lastName}`;
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
      const response = await fetch("/api/enterprise/hierarchy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ store }) });
      const data = await response.json();
      setMessage(data.success ? "تم حفظ الهيكل الإداري بنجاح" : data.message || "Failed to save hierarchy");
    });
  }

  if (!payload || !store) return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">جاري تحميل الهيكل الإداري...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> الشركة</CardTitle>
          <CardDescription>Company, branches, departments, sections, projects, and approval managers.</CardDescription>
        </CardHeader>
        <CardContent className="rounded-xl border bg-muted/30 p-4 font-semibold">{payload.company.name}</CardContent>
      </Card>

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>مدراء الفروع</CardTitle><CardDescription>Branch Manager per branch.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {payload.branches.map((branch) => (
              <label key={branch.id} className="grid gap-1 text-sm">
                <span>{branch.name} ({branch.code})</span>
                <select value={store.branchManagers[branch.id] ?? empty} onChange={(event) => updateStore((draft) => { if (event.target.value) draft.branchManagers[branch.id] = event.target.value; else delete draft.branchManagers[branch.id]; })} className="h-10 rounded-xl border bg-background px-3">
                  <option value="">Skip / Not assigned</option>
                  {employeeOptions.filter((employee) => !employee.branchId || employee.branchId === branch.id).map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
                </select>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>مدراء الإدارات</CardTitle><CardDescription>Department Manager per department.</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            {payload.departments.map((department) => (
              <label key={department.id} className="grid gap-1 text-sm">
                <span>{department.name} ({department.code})</span>
                <select value={store.departmentManagers[department.id] ?? empty} onChange={(event) => updateStore((draft) => { if (event.target.value) draft.departmentManagers[department.id] = event.target.value; else delete draft.departmentManagers[department.id]; })} className="h-10 rounded-xl border bg-background px-3">
                  <option value="">Skip / Not assigned</option>
                  {employeeOptions.filter((employee) => !employee.departmentId || employee.departmentId === department.id).map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
                </select>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Network className="h-5 w-5" /> المدير المباشر لكل موظف</CardTitle><CardDescription>Every employee remains linked to branch, department, and section through existing records.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {payload.employees.map((employee) => (
            <label key={employee.id} className="grid gap-1 rounded-xl border p-3 text-sm">
              <span>{employeeLabel(employee)}</span>
              <span className="text-xs text-muted-foreground">{employee.branch?.name ?? "No branch"} • {employee.department?.name ?? "No department"} • {employee.position?.title ?? "No section"}</span>
              <select value={store.directManagers[employee.id] ?? empty} onChange={(event) => updateStore((draft) => { if (event.target.value) draft.directManagers[employee.id] = event.target.value; else delete draft.directManagers[employee.id]; })} className="h-10 rounded-xl border bg-background px-3">
                <option value="">Skip / Not assigned</option>
                {employeeOptions.filter((manager) => manager.id !== employee.id).map((manager) => <option key={manager.id} value={manager.id}>{employeeLabel(manager)}</option>)}
              </select>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>مدير الموارد البشرية</CardTitle><CardDescription>Multiple HR managers can be assigned.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 lg:grid-cols-3">
          {employeeOptions.map((employee) => (
            <label key={employee.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <span>{employeeLabel(employee)}</span>
              <input type="checkbox" checked={store.hrManagers.includes(employee.id)} onChange={(event) => updateStore((draft) => { draft.hrManagers = event.target.checked ? Array.from(new Set([...draft.hrManagers, employee.id])) : draft.hrManagers.filter((id) => id !== employee.id); })} className="h-5 w-5 accent-indigo-600" />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><GitBranch className="h-5 w-5" /> المشاريع</CardTitle><CardDescription>Project managers and assigned employees.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(store.projects).map(([projectId, project]) => (
            <div key={projectId} className="grid gap-3 rounded-xl border p-3 lg:grid-cols-[1fr_1fr]">
              <input value={project.name} onChange={(event) => updateStore((draft) => { draft.projects[projectId].name = event.target.value; })} className="h-10 rounded-xl border bg-background px-3" />
              <select value={project.managerEmployeeId ?? empty} onChange={(event) => updateStore((draft) => { draft.projects[projectId].managerEmployeeId = event.target.value || undefined; })} className="h-10 rounded-xl border bg-background px-3">
                <option value="">Project Manager</option>
                {employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}
              </select>
              <div className="lg:col-span-2 grid gap-2 lg:grid-cols-3">
                {employeeOptions.map((employee) => (
                  <label key={employee.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                    <span>{employeeLabel(employee)}</span>
                    <input type="checkbox" checked={project.employeeIds.includes(employee.id)} onChange={(event) => updateStore((draft) => { const ids = draft.projects[projectId].employeeIds; draft.projects[projectId].employeeIds = event.target.checked ? Array.from(new Set([...ids, employee.id])) : ids.filter((id) => id !== employee.id); })} />
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={() => updateStore((draft) => { draft.projects[`project-${Date.now()}`] = { name: "New Project", employeeIds: [] }; })}>Add Project</Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button type="button" onClick={save} disabled={isPending} className="gap-2 shadow-lg"><Save className="h-4 w-4" />Save Hierarchy</Button>
      </div>
    </div>
  );
}
