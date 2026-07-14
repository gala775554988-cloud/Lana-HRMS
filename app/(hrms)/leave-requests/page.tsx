import { redirect } from "next/navigation";

export default function LeaveRequestsRedirect() {
  redirect("/leave?tab=leave-requests");
}
