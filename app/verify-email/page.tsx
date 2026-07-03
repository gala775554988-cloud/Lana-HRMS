import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { verifyEmailAction } from "@/lib/auth/actions";
import { getRequestDictionary } from "@/lib/i18n-server";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const { locale, dictionary } = await getRequestDictionary();
  const result = token
    ? await verifyEmailAction({ token })
    : { success: false, message: "Verification token is missing." };

  return (
    <AuthCard title="Account verification" description="Confirm account access for Lana HRMS." locale={locale} dictionary={dictionary}>
      <Alert variant={result.success ? "default" : "destructive"}>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
      <Button asChild className="w-full">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </AuthCard>
  );
}
