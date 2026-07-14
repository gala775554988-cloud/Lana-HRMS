import { redirect } from "next/navigation";

export default function PayrollRunsRedirect() {
  redirect("/payroll?tab=payroll-runs");
}
