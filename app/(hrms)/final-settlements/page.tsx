import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { canApprovePayroll } from "@/lib/enterprise/payroll-permissions";
import { FinalSettlementWorkspace } from "@/components/payroll/final-settlement-workspace";
export const dynamic = "force-dynamic";
export default async function FinalSettlementsPage(){
  const session=await auth();
  if(!session?.user?.id) redirect("/login");
  if(!canApprovePayroll(session)) notFound();
  return <FinalSettlementWorkspace/>;
}
