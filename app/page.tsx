import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-3xl space-y-6">
        <p className="text-sm font-medium uppercase text-muted-foreground">HRMS Foundation</p>
        <h1 className="text-4xl font-semibold">Human Resource Management System</h1>
        <p className="text-lg text-muted-foreground">
          Authentication, authorization, JWT sessions, and RBAC are ready for protected HR workflows.
        </p>
        <Button asChild>
          <Link href={session?.user ? "/dashboard" : "/login"}>
            {session?.user ? "Open session" : "Sign in"}
          </Link>
        </Button>
      </section>
    </main>
  );
}
