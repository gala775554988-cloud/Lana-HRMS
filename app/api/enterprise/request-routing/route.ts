import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageApprovalRouting, stagesForRule, type RoutingRule } from "@/config/request-routing";
import { getRoutingSettings, ROUTING_SETTING_KEY, routingRuleSchema, routingSettingsSchema } from "@/lib/enterprise/request-routing-policy";
import { resolveApprovalChain } from "@/lib/enterprise/approval-engine";

async function authorize() {
  const session = await auth();
  if (!session?.user?.id) return { error: NextResponse.json({ success: false, message: "سجّل الدخول أولاً." }, { status: 401 }) };
  if (!canManageApprovalRouting(session.user.roles, session.user.permissions)) return { error: NextResponse.json({ success: false, message: "إدارة المسارات تتطلب صلاحية إدارة الإعدادات أو الموارد البشرية." }, { status: 403 }) };
  return { session };
}
async function validateTargets(rules: RoutingRule[]) {
  const ids = [...new Set(rules.flatMap(rule => [...(stagesForRule(rule).some(stage => stage.kind === "HR") ? [rule.hrEmployeeId] : []), ...stagesForRule(rule).filter(stage => stage.kind === "EMPLOYEE").map(stage => stage.employeeId)].filter((id): id is string => Boolean(id))))];
  if (ids.length) {
    const count = await prisma.employee.count({ where: { id: { in: ids }, status: { notIn: ["INACTIVE", "TERMINATED"] }, user: { is: { isActive: true } } } });
    if (count !== ids.length) throw new Error("أحد المعتمدين غير نشط أو غير مرتبط بحساب. اختر معتمداً نشطاً.");
  }
  const companies = [...new Set(rules.map(rule => rule.companyId).filter((id): id is string => Boolean(id)))];
  if (companies.length && await prisma.company.count({ where: { id: { in: companies }, isActive: true } }) !== companies.length) throw new Error("الشركة المحددة غير صالحة.");
}
export async function GET() {
  const { error } = await authorize(); if (error) return error;
  try {
    const settings = await getRoutingSettings();
    const ids = [...new Set(settings.rules.flatMap(rule => [rule.hrEmployeeId, ...rule.stages.map(stage => stage.employeeId)].filter((id): id is string => Boolean(id))))];
    const [employees, companies] = await Promise.all([
      ids.length ? prisma.employee.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true, employeeNumber: true } }) : [],
      prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ success: true, ...settings, companies, labels: Object.fromEntries(employees.map(employee => [employee.id, `${employee.firstName} ${employee.lastName} (${employee.employeeNumber})`])) });
  } catch { return NextResponse.json({ success: false, message: "تعذر قراءة إعداد المسارات." }, { status: 503 }); }
}
export async function PUT(request: Request) {
  const { session, error } = await authorize(); if (error) return error;
  try {
    const body = routingSettingsSchema.parse(await request.json());
    await validateTargets(body.rules);
    const saved = await prisma.$transaction(async tx => {
      if (body.version) {
        const updated = await tx.appSetting.updateMany({ where: { key: ROUTING_SETTING_KEY, updatedAt: new Date(body.version) }, data: { value: { version: 1, rules: body.rules } } });
        if (updated.count !== 1) throw new Error("VERSION_CONFLICT");
      } else {
        await tx.appSetting.create({ data: { key: ROUTING_SETTING_KEY, value: { version: 1, rules: body.rules }, description: "Company request approval routing" } });
      }
      await tx.auditLog.create({ data: { actorUserId: session!.user.id, action: "approval-routing:update", entity: "appSetting", entityId: ROUTING_SETTING_KEY, metadata: { rules: body.rules, appliesTo: "NEW_REQUESTS" } } });
      return tx.appSetting.findUniqueOrThrow({ where: { key: ROUTING_SETTING_KEY }, select: { updatedAt: true } });
    });
    return NextResponse.json({ success: true, version: saved.updatedAt.toISOString(), message: "حُفظت المسارات. تسري على الطلبات الجديدة دون تغيير قرارات الطلبات السابقة." });
  } catch (error) {
    const conflict = (error as { code?: string }).code === "P2002" || (error as Error).message === "VERSION_CONFLICT";
    const message = conflict ? "تغيّر الإعداد من مستخدم آخر. حدّث الصفحة ثم أعد الحفظ." : (error as { issues?: { message: string }[] }).issues?.[0]?.message || (error as Error).message;
    return NextResponse.json({ success: false, message }, { status: conflict ? 409 : 400 });
  }
}
export async function POST(request: Request) {
  const { error } = await authorize(); if (error) return error;
  try {
    const body = await request.json();
    const rule = routingRuleSchema.parse(body.rule);
    if (typeof body.employeeId !== "string") throw new Error("اختر موظفاً لمعاينة المسار.");
    await validateTargets([rule]);
    const employee = await prisma.employee.findUnique({ where: { id: body.employeeId }, select: { companyId: true } });
    if (!employee) throw new Error("الموظف غير موجود.");
    const effectiveCompanyId = employee.companyId ?? (rule.companyId ? (await prisma.company.findUnique({ where: { code: "MAIN" }, select: { id: true } }))?.id : null);
    if (rule.companyId && effectiveCompanyId !== rule.companyId) throw new Error("اختر موظفاً من الشركة المحددة للمعاينة.");
    const approvers = await resolveApprovalChain(body.employeeId, rule.requestType, rule);
    const users = await prisma.user.findMany({ where: { id: { in: approvers.map(item => item.userId) } }, select: { id: true, name: true, employeeProfile: { select: { firstName: true, lastName: true, employeeNumber: true } } } });
    const names = new Map(users.map(user => [user.id, user.employeeProfile ? `${user.employeeProfile.firstName} ${user.employeeProfile.lastName} (${user.employeeProfile.employeeNumber})` : user.name]));
    return NextResponse.json({ success: true, stages: approvers.map((stage, index) => ({ order: index + 1, name: stage.stageName || "اعتماد", approver: names.get(stage.userId) || "المعتمد", mandatory: stage.isMandatory })), slaHours: rule.slaHours });
  } catch (error) { return NextResponse.json({ success: false, message: (error as { issues?: { message: string }[] }).issues?.[0]?.message || (error as Error).message }, { status: 422 }); }
}
