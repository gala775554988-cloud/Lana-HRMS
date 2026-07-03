import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

export default function LogoutPage() {
  return (
    <AuthCard title="Sign out" description="End the current HRMS session on this device.">
      <form action={logoutAction} className="space-y-4">
        <Button type="submit" className="w-full">Sign out</Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">Stay signed in</Link>
        </Button>
      </form>
    </AuthCard>
  );
}
