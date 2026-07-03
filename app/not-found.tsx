import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-medium uppercase text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">The HRMS page you requested does not exist or you do not have access to it.</p>
        <Button asChild className="mt-6"><Link href="/dashboard">Back to dashboard</Link></Button>
      </section>
    </main>
  );
}