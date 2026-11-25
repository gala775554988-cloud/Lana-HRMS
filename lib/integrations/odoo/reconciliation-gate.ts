type Report={success:boolean;incomplete:boolean;odooEmployeesFetched:number;matches:{unmatchedOdoo:number};plan:{updateNumber:number;linkOdooId:number;createMissing:number;evictConflicts:number};verification:{mismatchesRemaining:number};errors:unknown[]};
export function scheduledReconciliationReady(r:Report){
 return r.success&&!r.incomplete&&r.odooEmployeesFetched>0&&r.errors.length===0&&r.matches.unmatchedOdoo===0&&Object.values(r.plan).every(n=>n===0)&&r.verification.mismatchesRemaining===0;
}
