import { redirect } from "next/navigation";

export default function TrainingEnrollmentsRedirect() {
  redirect("/training?tab=training-enrollments");
}
