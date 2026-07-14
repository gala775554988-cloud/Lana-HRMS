import { redirect } from "next/navigation";

export default function PayrollItemsRedirect() {
  redirect("/payroll?tab=payroll-items");
}
