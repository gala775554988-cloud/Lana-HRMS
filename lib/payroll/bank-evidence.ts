import { validSaudiIban } from "./calculations";
export type BankExtractRow={employeeNumber:string;iban:string;currency:string;net:number};
const norm=(value:string)=>value.replace(/\s/g,"").toUpperCase();
function cents(value:number){const n=Math.round(value*100);if(!Number.isFinite(value)||value<=0||!Number.isSafeInteger(n)||Math.abs(value*100-n)>0.0001)throw Error("Invalid payment amount");return n;}
/** A separate, bank-supplied transaction report normalized to four columns.
 * This parser NEVER opens or changes the original signed WPS file. */
export function parseBankExtract(csv:string):BankExtractRow[]{
 const lines=csv.replace(/^\uFEFF/,"").trim().split(/\r?\n/);
 const fields=(line:string)=>line.split(",").map(v=>v.trim().replace(/^"([^"]*)"$/,"$1"));
 if(fields(lines.shift()??"").join(",")!=="employee_number,iban,currency,net_amount")throw Error("صيغة كشف المطابقة غير معروفة");
 if(!lines.length||lines.length>20000)throw Error("عدد صفوف كشف المطابقة غير صالح");
 return lines.map(line=>{
  const parts=fields(line);
  if(parts.length!==4||!parts[0]||/^[=+@-]/.test(parts[0])||!validSaudiIban(parts[1])||parts[2]!=="SAR"||!/^\d+(\.\d{1,2})?$/.test(parts[3]))throw Error("صف غير صالح في كشف البنك");
  const net=Number(parts[3]);cents(net);
  return {employeeNumber:parts[0],iban:norm(parts[1]),currency:parts[2],net};
 });
}
export function matchBankExtract(expected:BankExtractRow[],actual:BankExtractRow[]){
 const issues:{employeeNumber:string;code:string}[]=[];
 const map=new Map<string,BankExtractRow>();
 for(const row of expected){if(map.has(row.employeeNumber))throw Error("Duplicate payroll employee");map.set(row.employeeNumber,row);}
 const seen=new Set<string>();
 for(const row of actual){
  if(seen.has(row.employeeNumber)){issues.push({employeeNumber:row.employeeNumber,code:"DUPLICATE"});continue;}
  seen.add(row.employeeNumber);
  const target=map.get(row.employeeNumber);
  if(!target){issues.push({employeeNumber:row.employeeNumber,code:"UNEXPECTED"});continue;}
  if(norm(target.iban)!==norm(row.iban))issues.push({employeeNumber:row.employeeNumber,code:"IBAN_MISMATCH"});
  if(target.currency!==row.currency||cents(target.net)!==cents(row.net))issues.push({employeeNumber:row.employeeNumber,code:"AMOUNT_MISMATCH"});
 }
 for(const row of expected)if(!seen.has(row.employeeNumber))issues.push({employeeNumber:row.employeeNumber,code:"MISSING"});
 return {matched:expected.length>0&&!issues.length,expectedCount:expected.length,actualCount:actual.length,expectedTotal:expected.reduce((s,r)=>s+cents(r.net),0)/100,actualTotal:actual.reduce((s,r)=>s+cents(r.net),0)/100,issues,signatureVerified:false,matchBasis:"SEPARATE_BANK_REPORT_ATTESTED",accountBasis:"CURRENT_PRIMARY_ACCOUNT",mudadSubmitted:false};
}
