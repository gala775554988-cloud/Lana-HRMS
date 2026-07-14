import { redirect } from "next/navigation";

export default function AttendanceSitesRedirect() {
  redirect("/biometrics?tab=attendance-sites");
}
