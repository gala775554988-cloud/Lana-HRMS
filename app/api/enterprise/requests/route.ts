import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { canManageApprovalRouting } from "@/config/request-routing";
import { prisma } from "@/lib/prisma";
import { applyScopedWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";
import { parseWorkflowStepMetadata } from "@/lib/enterprise/workflow-step-metadata";

const DEFAULT_TYPES = ["LEAVE", "RESUMPTION", "LOAN", "RESIDENCY", "DELEGATION", "CUSTODY", "DOCUMENT", "EXPENSE", "LETTER", "OVERTIME"];

function parseDeferredUntil(comments: string | null) {
  const value = parseWorkflowStepMetadata(comments).deferredUntil;
  return value ? new Date(value) : null;
}

async function reactivateDueDeferredSteps() {
  const steps = await prisma.workflowStep.findMany({ where: { status: "DEFERRED" }, take: 100 });
  const due = steps.filter((step) => {
    const deferredUntil = parseDeferredUntil(step.comments);
    return deferredUntil && deferredUntil.getTime() <= Date.now();
  });
  if (due.length) await prisma.workflowStep.updateMany({ where: { id: { in: due.map((step) => step.id) } }, data: { status: "PENDING" } });
}

function priorityOf(workflow: any) {
  const current = workflow.steps?.find((step: any) => step.step === workflow.currentStep);
  return parseWorkflowStepMetadata(current?.comments).priority ?? "Normal";
}

function currentApprover(workflow: any, userMap: Map<string, { name: string | null; email: string | null }>) {
  const current = workflow.steps?.find((step: any) => step.step === workflow.currentStep);
  const approver = current?.approverUserId ? userMap.get(current.approverUserId) : null;
  return approver?.name ?? approver?.email ?? current?.approverUserId ?? "-";
}

function requestMatchesSearch(workflow: any, search: string) {
  if (!search) return true;
  const value = search.toLowerCase();
  const haystack = [
    workflow.type,
    workflow.employee?.firstName,
    workflow.employee?.lastName,
    workflow.employee?.employeeNumber,
    workflow.employee?.nationalId,
    workflow.employee?.department?.name,
    workflow.employee?.branch?.name,
    workflow.employee?.position?.title
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(value);
}

function sortRequests(items: any[], sort: string) {
  const copy = [...items];
  const byString = (getter: (item: any) => string | undefined | null) => copy.sort((a, b) => String(getter(a) ?? "").localeCompare(String(getter(b) ?? ""), "ar"));
  if (sort === "oldest") return copy.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (sort === "priority") return byString(priorityOf);
  if (sort === "date" || sort === "sentAt") return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (sort === "department") return byString((item) => item.employee?.department?.name);
  if (sort === "branch") return byString((item) => item.employee?.branch?.name);
  if (sort === "project") return byString((item) => item.employee?.position?.title);
  if (sort === "type") return byString((item) => item.type);
  return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function getAssignableApprovers() {
  const employees = await prisma.employee.findMany({
    where: { userId: { not: null } },
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      userId: true,
      position: { select: { title: true } },
      user: { select: { roles: { include: { role: true } } } }
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 500
  });
  return employees.filter((employee) => {
    const title = employee.position?.title ?? "";
    const roles = employee.user?.roles.map((role) => role.role.name).join(" ") ?? "";
    return /(مشرف|مدير|Supervisor|Manager|HR|SUPER_ADMIN|HR_MANAGER|BRANCH_MANAGER|DEPARTMENT_MANAGER|PROJECT_MANAGER)/i.test(`${title} ${roles}`);
  }).map((employee) => ({
    userId: employee.userId,
    label: `${employee.employeeNumber} - ${employee.firstName} ${employee.lastName}`,
    position: employee.position?.title ?? ""
  }));
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  await reactivateDueDeferredSteps().catch(() => null);

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") ?? "ALL";
  const scope = searchParams.get("scope") ?? "all";
  const report = searchParams.get("report") === "1";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const validDate = (value: string | null) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)));
  if (!validDate(from) || !validDate(to) || (from && to && from > to)) return NextResponse.json({ success: false, message: "تحقق من فترة الكشف" }, { status: 400 });
  const sort = searchParams.get("sort") ?? "newest";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 30), 10), 200);

  const profile = await getAccessProfile(session.user.id, (session.user.roles as string[]) ?? []);
  const employeeWhere = await applyScopedWhere("employees", {}, profile);

  const visibility = { OR: [{ employee: employeeWhere }, { steps: { some: { approverUserId: session.user.id } } }] };
  const baseWhere: any = { ...visibility };
  if (type !== "ALL") baseWhere.type = type;
  if (from || to) baseWhere.createdAt = { ...(from ? { gte: new Date(`${from}T00:00:00+03:00`) } : {}), ...(to ? { lt: new Date(new Date(`${to}T00:00:00+03:00`).getTime() + 86400000) } : {}) };
  // Load in bounded batches without silently truncating historical reports.
  const allScoped: any[] = [];
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.workflowInstance.findMany({
      where: baseWhere,
      include: { steps: { orderBy: { step: "asc" } }, employee: { select: { id: true, userId: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, department: { select: { name: true } }, branch: { select: { name: true } }, position: { select: { title: true } } } } },
      orderBy: { id: "asc" }, take: 1000, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
    });
    allScoped.push(...batch);
    if (batch.length < 1000) break;
    cursor = batch[batch.length - 1].id;
  }
  const leaveIds = allScoped.filter((row) => row.type === "LEAVE").map((row) => row.entityId);
  const leaves: any[] = [];
  for (let offset = 0; offset < leaveIds.length; offset += 1000) {
    leaves.push(...await prisma.leaveRequest.findMany({ where: { id: { in: leaveIds.slice(offset, offset + 1000) } }, select: { id: true, status: true, startDate: true, endDate: true, days: true, reason: true, decisionNote: true, leaveType: { select: { name: true } } } }));
  }
  const leaveMap = new Map(leaves.map((row) => [row.id, row]));
  for (const row of allScoped) {
    row.leave = row.type === "LEAVE" ? leaveMap.get(row.entityId) ?? null : null;
    // A manager's intermediate approval is not a final leave approval.
    if (row.leave && row.status !== "SUPERSEDED") row.status = row.leave.status === "APPROVED" ? "COMPLETED" : row.leave.status === "PENDING" && row.status === "RETURNED" ? "RETURNED" : row.leave.status;
  }
  const scoped = allScoped.filter((row) => requestMatchesSearch(row, search));
  const raw = scoped.filter((row) => {
    if (scope === "mine") return row.employee?.userId === session.user.id;
    if (scope === "waiting") return row.status === "PENDING" && row.steps.some((step: any) => step.approverUserId === session.user.id && step.status === "PENDING");
    if (scope === "pending") return row.status === "PENDING";
    if (scope === "transferred") return row.steps.some((step: any) => step.comments?.toLowerCase().includes("transferred"));
    if (scope === "deferred") return row.steps.some((step: any) => step.status === "DEFERRED");
    if (scope === "completed") return ["COMPLETED", "APPROVED"].includes(row.status);
    if (scope === "rejected") return row.status === "REJECTED";
    if (scope === "cancelled") return row.status === "CANCELLED";
    if (scope === "returned") return row.status === "RETURNED";
    if (scope === "decided") return ["COMPLETED", "APPROVED", "REJECTED"].includes(row.status);
    return true;
  });
  const approvers = report ? [] : await getAssignableApprovers();
  const searched = sortRequests(raw, sort);
  const approverIds = Array.from(new Set(searched.flatMap((workflow) => workflow.steps.map((step: any) => step.approverUserId)).filter((id): id is string => Boolean(id))));
  const approverUsers = approverIds.length ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true, email: true, employeeProfile: { select: { firstName: true, lastName: true } } } }) : [];
  const approverUserMap = new Map(approverUsers.map((user) => [user.id, { name: user.employeeProfile ? `${user.employeeProfile.firstName} ${user.employeeProfile.lastName}` : user.name, email: user.email }]));
  const total = searched.length;
  const elevated = canManageApprovalRouting(profile.roles, session.user.permissions);
  const requests = (report ? searched : searched.slice((page - 1) * pageSize, page * pageSize)).map((workflow) => ({
    id: workflow.id,
    type: workflow.type,
    entityId: workflow.entityId,
    status: workflow.status,
    currentStep: workflow.currentStep,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    employee: workflow.employee ? {
      id: workflow.employee.id,
      employeeNumber: workflow.employee.employeeNumber,
      firstName: workflow.employee.firstName,
      lastName: workflow.employee.lastName,
      department: workflow.employee.department,
      branch: workflow.employee.branch,
      position: workflow.employee.position
    } : null,
    leave: workflow.leave,
    steps: workflow.steps,
    priority: priorityOf(workflow),
    currentApprover: currentApprover(workflow, approverUserMap),
    canTransfer: elevated && workflow.status === "PENDING",
    canAct: workflow.status === "PENDING" && workflow.steps.some((step: any) =>
      step.step === workflow.currentStep && ["PENDING", "DEFERRED"].includes(step.status) && step.approverUserId === session.user.id
    )
  }));

  const types = Array.from(new Set([...DEFAULT_TYPES, ...allScoped.map((workflow) => workflow.type)])).sort();
  const stats = {
    total: scoped.length,
    pending: scoped.filter((workflow) => workflow.status === "PENDING").length,
    cancelled: scoped.filter((workflow) => workflow.status === "CANCELLED").length,
    returned: scoped.filter((workflow) => workflow.status === "RETURNED").length,
    waiting: scoped.filter((workflow) => workflow.steps.some((step: any) => step.approverUserId === session.user.id && step.status === "PENDING")).length,
    highPriority: scoped.filter((workflow) => priorityOf(workflow).toLowerCase() === "high").length,
    deferred: scoped.filter((workflow) => workflow.steps.some((step: any) => step.status === "DEFERRED")).length,
    completed: scoped.filter((workflow) => ["COMPLETED", "APPROVED"].includes(workflow.status)).length,
    rejected: scoped.filter((workflow) => workflow.status === "REJECTED").length
  };

  return NextResponse.json({ success: true, requests, types, stats, approvers, page, pageSize, total, pageCount: Math.max(Math.ceil(total / pageSize), 1) });
}
