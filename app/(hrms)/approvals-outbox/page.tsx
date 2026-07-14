import { redirect } from "next/navigation";

export default function ApprovalsOutboxRedirect() {
  redirect("/approvals?tab=outbox");
}
