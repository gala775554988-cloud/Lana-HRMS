import { redirect } from "next/navigation";

export default function RequestCenterRedirect() {
  redirect("/approvals?tab=center");
}
