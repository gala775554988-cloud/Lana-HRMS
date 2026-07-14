import { redirect } from "next/navigation";

export default function ShiftsRedirect() {
  redirect("/shifts-management?tab=shifts");
}
