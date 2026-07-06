"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Copy, RotateCcw, ShieldCheck, SlidersHorizontal, UserCog, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PermissionCategory = { key: string; title: string; permissions: string[] };
type EmployeeOption = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string | null;
  userId: string | null;
  department?: { name: string } | null;
  branch?: { name: string } | null;
  user?: { id: string; name: string | null; email: string | null; roles: { role: { name: string } }[] } | null;
};

type Payload = {
  employees: EmployeeOption[];
  permissions: string[];
  categories: PermissionCategory[];
  templates: Record<string, string[]>;
  userPermissions: Record<string, { grants: string[]; denies: string[]; temporaryGrants?: Record<string, string> }>;
};

export function PermissionsManagementClient() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [copySourceUserId, setCopySourceUserId] = useState<string>("");
  const [template, setTemplate] = useState<string>("EMPLOYEE");
  const [message, setMessage] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch("/api/enterprise/permissions", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Failed to load permissions");
        setPayload(data);
        const firstUserId = data.employees?.find((employee: EmployeeOption) => employee.userId)?.userId ?? "";
        setSelectedUserId(firstUserId);
        setCopySourceUserId(firstUserId);
        setSelectedPermissions(new Set(data.userPermissions?.[firstUserId]?.grants ?? []));
      })
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!payload || !selectedUserId) return;
    setSelectedPermissions(new Set(payload.userPermissions[selectedUserId]?.grants ?? []));
  }, [payload, selectedUserId]);

  const selectedEmployee = useMemo(() => payload?.employees.find((employee) => employee.userId === selectedUserId), [payload, selectedUserId]);

  function togglePermission(permission: string) {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  function save(operation: "replace" | "grant-all" | "remove-all" | "template" | "copy" | "reset-default") {
    if (!selectedUserId) return;
    startTransition(async () => {
      const response = await fetch("/api/enterprise/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId: selectedUserId,
          grants: Array.from(selectedPermissions),
          operation,
          template,
          sourceUserId: copySourceUserId
        })
      });
      const data = await response.json();
      if (!data.success) {
        setMessage(data.message || "Failed to update permissions");
        return;
      }
      setPayload((current) => current ? {
        ...current,
        userPermissions: {
          ...current.userPermissions,
          [selectedUserId]: data.permissions
        }
      } : current);
      setSelectedPermissions(new Set(data.permissions.grants ?? []));
      setMessage("تم تحديث الصلاحيات بنجاح / Permissions updated successfully");
    });
  }

  if (!payload) {
    return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">جاري تحميل إدارة الصلاحيات...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Permissions Management</CardTitle>
          <CardDescription>Role and direct permissions are managed separately. Only Super Admin can change direct grants.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <label className="text-sm font-medium">اختيار الموظف / Select employee</label>
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">
              {payload.employees.map((employee) => (
                <option key={employee.id} value={employee.userId ?? ""}>
                  {employee.employeeNumber} - {employee.firstName} {employee.lastName} ({employee.user?.roles.map((role) => role.role.name).join(", ") || "NO_ROLE"})
                </option>
              ))}
            </select>
            {selectedEmployee ? (
              <div className="rounded-xl border bg-muted/40 p-3 text-sm text-muted-foreground">
                {selectedEmployee.department?.name ?? "No department"} • {selectedEmployee.branch?.name ?? "No branch"} • {selectedEmployee.user?.email ?? selectedEmployee.email}
              </div>
            ) : null}
          </div>
          <div className="grid gap-2 rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4" /> Selected direct grants: {selectedPermissions.size}</div>
            <div className="text-muted-foreground">Role permissions remain intact and are not removed by this screen.</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Actions</CardTitle>
          <CardDescription>Grant all, remove all, copy permissions, reset defaults, or apply a predefined template.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => save("replace")} disabled={isPending}>Save</Button>
          <Button type="button" variant="outline" onClick={() => save("grant-all")} disabled={isPending}>Grant All</Button>
          <Button type="button" variant="outline" onClick={() => save("remove-all")} disabled={isPending}>Remove All</Button>
          <Button type="button" variant="outline" onClick={() => save("reset-default")} disabled={isPending}><RotateCcw className="me-2 h-4 w-4" />Reset Default</Button>
          <select value={template} onChange={(event) => setTemplate(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
            {Object.keys(payload.templates).map((key) => <option key={key} value={key}>{key}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={() => save("template")} disabled={isPending}>Apply Template</Button>
          <select value={copySourceUserId} onChange={(event) => setCopySourceUserId(event.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm">
            {payload.employees.map((employee) => <option key={employee.id} value={employee.userId ?? ""}>{employee.employeeNumber} - {employee.firstName} {employee.lastName}</option>)}
          </select>
          <Button type="button" variant="outline" onClick={() => save("copy")} disabled={isPending}><Copy className="me-2 h-4 w-4" />Copy Permissions</Button>
        </CardContent>
      </Card>

      {message ? <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">{message}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {payload.categories.map((category) => (
          <details key={category.key} open className="rounded-2xl border bg-card p-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Users className="h-4 w-4" />{category.title}</summary>
            <div className="mt-4 grid gap-2">
              {category.permissions.map((permission) => (
                <label key={permission} className="flex items-center justify-between rounded-xl border bg-background p-3 text-sm">
                  <span className="font-mono">{permission}</span>
                  <input type="checkbox" checked={selectedPermissions.has(permission)} onChange={() => togglePermission(permission)} className="h-5 w-5 accent-indigo-600" />
                </label>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
