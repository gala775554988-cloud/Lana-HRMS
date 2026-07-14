import { redirect } from "next/navigation";

export default function MyTeamRedirect() {
  redirect("/employees?tab=my-team");
}
