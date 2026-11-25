import { usesOdooRouting } from "@/lib/integrations/odoo/requests/routing";
import { enqueueWorkflowRequest, dispatchWorkflowRequest, assertLocalWorkflow } from "@/lib/integrations/odoo/requests/service";
import { getLink } from "@/lib/integrations/odoo/requests/store";
import { cancelEntity, entityDelegate } from "@/lib/self-service/lifecycle";
import { prisma } from "@/lib/prisma";
import { postApprovedEffectInTransaction } from "@/lib/enterprise/employee-financial-ledger";
import type { ResolvedApprover } from "./approval-engine";
import { ApprovalRoutingError } from "./request-routing-policy";
import { mergeWorkflowStepMetadata } from "./workflow-step-metadata";
import { resolveApprovalChain } from "@/lib/enterprise/hierarchy";
import { createEnterpriseNotification, notifyUsers } from "@/lib/enterprise/notifications";

type WorkflowTransaction = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export async function persistEnterpriseWorkflow(tx: WorkflowTransaction, employeeId: string, type: string, entityId: string, approvers: ResolvedApprover[]) {
  const firstMandatoryIndex = approvers.findIndex(approver => approver.isMandatory);
  if (firstMandatoryIndex < 0 && !await usesOdooRouting(type, tx)) throw new ApprovalRoutingError("لا يوجد معتمد إلزامي صالح لهذا الطلب.");
  const instance = await tx.workflowInstance.create({ data: { employeeId, type, entityId, status: "PENDING", currentStep: firstMandatoryIndex + 1 } });
  if (approvers.length) await tx.workflowStep.createMany({ data: approvers.map((approver, index) => ({
    workflowInstanceId: instance.id, step: index + 1, approverUserId: approver.userId,
    status: !approver.isMandatory ? "NOTIFIED" : index === firstMandatoryIndex ? "PENDING" : "WAITING",
    capabilities: approver.capabilities,
    comments: mergeWorkflowStepMetadata(null, { stageName: approver.stageName || undefined, slaHours: approver.slaHours ?? 48, ...(!approver.isMandatory ? { note: "مرحلة اطلاع لا تتطلب اعتماداً" } : {}) }),
  })) });
  const requester = await tx.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  await tx.auditLog.create({ data: { actorUserId: requester?.userId, action: "workflow:submit", entity: "workflowInstance", entityId: instance.id, metadata: { type, employeeId, entityId, approverCount: approvers.length, autoApproved: false } } });
  await enqueueWorkflowRequest(tx, instance);
  return instance;
}
export async function notifyWorkflowSubmission(instance: { id: string; employeeId: string; type: string }, approvers: ResolvedApprover[]) {
  await dispatchWorkflowRequest(instance.id).catch(() => undefined);
  const external = await getLink(`wf-${instance.id}`);
  if (external) {
    const employee = await prisma.employee.findUnique({ where: { id: instance.employeeId }, select: { userId: true } });
    if (employee?.userId) await createEnterpriseNotification({ userId: employee.userId, title: "متابعة طلب أودو", body: `مرجع لانا: ${external.link.reference}. ${external.link.syncState === 'SYNCED' ? 'وصل الطلب إلى أودو وتحققت حالته.' : 'حُفظ الطلب وتحتاج مزامنته متابعة من الموارد البشرية.'}`, type: "INFO", link: "/employee/requests?tab=odoo" }).catch(() => null);
    return;
  }
  const first = approvers.find(approver => approver.isMandatory);
  if (first) await notifyUsers([first.userId], "وصول طلب جديد", `طلب ${instance.type} بانتظار مراجعتك.`, "INFO", `/approvals?tab=inbox&highlight=${instance.id}`).catch(() => null);
  const employee = await prisma.employee.findUnique({ where: { id: instance.employeeId }, select: { userId: true } }).catch(() => null);
  if (employee?.userId) await createEnterpriseNotification({ userId: employee.userId, title: "تم إرسال الطلب", body: "أُرسل الطلب إلى أول مرحلة اعتماد. يمكنك متابعة تسلسله من الطلبات الصادرة.", type: "INFO", link: `/approvals?tab=outbox&highlight=${instance.id}` }).catch(() => null);
}
export async function createEnterpriseWorkflow(employeeId: string, type: string, entityId: string) {
  const approvers = await resolveApprovalChain(employeeId, type);
  const instance = await prisma.$transaction(tx => persistEnterpriseWorkflow(tx, employeeId, type, entityId, approvers));
  await notifyWorkflowSubmission(instance, approvers);
  return instance;
}

