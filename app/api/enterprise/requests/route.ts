import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyScopedWhere, getAccessProfile } from "@/lib/enterprise/hierarchy";

const DEFAULT_TYPES = ["LEAVE", "LOAN", "RESIDENCY", "DELEGATION", "CUSTODY", "DOCUMENT", "EXPENSE", "LETTER", "OVERTIME"];

function parseDeferredUntil(comments: string | null) {
  if (!comments) return null;
  try {
    const value = JSON.parse(comments) as { deferredUntil?: string };
    return value.deferredUntil ? new Date(value.deferredUntil) : null;
  } catch {
    return null;
  }
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
  if (!current?.comments) return "Normal";
  try {
    return JSON.parse(current.comments)?.priority ?? "Normal";
  } catch {
    return "Normal";
  }
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
  const sort = searchParams.get("sort") ?? "newest";
  const search = searchParams.get("search") ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 30), 10), 200);

  const profile = await getAccessProfile(session.user.id, (session.user.roles as string[]) ?? []);
  const employeeWhere = await applyScopedWhere("employees", {}, profile);

  const where: any = { employee: employeeWhere };
  if (type !== "ALL") where.type = type;
  if (scope === "mine") where.employee = { userId: session.user.id };
  if (scope === "waiting") where.steps = { some: { approverUserId: session.user.id, status: "PENDING" } };
  if (scope === "transferred") where.steps = { some: { comments: { contains: "transferred", mode: "insensitive" } } };
  if (scope === "deferred") where.steps = { some: { status: "DEFERRED" } };
  if (scope === "completed") where.status = { in: ["COMPLETED", "APPROVED"] };
  if (scope === "rejected") where.status = "REJECTED";

  const [allScoped, raw, approvers] = await Promise.all([
    prisma.workflowInstance.findMany({
      where: { employee: employeeWhere },
      include: { steps: true, employee: { select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, department: { select: { name: true } }, branch: { select: { name: true } }, position: { select: { title: true } } } } },
      take: 5000
    }),
    prisma.workflowInstance.findMany({
      where,
      include: {
        employee: { select: { id: true, employeeNumber: true, nationalId: true, firstName: true, lastName: true, department: { select: { name: true } }, branch: { select: { name: true } }, position: { select: { title: true } } } },
        steps: { orderBy: { step: "asc" } }
      },
      take: 5000
    }),
    getAssignableApprovers()
  ]);

  const searched = sortRequests(raw.filter((workflow) => requestMatchesSearch(workflow, search)), sort);
  const approverIds = Array.from(new Set(searched.flatMap((workflow) => workflow.steps.map((step: any) => step.approverUserId)).filter((id): id is string => Boolean(id))));
  const approverUsers = approverIds.length ? await prisma.user.findMany({ where: { id: { in: approverIds } }, select: { id: true, name: true, email: true } }) : [];
  const approverUserMap = new Map(approverUsers.map((user) => [user.id, { name: user.name, email: user.email }]));
  const total = searched.length;
  const requests = searched.slice((page - 1) * pageSize, page * pageSize).map((workflow) => ({
    id: workflow.id,
    type: workflow.type,
    entityId: workflow.entityId,
    status: workflow.status,
    currentStep: workflow.currentStep,
    createdAt: workflow.createdAt,
    updatedAt: workflow.updatedAt,
    employee: workflow.employee,
    steps: workflow.steps,
    priority: priorityOf(workflow),
    currentApprover: currentApprover(workflow, approverUserMap)
  }));

  const types = Array.from(new Set([...DEFAULT_TYPES, ...allScoped.map((workflow) => workflow.type)])).sort();
  const stats = {
    total: allScoped.length,
    waiting: allScoped.filter((workflow) => workflow.steps.some((step) => step.approverUserId === session.user.id && step.status === "PENDING")).length,
    highPriority: allScoped.filter((workflow) => priorityOf(workflow).toLowerCase() === "high").length,
    deferred: allScoped.filter((workflow) => workflow.steps.some((step) => step.status === "DEFERRED")).length,
    completed: allScoped.filter((workflow) => ["COMPLETED", "APPROVED"].includes(workflow.status)).length,
    rejected: allScoped.filter((workflow) => workflow.status === "REJECTED").length
  };

  return NextResponse.json({ success: true, requests, types, stats, approvers, page, pageSize, total, pageCount: Math.max(Math.ceil(total / pageSize), 1) });
}
