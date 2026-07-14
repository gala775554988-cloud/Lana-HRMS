import { redirect } from "next/navigation";

export default function LeaveRedirect() {
  redirect("/leaves?tab=leave-requests");
}
