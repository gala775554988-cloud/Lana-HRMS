import { prisma } from "@/lib/prisma";

// Static categorization of real Department rows into the four executive-hub
// buckets (confirmed against the live "الأقسام" filter). Only employee
// counts are looked up dynamically -- a department name absent from the
// database simply doesn't appear, never a fabricated zero-count row.
const OPERATIONS_DEPARTMENTS = ["المشاريع", "الخدمات اللوجستية", "محطات المعالجة", "النفايات الطبية", "مكافحة العدوى", "البيئة"];
const MEDICAL_SUPPLIES_DEPARTMENTS = ["المستلزمات الطبية", "الأجهزة والمستلزمات الطبية", "صيانة الأجهزة الطبية", "الاجهزة الطبية", "مشتريات المستلزمات الطبية"];
const MAIN_ADMINISTRATION_DEPARTMENTS = ["Lana Care", "الإدارة", "المالية", "إدارة التوريد", "تقنية المعلومات", "المراجع"];

export type OrgGroupItem = { id: string; name: string; count: number; href: string };
export type OrgGroupCard = { total: number; items: OrgGroupItem[]; href: string };
export type ExecutiveHubOrgGroups = {
  hospitals: OrgGroupCard;
  operations: OrgGroupCard;
  medicalSupplies: OrgGroupCard;
  mainAdministration: OrgGroupCard;
};

function departmentHref(name: string) {
  return `/branches?tab=departments&search=${encodeURIComponent(name)}`;
}

function buildBucket(
  names: string[],
  countsByName: Map<string, { id: string; count: number }>
): OrgGroupCard {
  const items: OrgGroupItem[] = [];
  let total = 0;
  for (const name of names) {
    const match = countsByName.get(name);
    if (!match) continue;
    items.push({ id: match.id, name, count: match.count, href: departmentHref(name) });
    total += match.count;
  }
  return { total, items, href: "/branches?tab=departments" };
}

export async function getExecutiveHubOrgGroups(): Promise<ExecutiveHubOrgGroups> {
  const allNames = [...OPERATIONS_DEPARTMENTS, ...MEDICAL_SUPPLIES_DEPARTMENTS, ...MAIN_ADMINISTRATION_DEPARTMENTS];

  const [departments, hospitals, employeeHospitalCounts] = await Promise.all([
    prisma.department.findMany({
      where: { isActive: true, name: { in: allNames } },
      select: { id: true, name: true, _count: { select: { employees: { where: { status: "ACTIVE" } } } } }
    }).catch(() => []),
    prisma.hospital.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    }).catch(() => []),
    prisma.employee.groupBy({
      by: ["hospitalId"],
      where: { status: "ACTIVE", hospitalId: { not: null } },
      _count: { _all: true }
    }).catch(() => [])
  ]);

  const countsByName = new Map(departments.map((d) => [d.name, { id: d.id, count: d._count.employees }]));
  const hospitalCountById = new Map(employeeHospitalCounts.map((row) => [row.hospitalId as string, row._count._all]));

  const hospitalItems: OrgGroupItem[] = hospitals
    .map((h) => ({ id: h.id, name: h.name, count: hospitalCountById.get(h.id) ?? 0, href: `/hospitals/${h.id}` }))
    .sort((a, b) => b.count - a.count);
  const hospitalsTotal = hospitalItems.reduce((sum, item) => sum + item.count, 0);

  return {
    hospitals: { total: hospitalsTotal, items: hospitalItems, href: "/hospitals" },
    operations: buildBucket(OPERATIONS_DEPARTMENTS, countsByName),
    medicalSupplies: buildBucket(MEDICAL_SUPPLIES_DEPARTMENTS, countsByName),
    mainAdministration: buildBucket(MAIN_ADMINISTRATION_DEPARTMENTS, countsByName)
  };
}
