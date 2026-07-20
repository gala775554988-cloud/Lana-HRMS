import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { isEnterpriseResourceAllowed } from "@/lib/enterprise/resource-access";
import { getSocialInsuranceRecord, upsertSocialInsuranceRecord, type SocialInsuranceUpdateInput } from "@/lib/enterprise/social-insurance";
import type { SocialInsuranceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

function can(permissions: string[], roles: string[], action: string) {
  return roles.includes("SUPER_ADMIN") || roles.includes("HR_MANAGER") || hasPermission(permissions, { action, resource: "social-insurance" }, roles);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];
  if (!can(permissions, roles, "read") || !isEnterpriseResourceAllowed(roles, "social-insurance")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const { employeeId } = await params;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, employeeNumber: true, firstName: true, lastName: true, status: true }
  });
  if (!employee) return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });

  const record = await getSocialInsuranceRecord(employeeId);
  const documents = await prisma.employeeDocument.findMany({
    where: { employeeId, type: "SOCIAL_INSURANCE" },
    orderBy: { uploadedAt: "desc" }
  });

  return NextResponse.json({ success: true, employee, record, documents });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const roles = (session.user.roles as string[] | undefined) ?? [];
  const permissions = (session.user.permissions as string[] | undefined) ?? [];

  const { employeeId } = await params;
  const existing = await prisma.socialInsuranceRecord.findUnique({ where: { employeeId }, select: { id: true, status: true } });
  const requiredAction = existing ? "edit" : "create";
  if (!can(permissions, roles, requiredAction) || !isEnterpriseResourceAllowed(roles, "social-insurance")) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ success: false, message: "Invalid request body" }, { status: 400 });

  const validStatuses: SocialInsuranceStatus[] = ["NOT_REGISTERED", "ACTIVE", "SUSPENDED", "EXCLUDED"];
  const status = typeof body.status === "string" && validStatuses.includes(body.status as SocialInsuranceStatus) ? (body.status as SocialInsuranceStatus) : undefined;

  const input: SocialInsuranceUpdateInput = {
    status,
    subscriberNumber: body.subscriberNumber === undefined ? undefined : (body.subscriberNumber as string | null),
    registrationDate: body.registrationDate === undefined ? undefined : body.registrationDate ? new Date(body.registrationDate as string) : null,
    exclusionDate: body.exclusionDate === undefined ? undefined : body.exclusionDate ? new Date(body.exclusionDate as string) : null,
    exclusionReason: body.exclusionReason === undefined ? undefined : (body.exclusionReason as string | null),
    subjectWage: body.subjectWage === undefined ? undefined : Number(body.subjectWage),
    currency: typeof body.currency === "string" ? body.currency : undefined,
    employeeContributionRate: body.employeeContributionRate === undefined ? undefined : Number(body.employeeContributionRate),
    employerContributionRate: body.employerContributionRate === undefined ? undefined : Number(body.employerContributionRate),
    notes: body.notes === undefined ? undefined : (body.notes as string | null)
  };

  if (input.subjectWage !== undefined && (Number.isNaN(input.subjectWage) || input.subjectWage < 0)) {
    return NextResponse.json({ success: false, message: "الأجر الخاضع للاشتراك غير صالح" }, { status: 400 });
  }
  if (input.status === "EXCLUDED" && !input.exclusionReason && existing?.status !== "EXCLUDED") {
    return NextResponse.json({ success: false, message: "سبب الاستبعاد مطلوب" }, { status: 400 });
  }

  const record = await upsertSocialInsuranceRecord({ employeeId, actorUserId: session.user.id, input });
  return NextResponse.json({ success: true, record });
}
