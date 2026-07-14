import { redirect } from "next/navigation";

export default function LeaveTypesRedirect() {
  redirect("/leaves?tab=leave-types");
}
