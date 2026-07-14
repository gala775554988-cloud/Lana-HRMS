import { redirect } from "next/navigation";

export default function NotificationCenterRedirect() {
  redirect("/announcements?tab=notifications");
}
