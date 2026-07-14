import { redirect } from "next/navigation";

export default function HospitalsRedirect() {
  redirect("/branches?tab=hospitals");
}
