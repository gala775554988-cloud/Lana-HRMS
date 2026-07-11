import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// The executive dashboard was intentionally removed from the latest UX.
// Keep this route as a safe compatibility redirect so old cached links do not
// show the previous dashboard or a 404.
export default function HrmsDashboardRedirect() {
  redirect("/employees");
}
