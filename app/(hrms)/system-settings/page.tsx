import { redirect } from "next/navigation";

export default function SystemSettingsRedirect() {
  redirect("/settings?tab=general");
}
