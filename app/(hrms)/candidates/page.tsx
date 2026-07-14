import { redirect } from "next/navigation";

export default function CandidatesRedirect() {
  redirect("/recruitment?tab=candidates");
}