export async function decideWorkflowStep({
  workflowInstanceId,
  actorUserId,
  decision,
  comments,
  ip
}: {
  workflowInstanceId: string;
  actorUserId: string;
  decision: "APPROVE" | "REJECT" | "RETURN";
  comments?: string;
  ip?: string | null;
}) {
  const { updated, instance, workflowStatus } = await prisma.$transaction(async tx => {
    const instance = await tx.workflowInstance.findUnique({ where: { id: workflowInstanceId }, include: { steps: { orderBy: { step: "asc" } } }, });
    if (!instance || instance.status !== "PENDING") throw new Error("لا يوجد طلب معلق قابل لاتخاذ القرار.");
    const employee = await tx.employee.findUnique({ where: { id: instance.employeeId }, select: { userId: true, odooRawData: true } });
    if (employee?.userId === actorUserId) throw new Error("لا يمكنك اعتماد طلبك بنفسك.");
    const current = instance.steps.find(step => step.step === instance.currentStep && ["PENDING", "DEFERRED"].includes(step.status));
    if (!current || !current.approverUserId || current.approverUserId !== actorUserId) throw new Error("Forbidden");
    const capability = decision === "REJECT" ? "REJECT" : "APPROVE";
    if (!current.capabilities.includes(capability)) throw new Error("Forbidden");
    await assertLocalWorkflow(workflowInstanceId, tx);
    if ((decision === "REJECT" || decision === "RETURN") && !comments?.trim()) throw new Error(decision === "REJECT" ? "سبب الرفض مطلوب" : "سبب الإرجاع مطلوب");
    const next = decision === "APPROVE" ? instance.steps.find(step => step.step > current.step && step.status === "WAITING") : undefined;
    const workflowStatus = decision === "REJECT" ? "REJECTED" : decision === "RETURN" ? "RETURNED" : next ? "PENDING" : "COMPLETED";
    const changed = await tx.workflowInstance.updateMany({ where: { id: instance.id, status: "PENDING", currentStep: instance.currentStep, updatedAt: instance.updatedAt }, data: { status: workflowStatus, currentStep: next?.step ?? (decision === "APPROVE" ? current.step + 1 : current.step) } });
    if (changed.count !== 1) throw new Error("تغير الطلب أثناء المراجعة. أعد تحميله.");
    const decided = await tx.workflowStep.updateMany({ where: { id: current.id, status: { in: ["PENDING", "DEFERRED"] }, approverUserId: actorUserId }, data: { status: decision === "APPROVE" ? "APPROVED" : decision === "REJECT" ? "REJECTED" : "RETURNED", approvedAt: new Date(), comments: mergeWorkflowStepMetadata(current.comments, comments?.trim() ? { note: comments.trim() } : {}) } });
    if (decided.count !== 1) throw new Error("سبق اتخاذ قرار على هذه المرحلة. حدّث الصفحة.");
    if (next) {
      if (!next.approverUserId) throw new Error("المرحلة التالية بلا معتمد. راجع مسؤول النظام.");
      await tx.workflowStep.update({ where: { id: next.id }, data: { status: "PENDING" } });
    }
    if (workflowStatus !== "PENDING") {
      const status = workflowStatus === "COMPLETED" ? "APPROVED" : workflowStatus === "REJECTED" ? "REJECTED" : "PENDING";
      if(instance.type!=="REVOKE"){
        const source=await entityDelegate(tx,instance.type).findUnique({where:{id:instance.entityId}});
        if(!source||source.employeeId!==instance.employeeId||source.status!=="PENDING")throw Error("مصدر الطلب غير مطابق أو تغيرت حالته");
      }
      if (instance.type === "REVOKE") {
        if (workflowStatus === "COMPLETED") {
          const original = await tx.workflowInstance.findUnique({ where: { id: instance.entityId } });
          if (original) await assertLocalWorkflow(original.id, tx);
          if (!original || original.employeeId !== instance.employeeId || original.status !== "COMPLETED") throw new Error("الطلب الأصلي غير قابل للاسترداد");
          const claimed = await tx.workflowInstance.updateMany({ where: { id: original.id, status: "COMPLETED" }, data: { status: "CANCELLED" } });
          if (claimed.count !== 1) throw new Error("سبق استرداد الطلب");
          await cancelEntity(tx, original, true);
          // Revoke the informational approval event, not a salary transaction.
          if (original.type === "LEAVE" || original.type === "OVERTIME") {
            await tx.employeeRequestExecution.updateMany({
              where: { sourceType: original.type, sourceId: original.entityId, effectType: "APPROVAL", state: "EXECUTED" },
              data: { state: "REVERSED" }
            });
            await tx.employeeFinancialEntry.updateMany({
              where: { sourceType: original.type, sourceId: original.entityId, effectType: "APPROVAL", direction: "INFORMATION" },
              data: { state: "REVERSED" }
            });
          }
          await tx.employeeRequestExecution.updateMany({ where: { employeeId: original.employeeId, sourceType: "WORKFLOW", sourceId: original.id, effectType: "APPROVAL_RECORDED" }, data: { state: "REVERSED" } });
          await tx.auditLog.create({ data: { actorUserId, action: "workflow:revoked", entity: "workflowInstance", entityId: original.id, metadata: { revocationWorkflowId: instance.id, comments } } });
        }
      } else if (instance.type === "LEAVE") {
        const leave = await tx.leaveRequest.update({ where: { id: instance.entityId }, data: { status, decidedAt: new Date(), decisionNote: comments }, include: { leaveType: { select: { code: true } } } });
        if(status==="APPROVED"){
          const overlap=await tx.leaveRequest.findFirst({where:{id:{not:leave.id},employeeId:instance.employeeId,status:"APPROVED",startDate:{lte:leave.endDate},endDate:{gte:leave.startDate}},select:{id:true}});
          if(overlap)throw Error("توجد إجازة معتمدة متداخلة؛ يلزم مراجعة التواريخ");
          const paid=await tx.payrollItem.findFirst({where:{employeeId:instance.employeeId,payrollRun:{paidAt:{not:null},periodStartDate:{lte:leave.endDate},periodEndDate:{gte:leave.startDate}}},select:{id:true}});
          if(paid)throw Error("تتداخل الإجازة مع مسير مصروف؛ يلزم تسوية مالية معتمدة");
        }
        // Statutory/special leave must not consume the annual-leave aggregate.
        if (status === "APPROVED" && leave.leaveType.code.toUpperCase().startsWith("ANNUAL")) {
          const raw = (employee?.odooRawData as Record<string, unknown> | null) ?? {};
          const csv = (raw._csvLeaveData as Record<string, unknown> | undefined) ?? {};
          const days=Number(leave.days);
          const accrued=Number(csv.daysAccrued??raw.leaveBalance??30),used=Number(csv.daysUsed??raw.leaveUsed??0);
          if(!Number.isFinite(days)||days<=0||!Number.isFinite(accrued)||!Number.isFinite(used)||accrued<0||used<0)throw Error("بيانات رصيد الإجازة غير صالحة");
          const balance=await tx.employeeLeaveBalance.upsert({where:{employeeId:instance.employeeId},update:{},create:{employeeId:instance.employeeId,accrued,used}});
          if(Math.round((Number(balance.accrued)-Number(balance.used))*100)<Math.round(days*100))throw Error("رصيد الإجازة غير كاف عند الاعتماد النهائي");
          const consumed=await tx.employeeLeaveBalance.updateMany({where:{employeeId:instance.employeeId,updatedAt:balance.updatedAt,used:balance.used,accrued:balance.accrued},data:{used:{increment:days}}});
          if(consumed.count!==1)throw Error("تغير رصيد الإجازة أثناء الاعتماد");
        } 
        if (status === "APPROVED") {
          await postApprovedEffectInTransaction(tx, {
            employeeId: instance.employeeId, sourceType: "LEAVE", sourceId: leave.id,
            effectType: "APPROVAL", direction: "INFORMATION", amount: "0",
            details: { days: Number(leave.days), leaveTypeCode: leave.leaveType.code }
          });
        }
      } else if (instance.type === "OVERTIME") {
        const overtime = await tx.overtimeRequest.update({ where: { id: instance.entityId }, data: { status } });
        if (status === "APPROVED") {
          await postApprovedEffectInTransaction(tx, {
            employeeId: instance.employeeId, sourceType: "OVERTIME", sourceId: overtime.id,
            effectType: "APPROVAL", direction: "INFORMATION", amount: "0",
            details: { hours: Number(overtime.hours) }
          });
        }
      }
      else if (instance.type === "EXPENSE") await tx.expenseRequest.update({ where: { id: instance.entityId }, data: { status } });
      else if (instance.type === "RESUMPTION") await tx.resumptionRequest.update({ where: { id: instance.entityId }, data: { status } });
      else if (instance.type === "LOAN") await tx.loan.update({ where: { id: instance.entityId }, data: { status: status === "APPROVED" ? "ACTIVE" : status === "REJECTED" ? "CANCELLED" : "PENDING" } });
      else await tx.letterRequest.update({ where: { id: instance.entityId }, data: { status } });
      // Keep every locally finalized request visible in the employee timeline.
      // An approval record is not a monetary posting or proof of disbursement.
      if (workflowStatus === "COMPLETED" && !["LEAVE", "OVERTIME", "REVOKE"].includes(instance.type)) {
        await tx.employeeRequestExecution.create({ data: {
          employeeId: instance.employeeId, sourceType: "WORKFLOW", sourceId: instance.id,
          effectType: "APPROVAL_RECORDED", state: "EXECUTED", executedAt: new Date(),
          metadata: { requestType: instance.type, entityId: instance.entityId, paymentConfirmed: false }
        } });
      }
    }
    await tx.auditLog.create({ data: { actorUserId, action: `workflow:${decision.toLowerCase()}`, entity: "workflowInstance", entityId: workflowInstanceId, metadata: { decision, comments, ip, entityId: instance.entityId, type: instance.type, employeeId: instance.employeeId, step: current.step } } });
    const updated = await tx.workflowInstance.findUniqueOrThrow({ where: { id: instance.id } });
    return { updated, instance, workflowStatus };
  },{isolationLevel:"Serializable"});

  const employee = await prisma.employee.findUnique({ where: { id: instance.employeeId }, select: { userId: true } }).catch(() => null);
  if (employee?.userId) {
    await createEnterpriseNotification({
      userId: employee.userId,
      title: decision === "APPROVE" ? "اعتماد طلب" : decision === "REJECT" ? "رفض طلب" : "إرجاع طلب",
      body: `Your ${instance.type} request status is now ${workflowStatus}.`,
      type: decision === "APPROVE" ? "SUCCESS" : decision === "REJECT" ? "ERROR" : "WARNING",
      link: `/approvals?tab=outbox&highlight=${workflowInstanceId}`
    }).catch(() => null);
  }
  const nextPendingStep = await prisma.workflowStep.findFirst({ where: { workflowInstanceId, status: "PENDING" }, select: { approverUserId: true } }).catch(() => null);
  if (nextPendingStep?.approverUserId) {
    await createEnterpriseNotification({ userId: nextPendingStep.approverUserId, title: "وصول طلب جديد", body: `A ${instance.type} request is waiting for your approval.`, type: "INFO", link: `/approvals?tab=inbox&highlight=${workflowInstanceId}` }).catch(() => null);
  }

  return updated;
}
