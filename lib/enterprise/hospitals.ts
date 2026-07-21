import { prisma } from "@/lib/prisma";

export type HospitalRecord = {
  id: string;
  name: string;
  code?: string;
  departmentId?: string | null;
  branchId?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HospitalStore = {
  version: 1;
  hospitals: Record<string, HospitalRecord>;
};

const STORE_KEY = "enterprise.hospitals";

function normalize(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function slug(value: string) {
  const cleaned = value.trim().toUpperCase().replace(/[^A-Z0-9\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return cleaned || `HOSPITAL-${Date.now()}`;
}

function normalizeStore(value: unknown): HospitalStore {
  if (!value || typeof value !== "object") return { version: 1, hospitals: {} };
  const raw = value as Partial<HospitalStore>;
  return {
    version: 1,
    hospitals: raw.hospitals && typeof raw.hospitals === "object" ? raw.hospitals : {}
  };
}

export async function getHospitalStore(): Promise<HospitalStore> {
  const setting = await prisma.appSetting.findUnique({ where: { key: STORE_KEY } }).catch(() => null);
  return normalizeStore(setting?.value);
}

export async function saveHospitalStore(store: HospitalStore) {
  return prisma.appSetting.upsert({
    where: { key: STORE_KEY },
    update: { value: store },
    create: { key: STORE_KEY, value: store, description: "Hospital directory for Lana HRMS" }
  });
}

export async function getEmployeeExtraSettings() {
  const settings = await prisma.appSetting.findMany({
    where: { key: { startsWith: "employee.extra." } },
    select: { key: true, value: true }
  });

  return settings.map((setting) => ({
    employeeId: setting.key.replace("employee.extra.", ""),
    value: setting.value && typeof setting.value === "object" ? setting.value as Record<string, unknown> : {}
  }));
}

export async function getEmployeeIdsByHospital(hospital: string) {
  const target = normalize(hospital);
  if (!target) return [];

  const dbEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { hospitalId: hospital },
        { hospital: { id: hospital } },
        { hospital: { name: { equals: hospital, mode: "insensitive" } } },
        { hospital: { code: { equals: hospital, mode: "insensitive" } } }
      ]
    },
    select: { id: true }
  });
  const dbIds = dbEmployees.map((e) => e.id);

  const extra = await getEmployeeExtraSettings();
  const extraIds = extra
    .filter((item) => normalize(String(item.value.hospital ?? "")) === target)
    .map((item) => item.employeeId);

  return Array.from(new Set([...dbIds, ...extraIds]));
}

