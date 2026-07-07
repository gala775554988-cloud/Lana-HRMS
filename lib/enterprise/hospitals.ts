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
  const extra = await getEmployeeExtraSettings();
  return extra
    .filter((item) => normalize(String(item.value.hospital ?? "")) === target)
    .map((item) => item.employeeId);
}

export async function listHospitals(filters?: { search?: string; departmentId?: string; branchId?: string; isActive?: string }) {
  const [store, extra, departments, branches] = await Promise.all([
    getHospitalStore(),
    getEmployeeExtraSettings(),
    prisma.department.findMany({ select: { id: true, name: true, code: true } }),
    prisma.branch.findMany({ select: { id: true, name: true, code: true } })
  ]);

  const now = new Date().toISOString();
  const byName = new Map<string, HospitalRecord>();
  for (const hospital of Object.values(store.hospitals)) {
    byName.set(normalize(hospital.name), hospital);
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

  const counts = new Map<string, number>();
  for (const item of extra) {
    const name = normalize(String(item.value.hospital ?? ""));
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeNumber: true,
      nationalId: true,
      firstName: true,
      lastName: true,
      department: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } }
    },
    take: 10000
  });
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));

  const search = normalize(filters?.search);
  const isActive = filters?.isActive;
  const items = Array.from(byName.values())
    .map((hospital) => {
      const normalizedHospital = normalize(hospital.name);
      const hospitalEmployees = extra
        .filter((item) => normalize(String(item.value.hospital ?? "")) === normalizedHospital)
        .map((item) => employeeById.get(item.employeeId))
        .filter(Boolean) as typeof employees;
      const department = departments.find((item) => item.id === hospital.departmentId) ?? null;
      const branch = branches.find((item) => item.id === hospital.branchId) ?? null;
      const smartSearchText = [
        hospital.name,
        hospital.code,
        department?.name,
        department?.code,
        branch?.name,
        branch?.code,
        ...hospitalEmployees.flatMap((employee) => [employee.firstName, employee.lastName, `${employee.firstName} ${employee.lastName}`, employee.employeeNumber, employee.nationalId, employee.department?.name, employee.department?.code, employee.branch?.name, employee.branch?.code])
      ].filter(Boolean).join(" ").toLowerCase();
      return { ...hospital, employeeCount: counts.get(normalizedHospital) ?? 0, department, branch, smartSearchText };
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
