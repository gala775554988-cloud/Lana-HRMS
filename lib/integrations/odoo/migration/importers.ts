import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { OdooClient } from "../client";
import type { OdooRecord } from "../types";
import { decimalText, decimalUnits, employeeStatus, externalId, identity, MigrationRecordError, reconcilePayroll, sourceDate, type MigrationConfig } from "./mapping";
import { currencyCode, readAll, readPayslip, requiredFields } from "./reader";
export type ImportContext = { source:string; actorUserId:string; config:MigrationConfig; client:OdooClient; jobId?:string; leaseToken?:string; retry?:boolean };
export type Outcome = "IMPORTED" | "UPDATED" | "UNCHANGED";
function stable(value:unknown):unknown { if(Array.isArray(value))return value.map(stable);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>[key,stable(value)]));return value; }
export function checksum(value: unknown) { return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex"); }
type Transaction=Omit<typeof prisma,"$connect"|"$disconnect"|"$on"|"$transaction"|"$use"|"$extends">;
async function fence(tx:Transaction,context:ImportContext){if(!context.jobId)return;const changed=await tx.odooMigrationJob.updateMany({where:{id:context.jobId,leaseToken:context.leaseToken,leaseUntil:{gt:new Date()},status:{in:context.retry?["PAUSED","FAILED","COMPLETED","COMPLETED_WITH_ERRORS"]:["RUNNING"]}},data:{leaseUntil:new Date(Date.now()+10*60000)}});if(changed.count!==1)throw new MigrationRecordError("LEASE_LOST","توقف التشغيل أو فقد العامل ملكيته؛ لن يكتب بيانات قديمة");}
const json = (value:unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
export async function stage(context:ImportContext, entity:string, row:OdooRecord, raw:unknown = row) {
  const external = Number(row.id); if (!Number.isSafeInteger(external) || external <= 0) throw new MigrationRecordError("INVALID_ID", "معرف المصدر غير صالح");
  const hash = checksum(raw);
  const previous = await prisma.odooSourceRecord.findUnique({where:{source_entity_externalId:{source:context.source,entity,externalId:external}}});
  await prisma.odooSourceRecord.upsert({where:{source_entity_externalId:{source:context.source,entity,externalId:external}},create:{source:context.source,entity,externalId:external,checksum:hash,raw:json(raw),writeDate:typeof row.write_date==="string"?row.write_date:null},update:{checksum:hash,raw:json(raw),writeDate:typeof row.write_date==="string"?row.write_date:null,status:"STAGED"}});
  return {previous,hash,where:{source_entity_externalId:{source:context.source,entity,externalId:external}}};
}
export async function employeeBatch(context:ImportContext, rows:OdooRecord[]) {
  const numbers=rows.map(row=>identity(row[context.config.employeeNumberField])).filter((value):value is string=>!!value);
  const identities=rows.map(row=>identity(row[context.config.nationalIdField])).filter((value):value is string=>!!value);
  const emails=rows.map(row=>identity(row.work_email)).filter((value):value is string=>!!value);
  const employeeIds=rows.flatMap(row=>[externalId(row.id),externalId(row.parent_id)]).filter((value):value is number=>value!==null);
  const [employees,departments,positions,nationalities,companies] = await Promise.all([
    prisma.employee.findMany({where:{OR:[{odooId:{in:employeeIds}},{employeeNumber:{in:numbers}},{nationalId:{in:identities}},{email:{in:emails}}]},select:{id:true,odooId:true,employeeNumber:true,nationalId:true,email:true,archivedAt:true}}),
    prisma.department.findMany({where:{odooId:{in:rows.map(row=>externalId(row.department_id)).filter((v):v is number=>v!==null)}}}),
    prisma.position.findMany({where:{odooId:{in:rows.map(row=>externalId(row.job_id)).filter((v):v is number=>v!==null)}}}),
    prisma.nationality.findMany(), prisma.company.findMany(),
  ]);
  const departmentsById=new Map(departments.map(row=>[row.odooId,row.id]));const positionsById=new Map(positions.map(row=>[row.odooId,row.id]));const nationalityByCode=new Map(nationalities.map(row=>[row.code.toUpperCase(),row.id]));const companyByCode=new Map(companies.map(row=>[row.code,row.id]));
  const countryIds=[...new Set(rows.map(row=>externalId(row.country_id)).filter((value):value is number=>value!==null))];
  const countries=countryIds.length?await context.client.read("res.country",countryIds,["id","name","code"]):[];
  const countryById=new Map(countries.map(row=>[Number(row.id),row]));
  const duplicates=(field:string,value:string)=>rows.filter(row=>identity(row[field])===value).length>1;
  return async (row:OdooRecord):Promise<Outcome> => {
    const staged=await stage(context,"EMPLOYEES",row);
    const number=identity(row[context.config.employeeNumberField]),nationalId=identity(row[context.config.nationalIdField]);
    if(!number||!nationalId||!identity(row.name))throw new MigrationRecordError("MISSING_IDENTITY","الاسم أو الرقم الوظيفي أو الهوية مفقود؛ لا تُنشأ هويات بديلة");
    const email=identity(row.work_email);
    const existing=employees.find(employee=>employee.odooId===Number(row.id));
    if(duplicates(context.config.employeeNumberField,number)||duplicates(context.config.nationalIdField,nationalId)||(email&&duplicates("work_email",email))||employees.some(employee=>employee.id!==existing?.id&&(employee.employeeNumber===number||employee.nationalId===nationalId||(email&&employee.email===email))))throw new MigrationRecordError("DUPLICATE_IDENTITY","تعارض هوية أو رقم وظيفي أو بريد؛ تم التجاوز دون تعديل أي حساب مكرر");
    if(typeof row.active!=="boolean")throw new MigrationRecordError("INVALID_EMPLOYEE_STATE","حالة نشاط الموظف مفقودة من المصدر");
    const status=employeeStatus(row,context.config);const hireDate=sourceDate(row[context.config.hireDateField]);
    if(staged.previous?.checksum===staged.hash&&staged.previous.localId===existing?.id&&staged.previous.status==="IMPORTED") {await prisma.odooSourceRecord.update({where:staged.where,data:{status:"IMPORTED"}});return "UNCHANGED";}
    // Only distinct reference IDs are created; reuse the batch caches, never scan tables per employee.
    const dept=externalId(row.department_id);let departmentId=dept?departmentsById.get(dept):undefined;
    if(dept&&!departmentId){const record=await prisma.department.upsert({where:{odooId:dept},create:{odooId:dept,code:`ODOO-DEPT-${dept}`,name:String(Array.isArray(row.department_id)?row.department_id[1]:dept)},update:{}});departmentId=record.id;departmentsById.set(dept,record.id);}
    const job=externalId(row.job_id);let positionId=job?positionsById.get(job):undefined;
    if(job&&!positionId){const record=await prisma.position.upsert({where:{odooId:job},create:{odooId:job,code:`ODOO-JOB-${job}`,title:String(Array.isArray(row.job_id)?row.job_id[1]:job),departmentId},update:{}});positionId=record.id;positionsById.set(job,record.id);}
    const company=externalId(row.company_id);const companyCode=company?`ODOO-${context.source.slice(0,8)}-${company}`:null;let companyId=companyCode?companyByCode.get(companyCode):undefined;
    if(companyCode&&!companyId){const record=await prisma.company.upsert({where:{code:companyCode},create:{code:companyCode,name:String(Array.isArray(row.company_id)?row.company_id[1]:companyCode)},update:{}});companyId=record.id;companyByCode.set(companyCode,record.id);}
    const country=countryById.get(externalId(row.country_id)??-1);const countryCode=identity(country?.code)?.toUpperCase();let nationalityId=countryCode?nationalityByCode.get(countryCode):undefined;
    if(externalId(row.country_id)&&!countryCode)throw new MigrationRecordError("MISSING_NATIONALITY","تعذر تحديد رمز الجنسية من Odoo");
    if(countryCode&&!nationalityId){const record=await prisma.nationality.upsert({where:{code:countryCode},create:{code:countryCode,name:String(country?.name)},update:{}});nationalityId=record.id;nationalityByCode.set(countryCode,record.id);}
    const names=String(row.name).trim().split(/\s+/);const departure=row.departure_date?sourceDate(row.departure_date):null;
    const saved=await prisma.$transaction(async tx=>{
      await fence(tx,context);
      const data={employeeNumber:number,nationalId,firstName:names[0],lastName:names.slice(1).join(" "),email,phone:identity(row.mobile_phone)||identity(row.work_phone),maritalStatus:identity(row.marital),hireDate,terminationDate:departure,...status,departmentId:departmentId??null,positionId:positionId??null,companyId:companyId??null,nationalityId:nationalityId??null,odooId:Number(row.id),odooActive:row.active!==false,odooParentId:externalId(row.parent_id),odooDepartmentId:dept,odooJobId:job,odooCompanyId:company,odooWriteDate:row.write_date?sourceDate(row.write_date):null,odooRawData:json(row),archivedAt:status.status!=="ACTIVE"?existing?.archivedAt??departure??new Date():null,archiveReason:status.status!=="ACTIVE"?status.workingStatus:null};
      const employee=existing?await tx.employee.update({where:{id:existing.id},data}):await tx.employee.create({data});
      await tx.odooSourceRecord.update({where:staged.where,data:{localId:employee.id,status:"IMPORTED"}});
      return employee;
    });
    const index=employees.findIndex(employee=>employee.id===saved.id);const minimal={id:saved.id,odooId:saved.odooId,employeeNumber:saved.employeeNumber,nationalId:saved.nationalId,email:saved.email,archivedAt:saved.archivedAt};if(index<0)employees.push(minimal);else employees[index]=minimal;
    return existing?"UPDATED":"IMPORTED";
  };
}
export async function managersBatch(context:ImportContext,rows:OdooRecord[]) {
  const ids=rows.flatMap(row=>[externalId(row.id),externalId(row.parent_id)]).filter((value):value is number=>value!==null);
  const [employees,imported]=await Promise.all([prisma.employee.findMany({where:{odooId:{in:ids}},select:{id:true,odooId:true,odooParentId:true}}),prisma.odooSourceRecord.findMany({where:{source:context.source,entity:"EMPLOYEES",externalId:{in:ids},status:"IMPORTED"},select:{externalId:true}})]);const byId=new Map(employees.map(row=>[row.odooId,row]));const eligible=new Set(imported.map(row=>row.externalId));
  return async(row:OdooRecord):Promise<Outcome>=>{const employee=byId.get(Number(row.id));const parent=externalId(row.parent_id);if(!employee||!eligible.has(Number(row.id)))return "UNCHANGED";if(parent&&(!byId.get(parent)||!eligible.has(parent)))throw new MigrationRecordError("MANAGER_NOT_MAPPED","لم تكتمل مطابقة المدير؛ أصلح سجل المدير ثم أعد المحاولة");if(parent===Number(row.id))throw new MigrationRecordError("MANAGER_CYCLE","الموظف محدد مديراً لنفسه");await prisma.$transaction(async tx=>{await fence(tx,context);await tx.employee.update({where:{id:employee.id},data:{managerId:parent?byId.get(parent)!.id:null}});});return "UPDATED";};
}
export async function loanBatch(context:ImportContext,rows:OdooRecord[]) {
  const fields=context.config.loanFields;
  const employees=await prisma.employee.findMany({where:{odooId:{in:rows.map(row=>externalId(row[fields.employee])).filter((value):value is number=>value!==null)}},select:{id:true,odooId:true}});const byId=new Map(employees.map(row=>[row.odooId,row.id]));
  const metadata=await requiredFields(context.client,context.config.loanModel,["id","write_date",...Object.values(fields)]);
  const lineModel=String(metadata.metadata[fields.lines]?.relation??"");if(!lineModel)throw new MigrationRecordError("MODEL_CONFIGURATION","حدد علاقة أقساط السلفة في خريطة الحقول");
  const lineFields=context.config.installmentFields;const lineInfo=await requiredFields(context.client,lineModel,["id",...Object.values(lineFields)],["paid_date","payment_date","payslip_id","payslip_line_id","name","sequence","notes"]);
  return async(row:OdooRecord):Promise<Outcome>=>{
    const lines=await readAll(context.client,lineModel,[[lineFields.loan,"=",row.id]],lineInfo.fields);
    const ids=Array.isArray(row[fields.lines])?(row[fields.lines] as number[]).map(Number).sort((a,b)=>a-b):[];
    if(!Array.isArray(row[fields.lines])||JSON.stringify(ids)!==JSON.stringify(lines.map(line=>Number(line.id)).sort((a,b)=>a-b)))throw new MigrationRecordError("INCOMPLETE_INSTALLMENTS","أقساط المصدر غير مكتملة");
    const latest=(await context.client.read(context.config.loanModel,[Number(row.id)],["write_date",fields.lines],{context:{active_test:false}}))[0];if(latest?.write_date!==row.write_date||JSON.stringify(latest?.[fields.lines])!==JSON.stringify(row[fields.lines]))throw new MigrationRecordError("SOURCE_CHANGED","تغيرت السلفة أثناء القراءة");
    const staged=await stage(context,`LOANS:${context.config.loanModel}`,row,{header:row,lines});const employeeId=byId.get(externalId(row[fields.employee]));if(!employeeId)throw new MigrationRecordError("EMPLOYEE_NOT_MAPPED","الموظف المرتبط غير مطابق");
    const principal=decimalUnits(row[fields.principal]),balance=decimalUnits(row[fields.balance]);
    const installments=lines.map(line=>{if(typeof line[lineFields.paid]!=="boolean")throw new MigrationRecordError("INVALID_INSTALLMENT_STATE","حالة قسط المصدر ليست قيمة منطقية معروفة");return {externalId:Number(line.id),amount:decimalUnits(line[lineFields.amount]),dueDate:sourceDate(line[lineFields.date]),remotePaid:line[lineFields.paid] as boolean,raw:json(line)};});
    const state=context.config.loanStateMap[String(row[fields.state])];
    const unscheduledDraft=state==="PENDING"&&installments.length===0&&(balance===principal||balance===BigInt(0));
    if(principal<=BigInt(0)||balance<BigInt(0)||balance>principal||installments.some(line=>line.amount<=BigInt(0))||(!unscheduledDraft&&(installments.reduce((sum,line)=>sum+line.amount,BigInt(0))!==principal||principal-installments.filter(line=>line.remotePaid).reduce((sum,line)=>sum+line.amount,BigInt(0))!==balance)))throw new MigrationRecordError("LOAN_MISMATCH","الأصل والأقساط المسددة والرصيد لا تتطابق بدقة المصدر");
    if(!state||(state==="PAID"&&balance!==BigInt(0))||(state==="ACTIVE"&&balance===BigInt(0)))throw new MigrationRecordError("UNMAPPED_LOAN_STATE","حالة السلفة أو رصيدها يحتاجان مراجعة");
    if(principal%BigInt(10000)||balance%BigInt(10000)||installments.some(line=>line.amount%BigInt(10000)))throw new MigrationRecordError("UNSUPPORTED_LOAN_PRECISION","سلف التشغيل تدعم هللتين؛ لن تُقرب مبالغ المصدر تلقائياً");
    const currency=await currencyCode(context.client,row,fields.currency);
    const result=await prisma.$transaction(async tx=>{
      await fence(tx,context);
      const key={odooSource_odooLoanModel_odooLoanId:{odooSource:context.source,odooLoanModel:context.config.loanModel,odooLoanId:Number(row.id)}};
      const existing=await tx.loan.findUnique({where:key,include:{repaymentSchedule:true}});
      if(existing&&existing.employeeId!==employeeId)throw new MigrationRecordError("OWNER_CHANGED","تغير مالك السلفة؛ لن يعاد ربطها تلقائياً");
      if(existing&&staged.previous?.checksum===staged.hash&&staged.previous.status==="IMPORTED"){await tx.odooSourceRecord.update({where:staged.where,data:{status:"IMPORTED",localId:existing.id}});return "UNCHANGED" as const;}
      if(existing?.repaymentSchedule.some(old=>old.localPaidAt&&!installments.some(line=>line.externalId===old.externalId)))throw new MigrationRecordError("REMOVED_PAID_INSTALLMENT","حُذف قسط سبق خصمه محلياً؛ يلزم مطابقة مالية");
      let pending=BigInt(0);
      for(const line of installments){const old=existing?.repaymentSchedule.find(old=>old.externalId===line.externalId);if(old?.remotePaid&&!line.remotePaid)throw new MigrationRecordError("UPSTREAM_REVERSAL","تراجع سداد قسط في المصدر؛ يلزم إجراء تسوية");if(old?.localPaidAt&&!line.remotePaid){if(decimalUnits(String(old.amount))!==line.amount)throw new MigrationRecordError("CHANGED_PAID_INSTALLMENT","تغير مبلغ قسط سبق خصمه");pending+=line.amount;}}
      if(pending>balance)throw new MigrationRecordError("LOAN_MISMATCH","رصيد المصدر لا يطابق الخصومات المحلية غير المنعكسة");
      const localBalance=balance-pending;const next=installments.filter(line=>!line.remotePaid&&!existing?.repaymentSchedule.find(old=>old.externalId===line.externalId)?.localPaidAt).sort((a,b)=>a.dueDate.getTime()-b.dueDate.getTime())[0];
      const data={employeeId,principalAmount:decimalText(principal),outstandingAmount:decimalText(localBalance),installmentAmount:decimalText(next?.amount??BigInt(0)),currency,issuedAt:sourceDate(row[fields.date]),status:localBalance===BigInt(0)&&state==="ACTIVE"?"PAID" as const:state,odooWriteDate:row.write_date?sourceDate(row.write_date):null};
      const loan=existing?await tx.loan.update({where:{id:existing.id},data}):await tx.loan.create({data:{...data,loanNumber:`OD-${context.source.slice(0,12)}-${context.config.loanModel}-${row.id}`,odooSource:context.source,odooLoanModel:context.config.loanModel,odooLoanId:Number(row.id)}});
      for(const line of installments){const data={source:context.source,amount:decimalText(line.amount),dueDate:line.dueDate,remotePaid:line.remotePaid,raw:line.raw};await tx.odooLoanInstallment.upsert({where:{loanId_externalId:{loanId:loan.id,externalId:line.externalId}},create:{...data,loanId:loan.id,externalId:line.externalId},update:data});}
      await tx.odooLoanInstallment.deleteMany({where:{loanId:loan.id,externalId:{notIn:installments.map(line=>line.externalId)},localPaidAt:null}});
      await tx.odooSourceRecord.update({where:staged.where,data:{localId:loan.id,status:"IMPORTED"}});return existing?"UPDATED" as const:"IMPORTED" as const;
    });return result;
  };
}
export async function payrollBatch(context:ImportContext,rows:OdooRecord[]) {
  const [employees,rules]=await Promise.all([prisma.employee.findMany({where:{odooId:{in:rows.map(row=>externalId(row.employee_id)).filter((value):value is number=>value!==null)}},select:{id:true,odooId:true}}),prisma.salaryRule.findMany({where:{isActive:true}})]);const employeeMap=new Map(employees.map(row=>[row.odooId,row.id]));const ruleMap=new Map(rules.map(row=>[row.code,row.category]));
  return async(row:OdooRecord):Promise<Outcome>=>{
    const {header,lines}=await readPayslip(context.client,row);const staged=await stage(context,"PAYROLL",header,{header,lines});
    const employeeId=employeeMap.get(externalId(header.employee_id));if(!employeeId)throw new MigrationRecordError("EMPLOYEE_NOT_MAPPED","الموظف المرتبط بالكشف غير مطابق");
    const totals=reconcilePayroll(lines.map(line=>({code:line.code,total:line.total})),ruleMap);const currency=await currencyCode(context.client,header);const fromDate=sourceDate(header.date_from),toDate=sourceDate(header.date_to);if(toDate<fromDate)throw new MigrationRecordError("INVALID_DATE","فترة الكشف غير صالحة");
    const company=externalId(header.company_id);if(!company)throw new MigrationRecordError("MISSING_COMPANY","شركة الكشف غير محددة");
    const result=await prisma.$transaction(async tx=>{
      await fence(tx,context);
      const existing=await tx.historicalPayslip.findUnique({where:{source_odooPayslipId:{source:context.source,odooPayslipId:Number(header.id)}},include:{lines:{orderBy:{externalId:"asc"}}}});
      if(existing&&existing.employeeId!==employeeId)throw new MigrationRecordError("OWNER_CHANGED","تغير مالك الكشف؛ يلزم مراجعة المطابقة");
      if(existing?.checksum===staged.hash){await tx.odooSourceRecord.update({where:staged.where,data:{localId:existing.id,status:"IMPORTED"}});return "UNCHANGED" as const;}
      if(existing&&["done","paid"].includes(existing.state)) {
        const oldHeader=existing.raw as Record<string,unknown>;
        const same=Boolean(oldHeader.credit_note)===Boolean(header.credit_note)&&externalId(oldHeader.company_id)===company&&(externalId(oldHeader.payslip_run_id)??0)===(externalId(header.payslip_run_id)??0)&&checksum(existing.lines.map(line=>line.raw))===checksum(lines)&&decimalUnits(String(existing.basic))===decimalUnits(totals.basic)&&decimalUnits(String(existing.net))===decimalUnits(totals.net)&&existing.currency===currency&&existing.fromDate.getTime()===fromDate.getTime()&&existing.toDate.getTime()===toDate.getTime()&&(!existing.moveId||existing.moveId===externalId(header.move_id));
        if(!same||![existing.state,...(existing.state==="done"?["paid"]:[])].includes(String(header.state)))throw new MigrationRecordError("FINALIZED_HISTORY_CHANGED","تغير كشف تاريخي معتمد؛ حُفظ المصدر للمراجعة دون استبدال القسيمة المعتمدة");
        await tx.historicalPayslip.update({where:{id:existing.id},data:{state:String(header.state),moveId:externalId(header.move_id),raw:json(header),checksum:staged.hash}});
        await tx.odooSourceRecord.update({where:staged.where,data:{localId:existing.id,status:"IMPORTED"}});return "UPDATED" as const;
      }
      const period=String(header.date_from).slice(0,7);const externalRunId=externalId(header.payslip_run_id)??0;
      const run=await tx.historicalPayrollRun.upsert({where:{source_period_companyOdooId_externalRunId:{source:context.source,period,companyOdooId:company,externalRunId}},create:{source:context.source,period,companyOdooId:company,externalRunId},update:{}});
      const data={runId:run.id,employeeId,state:String(header.state),currency,fromDate,toDate,...{basic:totals.basic,gross:totals.gross,deductions:totals.deductions,net:totals.net},moveId:externalId(header.move_id),raw:json(header),checksum:staged.hash};
      const slip=existing?await tx.historicalPayslip.update({where:{id:existing.id},data}):await tx.historicalPayslip.create({data:{...data,source:context.source,odooPayslipId:Number(header.id)}});
      await tx.historicalPayslipLine.deleteMany({where:{payslipId:slip.id}});
      await tx.historicalPayslipLine.createMany({data:lines.map((line,index)=>({payslipId:slip.id,externalId:Number(line.id),code:String(line.code),name:String(line.name),category:totals.categories[index],amount:decimalText(decimalUnits(line.amount)),quantity:decimalText(decimalUnits(line.quantity)),rate:decimalText(decimalUnits(line.rate)),total:decimalText(decimalUnits(line.total)),raw:json(line)}))});
      await tx.odooSourceRecord.update({where:staged.where,data:{localId:slip.id,status:"IMPORTED"}});return existing?"UPDATED" as const:"IMPORTED" as const;
    });return result;
  };
}