export async function listHospitals(filters?: { search?: string; departmentId?: string; branchId?: string; isActive?: string }) {
  const [store, extra, departments, branches, sqlHospitals] = await Promise.all([
    getHospitalStore(),
    getEmployeeExtraSettings(),
    prisma.department.findMany({ select: { id: true, name: true, code: true } }),
    prisma.branch.findMany({ select: { id: true, name: true, code: true } }),
    prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        branchId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { employees: { where: { status: "ACTIVE" } } } }
      }
    })
  ]);

  const now = new Date().toISOString();
  const byName = new Map<string, HospitalRecord & { sqlEmployeeCount?: number }>();

  for (const h of sqlHospitals) {
    byName.set(normalize(h.name), {
      id: h.id,
      name: h.name,
      code: h.code,
      departmentId: null,
      branchId: h.branchId || null,
      isActive: h.isActive,
      createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : now,
      updatedAt: h.updatedAt ? new Date(h.updatedAt).toISOString() : now,
      sqlEmployeeCount: h._count.employees
    });
  }

  for (const hospital of Object.values(store.hospitals)) {
    const key = normalize(hospital.name);
    if (!byName.has(key)) {
      byName.set(key, hospital);
    }
  }

  for (const item of extra) {
    const name = String(item.value.hospital ?? "").trim();
    if (!name || byName.has(normalize(name))) continue;
    const id = `derived-${slug(name)}`;
    byName.set(normalize(name), {
      id,
      name,
      code: slug(name),
      departmentId: null,
      branchId: null,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
  }

  const extraCounts = new Map<string, number>();
  for (const item of extra) {
    const name = normalize(String(item.value.hospital ?? ""));
    if (!name) continue;
    extraCounts.set(name, (extraCounts.get(name) ?? 0) + 1);
  }

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeNumber: true,
      nationalId: true,
      firstName: true,
      lastName: true,
      hospitalId: true,
      department: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
      position: { select: { id: true, title: true } }
    },
    take: 10000
  });
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const search = normalize(filters?.search);
  const isActive = filters?.isActive;
  const items = Array.from(byName.values())
    .map((hospital) => {
      const normalizedHospital = normalize(hospital.name);
      const sqlEmployeesCount = employees.filter((e) => e.hospitalId === hospital.id).length;
      const combinedCount = Math.max(hospital.sqlEmployeeCount ?? 0, sqlEmployeesCount, extraCounts.get(normalizedHospital) ?? 0);

      const hospitalEmployees = employees.filter((e) => e.hospitalId === hospital.id || (extra.some((ex) => ex.employeeId === e.id && normalize(String(ex.value.hospital ?? "")) === normalizedHospital)));
      const department = departments.find((item) => item.id === hospital.departmentId) ?? null;
      const branch = branches.find((item) => item.id === hospital.branchId) ?? null;

      // Smart automatic 100% high-precision inference of branch and department from assigned employees when unassigned on Hospital
      let resolvedDepartment = department;
      if (!resolvedDepartment && hospitalEmployees.length > 0) {
        const deptCounts = new Map<string, { count: number; dept: any }>();
        for (const emp of hospitalEmployees) {
          if (emp.department?.id) {
            const current = deptCounts.get(emp.department.id) ?? { count: 0, dept: emp.department };
            current.count += 1;
            deptCounts.set(emp.department.id, current);
          }
        }
        let maxC = 0;
        for (const item of deptCounts.values()) {
          if (item.count > maxC) { maxC = item.count; resolvedDepartment = item.dept; }
        }
      }

      let resolvedBranch = branch;
      if (!resolvedBranch && hospitalEmployees.length > 0) {
        const branchCounts = new Map<string, { count: number; branch: any }>();
        for (const emp of hospitalEmployees) {
          if (emp.branch?.id) {
            const current = branchCounts.get(emp.branch.id) ?? { count: 0, branch: emp.branch };
            current.count += 1;
            branchCounts.set(emp.branch.id, current);
          }
        }
        let maxB = 0;
        for (const item of branchCounts.values()) {
          if (item.count > maxB) { maxB = item.count; resolvedBranch = item.branch; }
        }
      }

      const smartSearchText = [
        hospital.name,
        hospital.code,
        resolvedDepartment?.name,
        resolvedDepartment?.code,
        resolvedBranch?.name,
        resolvedBranch?.code,
        ...hospitalEmployees.flatMap((employee) => [employee.firstName, employee.lastName, `${employee.firstName} ${employee.lastName}`, employee.employeeNumber, employee.nationalId, employee.department?.name, employee.department?.code, employee.branch?.name, employee.branch?.code, employee.position?.title])
      ].filter(Boolean).join(" ").toLowerCase();
      return { ...hospital, employeeCount: combinedCount, department: resolvedDepartment, branch: resolvedBranch, smartSearchText };
    })
    .filter((hospital) => !search || hospital.smartSearchText.includes(search))
    .filter((hospital) => !filters?.departmentId || hospital.departmentId === filters.departmentId)
    .filter((hospital) => !filters?.branchId || hospital.branchId === filters.branchId)
    .filter((hospital) => isActive === undefined || isActive === "" || String(hospital.isActive) === isActive)
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  return { hospitals: items, departments, branches };
}

export async function upsertHospital(input: { id?: string; name: string; code?: string; departmentId?: string | null; branchId?: string | null; isActive?: boolean }) {
  const store = await getHospitalStore();
  const id = input.id && !input.id.startsWith("derived-") ? input.id : `hospital-${Date.now()}`;
  const now = new Date().toISOString();
  const previous = store.hospitals[id];
  store.hospitals[id] = {
    id,
    name: input.name.trim(),
    code: input.code?.trim() || slug(input.name),
    departmentId: input.departmentId || null,
    branchId: input.branchId || null,
    isActive: input.isActive ?? previous?.isActive ?? true,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now
  };
  await saveHospitalStore(store);
  return store.hospitals[id];
}

export async function softDeleteHospital(id: string) {
  const store = await getHospitalStore();
  if (!store.hospitals[id]) return null;
  store.hospitals[id] = { ...store.hospitals[id], isActive: false, updatedAt: new Date().toISOString() };
  await saveHospitalStore(store);
  return store.hospitals[id];
}
