import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { verifyEmailAction } from "@/lib/auth/actions";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const result = token
    ? await verifyEmailAction({ token })
    : { success: false, message: "Verification token is missing." };

  return (
    <AuthCard title="Email verification" description="Confirm your email address to activate account access.">
      <Alert variant={result.success ? "default" : "destructive"}>
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
      <Button asChild className="w-full">
        <Link href="/login">Go to sign in</Link>
      </Button>
    </AuthCard>
  );
}
