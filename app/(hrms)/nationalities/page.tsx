import { redirect } from "next/navigation";

export default function NationalitiesRedirect() {
  redirect("/setup?tab=nationalities");
}
