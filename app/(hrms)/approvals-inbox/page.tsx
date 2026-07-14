import { redirect } from "next/navigation";

export default function ApprovalsInboxRedirect() {
  redirect("/approvals?tab=inbox");
}
