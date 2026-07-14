import { redirect } from "next/navigation";

export default function ShiftAssignmentsRedirect() {
  redirect("/shifts-management?tab=shift-assignments");
}
