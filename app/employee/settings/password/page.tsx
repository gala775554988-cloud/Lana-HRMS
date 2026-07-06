import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { clearPasswordChangeRequirement, isPasswordChangeRequired } from "@/lib/auth/password-change-policy";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function changePasswordAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8 || password !== confirmPassword) {
    redirect("/employee/settings/password?error=1");
  }
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash: await hashPassword(password) } });
  await clearPasswordChangeRequirement(session.user.id);
  revalidatePath("/employee/settings/password");
  redirect("/employee/dashboard");
}

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  const required = await isPasswordChangeRequired(session.user.id);

  return (
    <Card>
      <CardHeader><CardTitle>تغيير كلمة المرور</CardTitle></CardHeader>
      <CardContent>
        {required ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">يجب تغيير كلمة المرور الافتراضية قبل استخدام النظام.</p> : null}
        {params.error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">تأكد أن كلمة المرور 8 أحرف على الأقل وأن التأكيد مطابق.</p> : null}
        <form action={changePasswordAction} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" />
          </div>
          <Button type="submit">حفظ كلمة المرور</Button>
        </form>
      </CardContent>
    </Card>
  );
}
