import { redirect } from "next/navigation";

export default function AllowancesRedirect() {
  redirect("/payroll?tab=allowances");
}
