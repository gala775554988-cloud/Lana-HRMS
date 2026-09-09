import { redirect } from "next/navigation";

export default function SocialInsurancePage() {
  redirect("/insurance?tab=social");
}
