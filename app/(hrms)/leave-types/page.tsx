import { redirect } from "next/navigation";

export default function LeaveTypesRedirect() {
  redirect("/leave?tab=leave-types");
}
