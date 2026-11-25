type Amount=string|number|{toString():string};
function cents(value:Amount){const m=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));if(!m)throw Error("Invalid payroll amount");return (m[1]?BigInt(-1):BigInt(1))*(BigInt(m[2])*BigInt(100)+BigInt((m[3]??"").padEnd(2,"0")));}
const asNumber=(v:bigint)=>{const n=Number(v);if(!Number.isSafeInteger(n))throw Error("Report exceeds supported precision");return n/100;};
export type ReportItem={period:string;status:string;currency:string;group:string;gross:Amount;deductions:Amount;net:Amount;employer:Amount};
export function groupPayrollReport(items:ReportItem[]){
 const map=new Map<string,{period:string;status:string;currency:string;group:string;count:number;gross:bigint;deductions:bigint;net:bigint;employer:bigint}>();
 for(const row of items){
  const key=JSON.stringify([row.period,row.status,row.currency,row.group]);
  const acc=map.get(key)??{period:row.period,status:row.status,currency:row.currency,group:row.group,count:0,gross:BigInt(0),deductions:BigInt(0),net:BigInt(0),employer:BigInt(0)};
  acc.count++;acc.gross+=cents(row.gross);acc.deductions+=cents(row.deductions);acc.net+=cents(row.net);acc.employer+=cents(row.employer);map.set(key,acc);
 }
 return [...map.values()].map(row=>({...row,gross:asNumber(row.gross),deductions:asNumber(row.deductions),net:asNumber(row.net),employer:asNumber(row.employer),cost:asNumber(row.gross+row.employer),difference:asNumber(row.gross-row.deductions-row.net)}));
}
