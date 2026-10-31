import { prisma } from "@/lib/prisma";
import { clearMemoryCache } from "@/lib/cache/memory-cache";
import type { OdooClient } from "./client";

/** Refresh the relationship and the manager's own name, including removals. */
export async function syncEmployeeManager(client: OdooClient, employeeId: string, source?: Record<string, unknown>) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, odooId: true, managerId: true, odooParentId: true, odooRawData: true } });
  if (!employee?.odooId) return { changed: false };
  const row = source ?? (await client.read<Record<string, unknown>>("hr.employee", [employee.odooId], ["id", "parent_id"]))[0];
  if (!row || Number(row.id) !== employee.odooId || !("parent_id" in row)) return { changed: false };
  const parent = row.parent_id;
  const odooParentId = Array.isArray(parent) ? Number(parent[0]) || null : Number(parent) || null;
  if (odooParentId === employee.odooId) return { changed: false };
  let managerId: string | null = null;
  let managerName = Array.isArray(parent) ? String(parent[1] || "") : "";
  let changed = false;
  if (odooParentId) {
    const [local, upstream] = await Promise.all([
      prisma.employee.findUnique({ where: { odooId: odooParentId }, select: { id: true, firstName: true, lastName: true } }),
      client.read<Record<string, unknown>>("hr.employee", [odooParentId], ["id", "name"]),
    ]);
    const name = upstream[0]?.name;
    if (typeof name === "string" && name.trim()) managerName = name.trim();
    if (local) {
      managerId = local.id;
      const [firstName, ...rest] = managerName.split(/\s+/);
      const lastName = rest.join(" ");
      if (firstName && (local.firstName !== firstName || local.lastName !== lastName)) {
        await prisma.employee.update({ where: { id: local.id }, data: { firstName, lastName } });
        changed = true;
      }
    }
  }
  const snapshot = employee.odooRawData && typeof employee.odooRawData === "object" && !Array.isArray(employee.odooRawData) ? employee.odooRawData : {};
  const parentSnapshot = odooParentId ? [odooParentId, managerName] : false;
  if (employee.managerId !== managerId || employee.odooParentId !== odooParentId || JSON.stringify(snapshot.parent_id) !== JSON.stringify(parentSnapshot)) {
    await prisma.employee.update({ where: { id: employee.id }, data: { managerId, odooParentId, odooRawData: { ...snapshot, parent_id: parentSnapshot } } });
    changed = true;
  }
  if (changed) clearMemoryCache("emp-master:");
  return { changed, managerId, odooParentId };
}
