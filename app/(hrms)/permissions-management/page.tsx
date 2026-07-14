import { redirect } from "next/navigation";

export default function PermissionsManagementRedirect() {
  redirect("/permissions?tab=management");
}
