import { money, validSaudiIban } from "./calculations";
export type BankReviewRow={employeeNumber:string;iban:string;primaryAccounts:number;companyId:string|null;gross:number;deductions:number;net:number;currency:string};
export function inspectBankReview(rows:BankReviewRow[],companyId:string|null){
 const issues:{employeeNumber:string;code:string;severity:"ERROR"|"WARNING"}[]=[];
 const seen=new Set<string>(),ibans=new Set<string>();
 const add=(employeeNumber:string,code:string,severity:"ERROR"|"WARNING"="ERROR")=>issues.push({employeeNumber,code,severity});
 if(!rows.length)add("","EMPTY_RUN");
 if(!companyId)add("","COMPANY_REQUIRED");
 for(const row of rows){
  const id=row.employeeNumber.trim(),iban=row.iban.replace(/\s/g,"").toUpperCase();
  if(!id||seen.has(id)||/^[=+@-]/.test(id))add(id,"INVALID_EMPLOYEE_NUMBER");
  seen.add(id);
  if(row.companyId!==companyId)add(id,"COMPANY_MISMATCH");
  if(row.primaryAccounts!==1||!validSaudiIban(iban))add(id,"INVALID_PRIMARY_IBAN");
  else {if(ibans.has(iban))add(id,"SHARED_IBAN","WARNING");ibans.add(iban);}
  if(row.currency!=="SAR")add(id,"CURRENCY_NOT_SAR");
  if(![row.gross,row.deductions,row.net].every(v=>Number.isFinite(v)&&v>=0)||row.net<=0||money(row.gross-row.deductions)!==money(row.net))add(id,"PAYROLL_TOTAL_MISMATCH");
  else if(row.gross>0&&row.deductions/row.gross>0.5)add(id,"HIGH_DEDUCTION_RATIO","WARNING");
 }
 return {ready:!issues.some(i=>i.severity==="ERROR"),count:rows.length,issues,netTotal:money(rows.filter(r=>Number.isFinite(r.net)).reduce((s,r)=>s+r.net,0)),documentType:"INTERNAL_BANK_REVIEW",requiresBankSignedWps:true};
}
