import {NextRequest,NextResponse} from "next/server";
import {hasValidInternalSyncToken} from "@/lib/internal-sync-auth";
import {runAutomationAlerts} from "@/lib/enterprise/automation-alerts";
import {writeAuditLog} from "@/lib/audit";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=120;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET;
 if(!hasValidInternalSyncToken(request)&&(!secret||request.headers.get("authorization")!=="Bearer "+secret))return NextResponse.json({success:false},{status:401});
 try{const result=await runAutomationAlerts();await writeAuditLog({action:"AUTOMATION_ALERTS_RUN",entity:"automation",metadata:result});return NextResponse.json({success:true,...result});}
 catch{await writeAuditLog({action:"AUTOMATION_ALERTS_FAILED",entity:"automation"}).catch(()=>undefined);return NextResponse.json({success:false,message:"Automation alerts failed"},{status:500});}
}
