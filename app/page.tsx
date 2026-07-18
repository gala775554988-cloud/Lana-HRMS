import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { resolveRoleDashboard } from "@/config/auth";
import { getRequestLocale } from "@/lib/i18n-server";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    const roles = (session.user.roles as string[]) || [];
    redirect(resolveRoleDashboard(roles));
  }
  const locale = await getRequestLocale();
  return <LandingPage locale={locale} />;
}
