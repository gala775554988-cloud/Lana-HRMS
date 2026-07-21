import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One-time cleanup for Hospital rows fragmented by the Odoo sync bug fixed
 * alongside this route: three sync paths used to mint Hospital.code under two
 * different schemes (ODOO-HOSP-* vs ODOO-SCHOOL-*) for the same physical
 * hospital name, and a fourth path (employee-master sync) crashed before ever
 * setting hospitalId at all. That fragmentation is why the hospitals list
 * could show many rows each with a tiny headcount for what's really one
 * hospital. This groups existing Hospital rows by normalized name, keeps the
 * one with the most linked employees as canonical, re-points every employee
 * on a duplicate row to it, and deactivates (never deletes) the duplicates so
 * the merge is reversible and auditable. Safe to call again -- a name group
 * with only one row is left untouched. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const roles = (session.user.roles as string[]) || [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const hospitals = await prisma.hospital.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, createdAt: true, _count: { select: { employees: true } } }
  });

  const groups = new Map<string, typeof hospitals>();
  for (const h of hospitals) {
    const key = h.name.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(h);
    groups.set(key, list);
  }

  const merges: Array<{ name: string; canonicalId: string; canonicalCode: string; mergedIds: string[]; employeesMoved: number }> = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const [canonical, ...duplicates] = [...group].sort((a, b) => {
      if (b._count.employees !== a._count.employees) return b._count.employees - a._count.employees;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const duplicateIds = duplicates.map((d) => d.id);
    const moved = await prisma.employee.updateMany({
      where: { hospitalId: { in: duplicateIds } },
      data: { hospitalId: canonical.id }
    });

    for (const dup of duplicates) {
      await prisma.hospital.update({
        where: { id: dup.id },
        data: { isActive: false, code: `${dup.code}-MERGED-${Date.now()}`.slice(0, 191) }
      });
    }

    merges.push({
      name: canonical.name,
      canonicalId: canonical.id,
      canonicalCode: canonical.code,
      mergedIds: duplicateIds,
      employeesMoved: moved.count
    });
  }

  await prisma.integrationLog.create({
    data: {
      level: "INFO",
      action: "HOSPITAL_RECONCILE",
      message: `Reconciled ${merges.length} duplicate hospital name group(s)`,
      metadata: { merges } as any
    }
  }).catch(() => undefined);

  return NextResponse.json({ success: true, groupsMerged: merges.length, merges });
}
