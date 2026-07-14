import { redirect } from "next/navigation";

export default function DeductionsRedirect() {
  redirect("/payroll?tab=deductions");
}
