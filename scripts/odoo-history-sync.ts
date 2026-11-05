/** Explicit operator CLI. Never scheduled or invoked during builds. */
import { readFile } from "node:fs/promises";
import { migrationConfigSchema, MigrationRecordError } from "../lib/integrations/odoo/migration/mapping";
let disconnect:(()=>Promise<void>)|undefined;
async function main() {
  const [command, target, actorId] = process.argv.slice(2);
  if (command === "--help" || !command) {
    console.log("Usage: npx tsx scripts/odoo-history-sync.ts start <config.json> <authorizedActorUserId> | resume <jobId> <authorizedActorUserId> | status <jobId> <authorizedActorUserId>");return;
  }
  if (!actorId || !target) throw new Error("Missing arguments");
  // The application's legacy client has eager schema repair. An ETL operator must
  // apply migrations explicitly; loading this CLI must never repair schema.
  process.env.SKIP_AUTO_DDL="true";
  const {prisma}=await import("../lib/prisma");disconnect=()=>prisma.$disconnect();
  const {createMigration,migrationStatus,processMigrationStep,controlMigration}=await import("../lib/integrations/odoo/migration/worker");
  const actor=await prisma.user.findUnique({where:{id:actorId},select:{isActive:true,roles:{select:{role:{select:{name:true}}}}}});
  if(!actor?.isActive||!actor.roles.some(entry=>["SUPER_ADMIN","HR_MANAGER"].includes(entry.role.name)))throw new Error("Authorized HR actor required");
  let id=target;
  if(command==="start")id=(await createMigration(migrationConfigSchema.parse(JSON.parse(await readFile(target,"utf8"))),actorId)).id;
  else if(command==="resume") {const job=await migrationStatus(id);if(job&&["PAUSED","FAILED"].includes(job.status))await controlMigration(id,"resume",actorId);}
  else if(command!=="status")throw new Error("Unknown command");
  let status=await migrationStatus(id);if(!status)throw new Error("Job unavailable");
  const report=()=>console.log(JSON.stringify({id:status!.id,status:status!.status,phase:status!.phase,month:status!.month,cursor:status!.cursor,processed:status!.processed,openErrors:status!.openErrors,progress:status!.progress}));
  report();
  if(command!=="status")while(["PENDING","RUNNING"].includes(status.status)){await processMigrationStep(id);status=(await migrationStatus(id))!;report();}
  if(status.openErrors||["FAILED","CANCELLED"].includes(status.status))process.exitCode=2;
}
main().catch(error=>{console.error(error instanceof MigrationRecordError?`${error.code}: ${error.message}`:"Migration did not complete. Check actor permissions, configuration and the saved job status.");process.exitCode=1;}).finally(()=>disconnect?.());
