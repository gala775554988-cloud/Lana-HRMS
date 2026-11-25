import { NextRequest, NextResponse } from "next/server";
import { hasInternalSyncToken } from "@/lib/integrations/odoo/sync";
import { reconcileEmployeeNumbersAndIds } from "@/lib/integrations/odoo/employee-number-reconcile";
import { writeAuditLog } from "@/lib/audit";
import { scheduledReconciliationReady } from "@/lib/integrations/odoo/reconciliation-gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret=process.env.CRON_SECRET;
  if(!hasInternalSyncToken(request)&&(!secret||request.headers.get("authorization")!==`Bearer ${secret}`))return NextResponse.json({success:false,message:"Unauthorized"},{status:401});
  try{
    // Incremental sync performs the normal upserts. Daily reconciliation must
    // not reassign employee numbers, evict conflicting identities or delete
    // organizational records without a reviewed mapping.
    const report=await reconcileEmployeeNumbersAndIds({connectionId:request.nextUrl.searchParams.get("connectionId")||undefined,dryRun:true,createMissing:false,timeBudgetMs:120000});
    const success=scheduledReconciliationReady(report);
    const summary={success,mode:"READ_ONLY_RECONCILIATION",fetched:report.odooEmployeesFetched,localScanned:report.localEmployeesScanned,unmatchedOdoo:report.matches.unmatchedOdoo,unmatchedLocal:report.matches.unmatchedLocal,plan:report.plan,mismatches:report.verification.mismatchesRemaining,incomplete:report.incomplete,errorCount:report.errors.length};
    await writeAuditLog({action:success?"ODOO_DAILY_RECONCILIATION":"ODOO_DAILY_RECONCILIATION_BLOCKED",entity:"odoo",metadata:summary});
    return NextResponse.json(summary,{status:success?200:422});
  }catch{
    await writeAuditLog({action:"ODOO_DAILY_RECONCILIATION_FAILED",entity:"odoo"}).catch(()=>undefined);
    return NextResponse.json({success:false,message:"Daily Odoo reconciliation failed"},{status:500});
  }
}
