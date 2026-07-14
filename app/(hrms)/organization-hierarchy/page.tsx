import { redirect } from "next/navigation";

export default function OrganizationHierarchyRedirect() {
  redirect("/employees?tab=hierarchy");
}
