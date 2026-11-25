import type { Prisma } from "@prisma/client";
export type MoneyValue={toString():string}|string|number;
function cents(value:MoneyValue):bigint {
 const raw=String(value);
 if(!/^\d+(\.\d{1,2})?$/.test(raw))throw Error("قيمة مالية غير صالحة");
 const [whole,fraction=""]=raw.split(".");
 return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));
}
function display(n:bigint){const sign=n<0n?"-":"";const abs=n<0n?-n:n;return sign+(abs/100n).toString()+"."+(abs%100n).toString().padStart(2,"0");}
export function compareBudget(ceiling:MoneyValue,committed:MoneyValue[],proposed:MoneyValue[]){
 const limit=cents(ceiling),used=committed.reduce((n,v)=>n+cents(v),0n),next=proposed.reduce((n,v)=>n+cents(v),0n);
 return {ceiling:display(limit),committed:display(used),proposed:display(next),remaining:display(limit-used-next),exceeded:used+next>limit};
}
export function outsideBand(salary:MoneyValue,min:MoneyValue,max:MoneyValue){return cents(salary)<cents(min)||cents(salary)>cents(max);}
type Item={employeeId:string;costCenterId:string|null;currency:string;baseSalary:MoneyValue;grossPay:MoneyValue;employerInsurance:MoneyValue};
export async function inspectPayrollControls(tx:Prisma.TransactionClient,run:{id:string;periodId:string|null;costCenterId:string|null},items:Item[]){
 const [budgets,bands,employees]=await Promise.all([
  run.periodId?tx.payrollBudgetLimit.findMany({where:{periodId:run.periodId}}):Promise.resolve([]),
  tx.payrollSalaryBand.findMany(),
  tx.employee.findMany({where:{id:{in:items.map(i=>i.employeeId)}},select:{id:true,positionId:true}})
 ]);
 const warnings:{code:string;reference:string;blocking:boolean;details?:object}[]=[];
 const positions=new Map(employees.map(e=>[e.id,e.positionId]));
 for(const item of items){
  const band=bands.find(b=>b.positionId===positions.get(item.employeeId)&&b.currency===item.currency);
  if(band&&outsideBand(item.baseSalary,band.minimum,band.maximum))warnings.push({code:"SALARY_OUTSIDE_BAND",reference:item.employeeId,blocking:band.enforce});
 }
 for(const budget of budgets){
  const proposed=items.filter(i=>(i.costCenterId??run.costCenterId)===budget.costCenterId&&i.currency===budget.currency);
  if(!proposed.length)continue;
  const committed=await tx.payrollItem.findMany({where:{currency:budget.currency,payrollRunId:{not:run.id},payrollRun:{periodId:run.periodId,OR:[{status:"APPROVED"},{paidAt:{not:null}}]},OR:[{costCenterId:budget.costCenterId},{costCenterId:null,payrollRun:{costCenterId:budget.costCenterId}}]},select:{grossPay:true,employerInsurance:true}});
  const result=compareBudget(budget.ceiling,committed.flatMap(i=>[i.grossPay,i.employerInsurance]),proposed.flatMap(i=>[i.grossPay,i.employerInsurance]));
  if(result.exceeded)warnings.push({code:"BUDGET_EXCEEDED",reference:budget.costCenterId,blocking:budget.enforce,details:result});
 }
 return warnings;
}
