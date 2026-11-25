import type {PayrollBreakdown} from "@/lib/enterprise/payroll-engine";
import {buildPayrollLedgerBreakdown} from "./settlement";
type Input={id:string;employeeId:string;currency:string;costCenterId:string|null;employerInsurance:number;snapshot:PayrollBreakdown};
type Line={itemId:string;employeeId:string;currency:string;costCenterId:string|null;accountRole:string;source:string;debit:string;credit:string};
const cents=(n:number)=>{const value=Math.round(n*100);if(!Number.isSafeInteger(value)||n<0||Math.abs(value-n*100)>0.0001)throw Error("قيمة قيد غير صالحة");return BigInt(value);};
const fixed=(n:bigint)=>(n/BigInt(100)).toString()+"."+(n%BigInt(100)).toString().padStart(2,"0");
export function buildLocalPayrollJournal(items:Input[],defaultCenter:string|null){
 if(!items.length||new Set(items.map(i=>i.id)).size!==items.length)throw Error("مصادر القيد فارغة أو مكررة");
 const lines:Line[]=[];
 const totals=new Map<string,{debit:bigint;credit:bigint}>();
 for(const item of items){
  if(!/^[A-Z]{3}$/.test(item.currency)||item.currency!==item.snapshot.currency)throw Error("عملة القيد لا تطابق لقطة المسير");
  const group=totals.get(item.currency)??{debit:BigInt(0),credit:BigInt(0)};totals.set(item.currency,group);
  const add=(accountRole:string,source:string,amount:number,side:"debit"|"credit")=>{
   const value=cents(amount);if(!value)return;
   group[side]+=value;lines.push({itemId:item.id,employeeId:item.employeeId,currency:item.currency,costCenterId:item.costCenterId??defaultCenter,accountRole,source,debit:fixed(side==="debit"?value:BigInt(0)),credit:fixed(side==="credit"?value:BigInt(0))});
  };
  for(const entry of buildPayrollLedgerBreakdown(item.snapshot)){
   const role=entry.effectType.split(":")[0];
   const debit=entry.direction==="CREDIT";
   const accountRole=debit?"WAGE_EXPENSE":role==="LOAN"||role==="ADVANCE"?"EMPLOYEE_RECEIVABLE":role==="GOSI"?"GOSI_PAYABLE":role==="TAX"?"TAX_PAYABLE":"DEDUCTION_CLEARING";
   add(accountRole,entry.effectType,entry.amount,debit?"debit":"credit");
  }
  add("NET_WAGE_PAYABLE","NET",item.snapshot.netPay,"credit");
  if(cents(item.employerInsurance)!==cents(item.snapshot.gosi.employerAmount))throw Error("حصة المنشأة لا تطابق اللقطة");
  add("EMPLOYER_INSURANCE_EXPENSE","EMPLOYER_GOSI",item.employerInsurance,"debit");
  add("GOSI_PAYABLE","EMPLOYER_GOSI",item.employerInsurance,"credit");
 }
 const summary=[...totals.entries()].map(([currency,t])=>{if(t.debit!==t.credit)throw Error("القيد غير متوازن حسب العملة");return {currency,debit:fixed(t.debit),credit:fixed(t.credit)};});
 return {lines,totals:summary};
}

/** Reverse the immutable original lines, rather than recalculate from live payroll. */
export function reverseLocalPayrollJournal(raw:unknown){
 if(!Array.isArray(raw)||!raw.length||raw.length>50000)throw Error("القيد الأصلي غير صالح للعكس");
 const parse=(v:unknown)=>{if(typeof v!=="string"||!/^\d+\.\d{2}$/.test(v))throw Error("قيمة قيد غير صالحة");const [a,b]=v.split(".");return BigInt(a)*BigInt(100)+BigInt(b);};
 const totals=new Map<string,{debit:bigint;credit:bigint}>();
 const lines:Line[]=raw.map(value=>{
  const l=value as Line;
  if(!l||typeof l!=="object"||typeof l.currency!=="string"||!/^[A-Z]{3}$/.test(l.currency)||typeof l.itemId!=="string"||typeof l.employeeId!=="string"||typeof l.accountRole!=="string"||typeof l.source!=="string"||!(l.costCenterId===null||typeof l.costCenterId==="string"))throw Error("سطر قيد غير صالح");
  const debit=parse(l.debit),credit=parse(l.credit);if((debit===BigInt(0))===(credit===BigInt(0)))throw Error("سطر قيد غير متوازن");
  const sum=totals.get(l.currency)??{debit:BigInt(0),credit:BigInt(0)};sum.debit+=credit;sum.credit+=debit;totals.set(l.currency,sum);
  return {itemId:l.itemId,employeeId:l.employeeId,currency:l.currency,costCenterId:l.costCenterId,accountRole:l.accountRole,source:l.source,debit:l.credit,credit:l.debit};
 });
 return {lines,totals:[...totals].map(([currency,sum])=>{if(sum.debit!==sum.credit)throw Error("القيد الأصلي غير متوازن حسب العملة");return {currency,debit:fixed(sum.debit),credit:fixed(sum.credit)};})};
}
