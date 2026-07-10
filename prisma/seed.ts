import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
import { ensureEnterpriseRbacSeed } from "../lib/enterprise/permissions";

const resources = [
  "dashboard", "employees", "departments", "branches", "positions", "employment-types", "nationalities", "documents", "contracts", "attendance", "leave", "payroll", "loans", "overtime", "allowances", "deductions", "performance", "recruitment", "candidates", "training", "assets", "announcements", "reports", "notifications", "audit-logs", "settings"
];

const permissionSeeds = resources.flatMap((resource) => [
  { action: "read", resource, description: "View " + resource },
  { action: "manage", resource, description: "Manage " + resource }
]);

const roleSeeds = [
  { name: "SUPER_ADMIN", description: "Full platform administration", isSystem: true },
  { name: "HR_MANAGER", description: "HR operations manager", isSystem: true },
  { name: "PAYROLL_MANAGER", description: "Payroll and compensation manager", isSystem: true },
  { name: "RECRUITER", description: "Recruitment and candidates manager", isSystem: true },
  { name: "EMPLOYEE", description: "Standard employee access", isSystem: true }
];

const rolePermissionKeys: Record<string, string[]> = {
  SUPER_ADMIN: permissionSeeds.map((permission) => permission.action + ":" + permission.resource),
  HR_MANAGER: permissionSeeds.filter((permission) => !["payroll", "settings"].includes(permission.resource)).map((permission) => permission.action + ":" + permission.resource),
  PAYROLL_MANAGER: ["read:dashboard", "read:employees", "read:payroll", "manage:payroll", "read:loans", "manage:loans", "read:allowances", "manage:allowances", "read:deductions", "manage:deductions", "read:overtime", "manage:overtime", "read:reports"],
  RECRUITER: ["read:dashboard", "read:recruitment", "manage:recruitment", "read:candidates", "manage:candidates"],
  EMPLOYEE: ["read:dashboard", "read:announcements", "read:notifications"]
};

const departments = [
  { name: "Human Resources", code: "HR", description: "People operations and compliance" },
  { name: "Finance", code: "FIN", description: "Payroll, accounting, and finance" },
  { name: "Operations", code: "OPS", description: "Daily business operations" }
];
const branches = [
  { name: "Head Office", code: "HQ", city: "Riyadh", country: "Saudi Arabia" },
  { name: "Remote", code: "REMOTE", city: "Remote", country: "Global" }
];
const employmentTypes = [
  { name: "Full Time", code: "FULL_TIME" },
  { name: "Part Time", code: "PART_TIME" },
  { name: "Contract", code: "CONTRACT" }
];
const nationalities = [
  { name: "Saudi", code: "SA" },
  { name: "United States", code: "US" },
  { name: "United Kingdom", code: "GB" }
];

const leaveTypes = [
  { name: "إجازة سنوية", code: "ANNUAL", description: "Annual leave - 30 days per year", annualLimit: 30, isPaid: true, isActive: true },
  { name: "إجازة مرضية", code: "SICK", description: "Sick leave - 15 days per year", annualLimit: 15, isPaid: true, isActive: true },
  { name: "إجازة طارئة", code: "EMERGENCY", description: "Emergency leave - 5 days per year", annualLimit: 5, isPaid: true, isActive: true }
];

type Delegate = { upsert(args: unknown): Promise<Record<string, unknown>>; findUnique(args: unknown): Promise<Record<string, unknown> | null>; createMany(args: unknown): Promise<unknown> };

