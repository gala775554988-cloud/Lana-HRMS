import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { getRequestDictionary } from "@/lib/i18n-server";

export default async function LogoutPage() {
  const { locale, dictionary } = await getRequestDictionary();

  return (
    <AuthCard title="Sign out" description="End the current HRMS session on this device." locale={locale} dictionary={dictionary}>
      <form action={logoutAction} className="space-y-4">
        <Button type="submit" className="w-full">{dictionary.common.signOut}</Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">Stay signed in</Link>
        </Button>
      </form>
    </AuthCard>
  );
}
