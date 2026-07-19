import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";

export default async function NotFound() {
  const session = await auth();
  
  const dashboardLink = session?.user ? "/" : "/login";
  const buttonText = session?.user ? "العودة إلى الداشبورد" : "تسجيل الدخول";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="max-w-md text-center">
        <p className="text-sm font-medium uppercase text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold">الصفحة غير موجودة</h1>
        <p className="mt-3 text-muted-foreground">الصفحة التي طلبتها غير موجودة أو لا تملك صلاحية الوصول إليها.</p>
        
        <div className="mt-6 flex flex-col gap-3 items-center">
          <Button asChild>
            <Link href={dashboardLink}>{buttonText}</Link>
          </Button>
          
          {session?.user && (
            <Link href="/login" className="text-sm text-muted-foreground hover:underline">
              تسجيل الدخول بحساب آخر
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}