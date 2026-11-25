import {NextResponse} from "next/server";
import {auth} from "@/auth";
import {prisma} from "@/lib/prisma";
import {canViewPayroll} from "@/lib/enterprise/payroll-permissions";
import {buildExcelTable} from "@/lib/exports/table-files";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store"};
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers});
type Line={itemId:string;employeeId:string;currency:string;costCenterId:string|null;accountRole:string;source:string;debit:string;credit:string};
export async function GET(request:Request){
 const session=await auth();if(!session?.user?.id)return json({success:false},401);if(!canViewPayroll(session))return json({success:false},403);
 const q=new URL(request.url).searchParams,runId=q.get("runId");if(!runId||runId.length>128)return json({success:false},400);
 const journal=await prisma.payrollLocalJournal.findUnique({where:{payrollRunId:runId}});if(!journal)return json({success:false,message:"لا يوجد قيد محلي محفوظ؛ المسيرات التاريخية والمستوردة ليست معاد ترحيلها"},404);
 if(q.get("format")!=="xlsx")return json({success:true,status:journal.status,totals:journal.totals,createdAt:journal.createdAt,lineCount:Array.isArray(journal.lines)?journal.lines.length:0});
 const lines=journal.lines as unknown as Line[];
 if(!Array.isArray(lines)||lines.length>50000)return json({success:false,message:"حجم القيد يتجاوز حد التصدير"},422);
 const bytes=await buildExcelTable("مسودة تصنيف محاسبي محلي - "+journal.status,[{key:"employeeId",label:"مرجع الموظف"},{key:"currency",label:"العملة"},{key:"costCenterId",label:"مركز التكلفة"},{key:"accountRole",label:"تصنيف الحساب"},{key:"source",label:"المصدر"},{key:"debit",label:"مدين"},{key:"credit",label:"دائن"}],lines.map(l=>({...l})));
 await prisma.auditLog.create({data:{actorUserId:session.user.id,action:"payroll:local-journal-export",entity:"payrollRun",entityId:runId,metadata:{status:journal.status,lines:lines.length}}});
 return new NextResponse(new Uint8Array(bytes),{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="local-payroll-journal.xlsx"'}});
}
