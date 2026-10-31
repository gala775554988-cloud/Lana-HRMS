import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getHrmsModule, type HrmsModule } from "@/config/hrms";
import { getModuleRecord } from "@/lib/hrms/actions";
import { getRequestDictionary } from "@/lib/i18n-server";
import { getEmployeeFieldAccess } from "@/lib/enterprise/employee-field-access";
import { getEmployeeSalaryProfile } from "@/lib/employee/salary-profile-store";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { ModuleForm } from "@/components/hrms/module-form";

export const dynamic = "force-dynamic";

export default async function EmployeeEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!hasPermission(session.user.permissions, { action: "edit", resource: "employees" }, session.user.roles)) redirect("/employees");
  const { id } = await params;
  const record = await getModuleRecord("employees", id);
  if (!record) notFound();
  const { dictionary, locale } = await getRequestDictionary();
  const access = await getEmployeeFieldAccess(session.user.id, session.user.roles);
  const [departments, branches, positions, types, nationalities, hospitals, companies, projects, manager, salary] = await Promise.all([
    prisma.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.employmentType.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.nationality.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.hospital.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    record.managerId ? prisma.employee.findUnique({ where: { id: String(record.managerId) }, select: { firstName: true, lastName: true } }) : null,
    getEmployeeSalaryProfile(id),
  ]);
  const choices: Record<string, { value: string; label: string }[]> = Object.fromEntries(Object.entries({ departmentId: departments, branchId: branches, positionId: positions.map(p => ({ id: p.id, name: p.title })), employmentTypeId: types, nationalityId: nationalities, hospitalId: hospitals, companyId: companies, projectId: projects }).map(([key, rows]) => [key, rows.map(row => ({ value: row.id, label: row.name }))]));
  choices.status = [{ value: "ACTIVE", label: "على رأس العمل" }, { value: "ON_LEAVE", label: "في إجازة" }, { value: "INACTIVE", label: "غير نشط" }, { value: "TERMINATED", label: "منتهية الخدمة" }];
  choices.gender = [{ value: "male", label: "ذكر" }, { value: "female", label: "أنثى" }, { value: "other", label: "غير محدد" }, ...["Male", "Female", "Not specified"].filter(value => record.gender === value).map(value => ({ value, label: value === "Male" ? "ذكر" : value === "Female" ? "أنثى" : "غير محدد" }))];
  choices.maritalStatus = [{ value: "single", label: "أعزب" }, { value: "married", label: "متزوج" }, { value: "divorced", label: "مطلق" }, { value: "widower", label: "أرمل" }, { value: "cohabitant", label: "شريك" }, ...["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"].filter(value => record.maritalStatus === value).map(value => ({ value, label: ({ SINGLE: "أعزب", MARRIED: "متزوج", DIVORCED: "مطلق", WIDOWED: "أرمل" } as Record<string, string>)[value] }))];
  const base = getHrmsModule("employees")!;
  const resource: HrmsModule = { ...base, fields: base.fields.filter(field => !(field.name in access) || access[field.name as keyof typeof access] === "EDIT").map(field => ({ ...field, ...(choices[field.name] ? { optionItems: choices[field.name] } : {}) })) };
  const initialValues: Record<string, unknown> = Object.fromEntries(resource.fields.map(field => [field.name, field.type === "date" && record[field.name] ? String(record[field.name]).slice(0, 10) : record[field.name] ?? ""]));
  return <section className="mx-auto max-w-4xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">تعديل ملف الموظف</h1><p className="text-sm text-muted-foreground">عدّل البيانات ثم اضغط حفظ التعديلات. تغيير المدير للموظف المرتبط بأودو يُحفظ في النظامين.</p></div><Link href={`/employees/${id}`} className="text-sm text-primary">عرض الملف</Link></div>
    <div className="rounded-2xl border bg-card p-4 sm:p-6"><ModuleForm resource={resource} dictionary={dictionary} locale={locale} recordId={id} initialValues={{ ...initialValues, ...salary, managerLabel: manager ? `${manager.firstName} ${manager.lastName}` : "" }} /></div>
  </section>;
}