async function main() {
  await ensureEnterpriseRbacSeed();
  const client = prisma as unknown as Record<string, Delegate>;
  const permissions = new Map<string, string>();
  for (const permission of permissionSeeds) {
    const record = await prisma.permission.upsert({ where: { action_resource: { action: permission.action, resource: permission.resource } }, update: { description: permission.description }, create: permission });
    permissions.set(record.action + ":" + record.resource, record.id);
  }
  const roles = new Map<string, string>();
  for (const role of roleSeeds) {
    const record = await prisma.role.upsert({ where: { name: role.name }, update: { description: role.description, isSystem: role.isSystem }, create: role });
    roles.set(record.name, record.id);
  }
  for (const [roleName, permissionKeys] of Object.entries(rolePermissionKeys)) {
    const roleId = roles.get(roleName);
    if (!roleId) continue;
    await prisma.rolePermission.createMany({ data: permissionKeys.map((permissionKey) => { const permissionId = permissions.get(permissionKey); return permissionId ? { roleId, permissionId } : null; }).filter((value): value is { roleId: string; permissionId: string } => Boolean(value)), skipDuplicates: true });
  }
  const adminUsername = "admin";
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@lana.local";
  const adminPassword = "Admin@123456";
  const adminRoleId = roles.get("SUPER_ADMIN");
  const adminPasswordHash = await hashPassword(adminPassword);
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ username: adminUsername }, { email: adminEmail }] }
  });
  const admin = existingAdmin
    ? await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          name: "System Administrator",
          username: adminUsername,
          email: adminEmail,
          emailVerified: new Date(),
          passwordHash: adminPasswordHash,
          isActive: true
        }
      })
    : await prisma.user.create({
        data: {
          name: "System Administrator",
          username: adminUsername,
          email: adminEmail,
          emailVerified: new Date(),
          passwordHash: adminPasswordHash,
          isActive: true
        }
      });
  if (adminRoleId) await prisma.userRole.createMany({ data: [{ userId: admin.id, roleId: adminRoleId }], skipDuplicates: true });
  for (const department of departments) await client.department.upsert({ where: { code: department.code }, update: department, create: department });
  for (const branch of branches) await client.branch.upsert({ where: { code: branch.code }, update: branch, create: branch });
  for (const employmentType of employmentTypes) await client.employmentType.upsert({ where: { code: employmentType.code }, update: employmentType, create: employmentType });
  for (const nationality of nationalities) await client.nationality.upsert({ where: { code: nationality.code }, update: nationality, create: nationality });
  for (const leaveType of leaveTypes) await (client as any).leaveType.upsert({ where: { code: leaveType.code }, update: leaveType, create: leaveType });
  const hrDepartment = await client.department.findUnique({ where: { code: "HR" } });
  const headOffice = await client.branch.findUnique({ where: { code: "HQ" } });
  const fullTime = await client.employmentType.findUnique({ where: { code: "FULL_TIME" } });
  const saudiNationality = await client.nationality.findUnique({ where: { code: "SA" } });
  const hrManagerPosition = await client.position.upsert({ where: { code: "HR-MGR" }, update: { title: "HR Manager", departmentId: hrDepartment?.id }, create: { title: "HR Manager", code: "HR-MGR", departmentId: hrDepartment?.id } });
  const employeeRoleId = roles.get("EMPLOYEE");
  const employeeNationalId = "1000000001";
  const employeePasswordHash = await hashPassword("Employee@123456");
  const employeeUser = await prisma.user.upsert({
    where: { email: "employee.1000000001@lana.local" },
    update: {
      name: "Lana Employee",
      passwordHash: employeePasswordHash,
      isActive: true
    },
    create: {
      name: "Lana Employee",
      email: "employee.1000000001@lana.local",
      emailVerified: new Date(),
      passwordHash: employeePasswordHash,
      isActive: true
    }
  });
  if (employeeRoleId) await prisma.userRole.createMany({ data: [{ userId: employeeUser.id, roleId: employeeRoleId }], skipDuplicates: true });
  await prisma.employee.upsert({
    where: { nationalId: employeeNationalId },
    update: {
      employeeNumber: "EMP-0001",
      firstName: "Lana",
      lastName: "Employee",
      phone: "+966500000001",
      status: "ACTIVE",
      userId: employeeUser.id,
      departmentId: typeof hrDepartment?.id === "string" ? hrDepartment.id : undefined,
      positionId: typeof hrManagerPosition?.id === "string" ? hrManagerPosition.id : undefined,
      branchId: typeof headOffice?.id === "string" ? headOffice.id : undefined,
      employmentTypeId: typeof fullTime?.id === "string" ? fullTime.id : undefined,
      nationalityId: typeof saudiNationality?.id === "string" ? saudiNationality.id : undefined
    },
    create: {
      employeeNumber: "EMP-0001",
      nationalId: employeeNationalId,
      firstName: "Lana",
      lastName: "Employee",
      phone: "+966500000001",
      hireDate: new Date("2026-01-01T00:00:00.000Z"),
      status: "ACTIVE",
      userId: employeeUser.id,
      departmentId: typeof hrDepartment?.id === "string" ? hrDepartment.id : undefined,
      positionId: typeof hrManagerPosition?.id === "string" ? hrManagerPosition.id : undefined,
      branchId: typeof headOffice?.id === "string" ? headOffice.id : undefined,
      employmentTypeId: typeof fullTime?.id === "string" ? fullTime.id : undefined,
      nationalityId: typeof saudiNationality?.id === "string" ? saudiNationality.id : undefined
    }
  });
  await client.reportDefinition.upsert({ where: { code: "HEADCOUNT" }, update: { name: "Headcount", module: "employees" }, create: { name: "Headcount", code: "HEADCOUNT", module: "employees", description: "Employee headcount by status and organization" } });
  await client.appSetting.upsert({ where: { key: "company.name" }, update: { value: "Lana HRMS" }, create: { key: "company.name", value: "Lana HRMS", description: "Company display name" } });
  await client.appSetting.upsert({ where: { key: "company.logo" }, update: { value: { url: "/brand/lana-logo.png" } }, create: { key: "company.logo", value: { url: "/brand/lana-logo.png" }, description: "Company logo URL" } });
  await client.announcement.upsert({ where: { id: "seed-announcement-welcome" }, update: { title: "Welcome to HRMS", body: "The HRMS platform is ready for your team.", isPublished: true, publishedAt: new Date() }, create: { id: "seed-announcement-welcome", title: "Welcome to HRMS", body: "The HRMS platform is ready for your team.", isPublished: true, publishedAt: new Date() } });
  console.info("Seeded Lana HRMS data. Admin username: admin. Employee national ID: " + employeeNationalId);
}

main().catch((error) => { console.error(error); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
