import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManagePayroll, canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { calculateEosb, calculateFinalSettlement, standardSaudiGosiSchedule, gccGosiCohorts } from "@/lib/payroll/calculations";
import { accountingMappingSchema } from "@/lib/payroll/journal";
import { z } from "zod";
const policySchema = z.object({ cohort: z.string().regex(/^[A-Z_]{2,30}$/), effectiveFrom: z.coerce.date(), effectiveTo: z.coerce.date().nullable(), employeeRate: z.number().min(0).max(100), employerRate: z.number().min(0).max(100), minimumWage: z.number().nonnegative(), maximumWage: z.number().positive(), housingIncluded: z.boolean(), newSystemCutoff: z.coerce.date().nullable() }).strict();
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canManagePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  const [policies, rules, outbox] = await Promise.all([prisma.gosiSetting.findMany({ orderBy: { effectiveFrom: "desc" } }), prisma.salaryRule.findMany({ orderBy: { code: "asc" } }), prisma.payrollAccountingOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 50 })]);
  return NextResponse.json({ success: true, policies, rules, outbox });
}
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ success: false }, { status: 401 });
  if (!canApprovePayroll(session)) return NextResponse.json({ success: false }, { status: 403 });
  try {
    const body = await request.json();
    if(body.action==="install-new-gosi-schedule"){
      const {minimumWage}=z.object({minimumWage:z.number().min(0).max(45000),reviewed:z.literal(true)}).strict().parse(body.data);
      const schedule=standardSaudiGosiSchedule(minimumWage);
      await prisma.$transaction(async tx=>{
        for(const policy of schedule){
          const overlap=await tx.gosiSetting.findFirst({where:{cohort:policy.cohort,effectiveFrom:{lte:policy.effectiveTo??new Date("9999-12-31")},OR:[{effectiveTo:null},{effectiveTo:{gte:policy.effectiveFrom}}]}});
          if(overlap)throw Error("توجد سياسة NEW متداخلة؛ راجع السياسات الحالية قبل التثبيت");
          await tx.gosiSetting.create({data:policy});
        }
        await tx.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:gosi-install-reference",entity:"gosiSetting",metadata:{cohort:"NEW",count:schedule.length,source:"https://awareness.gosi.gov.sa/businessJourney.html",minimumWage}}});
      },{isolationLevel:"Serializable"});
      return NextResponse.json({success:true});
    }
    if (body.action === "accounting") {
      const data = accountingMappingSchema.parse(body.data);
      await prisma.$transaction(async tx => {
        await tx.appSetting.upsert({ where: { key: "payroll.odooAccounting" }, create: { key: "payroll.odooAccounting", value: data }, update: { value: data } });
        await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:accounting-mapping", entity: "appSetting", entityId: "payroll.odooAccounting", metadata: data } });
      });
      return NextResponse.json({ success: true });
    }
    if (body.action === "coverage") {
      const data = z.object({ employeeId: z.string().min(1), coverageCohort: z.string().regex(/^[A-Z_]{2,30}$/), firstCoverageDate: z.coerce.date().nullable() }).strict().parse(body.data);
      await prisma.$transaction(async tx => {
        await tx.socialInsuranceRecord.update({ where: { employeeId: data.employeeId }, data: { coverageCohort: data.coverageCohort, firstCoverageDate: data.firstCoverageDate } });
        await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:gosi-coverage", entity: "employee", entityId: data.employeeId, metadata: { cohort: data.coverageCohort } } });
      });
      return NextResponse.json({ success: true });
    }
    if (body.action === "close-policy") {
      const data = z.object({ id: z.string().min(1), effectiveTo: z.coerce.date() }).strict().parse(body.data);
      await prisma.$transaction(async tx => {
        const policy = await tx.gosiSetting.findUniqueOrThrow({ where: { id: data.id } });
        if (data.effectiveTo < policy.effectiveFrom) throw new Error("تاريخ الإغلاق يسبق بداية السياسة");
        if (policy.effectiveTo && data.effectiveTo > policy.effectiveTo) throw new Error("لا يمكن تمديد السياسة من إجراء الإغلاق");
        await tx.gosiSetting.update({ where: { id: data.id }, data: { effectiveTo: data.effectiveTo } });
        await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:gosi-close-policy", entity: "gosiSetting", entityId: data.id, metadata: { effectiveTo: data.effectiveTo.toISOString() } } });
      }, { isolationLevel: "Serializable" });
      return NextResponse.json({ success: true });
    }
    if (body.action === "eosb") {
      const value = z.object({ startDate: z.coerce.date(), endDate: z.coerce.date(), monthlyWage: z.number().nonnegative(), reason: z.enum(["RESIGNATION", "NON_RENEWAL", "TERMINATION"]), unpaidSalary: z.number().nonnegative().optional(), leaveEncashment: z.number().nonnegative().optional(), otherEntitlements: z.number().nonnegative().optional(), deductions: z.number().nonnegative().optional(), outstandingLoans: z.number().nonnegative().optional(), excludedDays: z.number().int().nonnegative().optional(), article80: z.boolean().optional(), fullEntitlementException: z.boolean().optional() }).strict().parse(body.data);
      const eosb = calculateEosb(value);
      const settlement = calculateFinalSettlement({ eosb: eosb.eosb, unpaidSalary: value.unpaidSalary ?? 0, leaveEncashment: value.leaveEncashment ?? 0, otherEntitlements: value.otherEntitlements ?? 0, deductions: value.deductions ?? 0, outstandingLoans: value.outstandingLoans ?? 0 });
      return NextResponse.json({ success: true, calculation: { ...eosb, settlement } });
    }
    if (body.action === "rule") {
      const data = z.object({ code: z.string().min(1).max(80), name: z.string().min(1).max(160), category: z.enum(["BASIC", "ALLOWANCE", "DEDUCTION", "EMPLOYER", "INFORMATION", "NET", "GROSS"]), isActive: z.boolean() }).strict().parse(body.data);
      await prisma.$transaction(async tx => {
        await tx.salaryRule.upsert({ where: { code: data.code }, create: data, update: data });
        await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:salary-rule", entity: "salaryRule", entityId: data.code, metadata: data } });
      });
      return NextResponse.json({ success: true });
    }
    if (body.action !== "policy") throw new Error("إجراء غير صالح");
    const {sourceReference,reviewed,...rawPolicy}=body.data??{};
    const data = policySchema.parse(rawPolicy);
    if(gccGosiCohorts.some(cohort=>cohort===data.cohort)){
      if(reviewed!==true || typeof sourceReference!=="string" || sourceReference.trim().length<10 || sourceReference.length>1000)throw Error("وثق مرجع مؤسسة التأمينات في دولة الموطن والنسب والسقف المعتمد للمنشأة قبل الحفظ");
    }
    if (data.maximumWage < data.minimumWage || (data.effectiveTo && data.effectiveTo < data.effectiveFrom)) throw new Error("تحقق من حدود الأجر والتواريخ");
    await prisma.$transaction(async tx => {
      const overlap = await tx.gosiSetting.findFirst({ where: { cohort: data.cohort, effectiveFrom: { lte: data.effectiveTo ?? new Date("9999-12-31") }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: data.effectiveFrom } }] } });
      if (overlap) throw new Error("توجد سياسة متداخلة؛ حدد فترة غير متداخلة");
      const policy = await tx.gosiSetting.create({ data });
      await tx.auditLog.create({ data: { actorUserId: session.user.id, action: "payroll:gosi-policy", entity: "gosiSetting", entityId: policy.id, metadata: { cohort: data.cohort, employeeRate: data.employeeRate, employerRate: data.employerRate, ...(typeof sourceReference==="string"?{sourceReference:sourceReference.slice(0,1000)}:{}) } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "بيانات غير صالحة" : error instanceof Error ? error.message : "تعذر الحفظ" }, { status: 400 }); }
}
