import { z } from "zod";
import type { prisma } from "@/lib/prisma";
type RequestTransaction = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export class RequestLifecycleError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export function requireOwner(owner: string | null | undefined, actor: string) {
  if (owner !== actor) throw new RequestLifecycleError("الطلب غير متاح", 404);
}
export function requireAction(status: string, action: string) {
  const allowed: Record<string, string[]> = { EDIT: ["PENDING"], RESUBMIT: ["RETURNED"], CANCEL: ["PENDING", "RETURNED"], REVOKE: ["COMPLETED"] };
  if (!allowed[action]?.includes(status)) throw new RequestLifecycleError("هذا الإجراء غير متاح لحالة الطلب الحالية");
}
const text = z.string().trim().max(4000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "تاريخ غير صالح").transform(value => new Date(value));
const schemas = {
  LEAVE: z.object({ startDate: date, endDate: date, reason: text }).strict(),
  EXPENSE: z.object({ amount: z.coerce.number().positive().max(1e8), category: text.min(1), description: text }).strict(),
  LOAN: z.object({ principalAmount: z.coerce.number().positive().max(1e8), notes: text }).strict(),
  OVERTIME: z.object({ workDate: date, hours: z.coerce.number().positive().max(24), reason: text }).strict(),
  RESUMPTION: z.object({ returnDate: date, reason: text, notes: text }).strict(),
  LETTER: z.object({ purpose: text.min(1) }).strict(),
};
export function parseRequestEdit(type: string, input: unknown) {
  const result = (schemas[type as keyof typeof schemas] ?? schemas.LETTER).safeParse(input);
  if (!result.success) throw new RequestLifecycleError("تحقق من حقول الطلب والتواريخ والمبالغ", 400);
  const data = result.data;
  if ("startDate" in data && "endDate" in data) {
    if (data.endDate < data.startDate) throw new RequestLifecycleError("تاريخ النهاية يسبق البداية", 400);
    return { ...data, days: Math.floor((data.endDate.getTime() - data.startDate.getTime()) / 86400000) + 1 };
  }
  if ("principalAmount" in data) return { ...data, outstandingAmount: data.principalAmount, installmentAmount: Math.round(data.principalAmount / 12) };
  return data;
}
export function entityDelegate(tx: RequestTransaction, type: string) {
  // All these models share id/employeeId/status. Keep dispatch explicit.
  const model = type === "LEAVE" ? tx.leaveRequest : type === "EXPENSE" ? tx.expenseRequest : type === "LOAN" ? tx.loan : type === "OVERTIME" ? tx.overtimeRequest : type === "RESUMPTION" ? tx.resumptionRequest : tx.letterRequest;
  return model as unknown as {
    findUnique(args: { where: { id: string } }): Promise<{ id: string; employeeId: string; status: string; includedInPayrollAt?: Date | null } | null>;
    updateMany(args: { where: { id: string; status: string }; data: object }): Promise<{ count: number }>;
  };
}
export async function cancelEntity(tx: RequestTransaction, workflow: { id: string; type: string; entityId: string; employeeId: string }, approved = false) {
  const model = entityDelegate(tx, workflow.type);
  const entity = await model.findUnique({ where: { id: workflow.entityId } });
  if (!entity || entity.employeeId !== workflow.employeeId) throw new RequestLifecycleError("الطلب غير متاح", 404);
  if (entity.includedInPayrollAt) throw new RequestLifecycleError("أُدرج الطلب في الرواتب؛ يلزم إجراء تصحيح مالي");
  if (approved && workflow.type === "LOAN") throw new RequestLifecycleError("القرض المعتمد يتطلب تسوية مالية من الموارد البشرية");
  const expected = approved ? "APPROVED" : "PENDING";
  if (entity.status !== expected) throw new RequestLifecycleError("تغيرت حالة الطلب؛ حدّث الصفحة");
  if ((await model.updateMany({ where: { id: entity.id, status: expected }, data: { status: "CANCELLED" } })).count !== 1) throw new RequestLifecycleError("تغيرت حالة الطلب");
  if (approved && workflow.type === "LEAVE") {
    const leave = await tx.leaveRequest.findUniqueOrThrow({ where: { id: entity.id }, include: { leaveType: true } });
    if (leave.leaveType.code.toUpperCase().startsWith("ANNUAL")) await tx.employeeLeaveBalance.updateMany({ where: { employeeId: workflow.employeeId }, data: { used: { decrement: Number(leave.days) } } });
  }
}
