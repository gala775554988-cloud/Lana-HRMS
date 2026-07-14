import { redirect } from "next/navigation";

export default function LeaveRequestsRedirect() {
  redirect("/leaves?tab=leave-requests");
}
