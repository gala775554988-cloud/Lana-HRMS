import { redirect } from "next/navigation";

export default function ShiftsManagementRedirect() {
  redirect("/shifts?tab=shifts");
}
