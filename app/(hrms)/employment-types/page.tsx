import { redirect } from "next/navigation";

export default function EmploymentTypesRedirect() {
  redirect("/setup?tab=employment-types");
}
