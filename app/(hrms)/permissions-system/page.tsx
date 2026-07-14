import { redirect } from "next/navigation";

export default function PermissionsSystemRedirect() {
  redirect("/permissions?tab=scopes");
}
