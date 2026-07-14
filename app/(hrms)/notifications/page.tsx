import { redirect } from "next/navigation";

export default function NotificationsRedirect() {
  redirect("/announcements?tab=notifications");
}
