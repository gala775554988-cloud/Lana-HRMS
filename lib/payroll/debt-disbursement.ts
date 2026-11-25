import {z} from "zod";
export const debtConfirmationSchema=z.object({kind:z.enum(["LOAN","ADVANCE"]),id:z.string().min(1).max(128),reference:z.string().trim().min(5).max(150).transform(v=>v.toUpperCase()),amount:z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),currency:z.string().regex(/^[A-Z]{3}$/),paidDate:z.string().date(),attested:z.literal(true)}).strict();
export function verifyDebtConfirmation(input:z.infer<typeof debtConfirmationSchema>,source:{amount:string;currency:string;employeeActive:boolean;disbursementRequired:boolean;disbursedAt:Date|null;approved:boolean},now=new Date()){
 if(!source.employeeActive||!source.disbursementRequired||source.disbursedAt||!source.approved)throw Error("الطلب غير قابل لتأكيد الصرف");
 const cents=(v:string)=>Math.round(Number(v)*100);
 if(cents(input.amount)<=0||cents(input.amount)!==cents(source.amount)||input.currency!==source.currency)throw Error("المبلغ أو العملة لا يطابقان الطلب المعتمد");
 const date=new Date(input.paidDate+"T00:00:00+03:00");
 if(date.getTime()>now.getTime())throw Error("تاريخ الصرف في المستقبل");
 return date;
}
