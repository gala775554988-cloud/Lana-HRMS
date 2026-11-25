import type {Prisma} from "@prisma/client";
export type LegacyDebt={sourceType:"LOAN"|"ADVANCE";sourceId:string;employeeId:string;principal:{toString():string}|string|number;currency:string};
type Review={sourceType:string;sourceId:string;employeeId:string;principal:{toString():string}|string|number;currency:string;decision:string;evidenceReference:string|null};
export function debtReviewVerified(debt:LegacyDebt,review:Review|null|undefined){
 return !!review&&review.sourceType===debt.sourceType&&review.sourceId===debt.sourceId&&review.employeeId===debt.employeeId&&review.currency===debt.currency&&Number(review.principal)===Number(debt.principal)&&review.decision==="VERIFIED"&&!!review.evidenceReference?.trim();
}
export async function requireLegacyDebtReview(db:Pick<Prisma.TransactionClient,"payrollDebtReview">,debts:LegacyDebt[]){
 if(!debts.length)return;
 const rows=await db.payrollDebtReview.findMany({where:{OR:debts.map(d=>({sourceType:d.sourceType,sourceId:d.sourceId}))}});
 if(debts.some(d=>!debtReviewVerified(d,rows.find(r=>r.sourceType===d.sourceType&&r.sourceId===d.sourceId))))throw Error("توجد سلفة أو قرض تاريخي دون مستند صرف مراجع؛ راجع شاشة مطابقة الديون قبل الاحتساب أو التسوية");
}
