import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clearPasswordChangeRequirement, isPasswordChangeRequired } from "@/lib/auth/password-change-policy";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function changePasswordAction(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  
  if (!currentPassword || !password || !confirmPassword) {
    redirect("/employee/settings/password?error=missing");
  }
  
  if (password.length < 8 || password !== confirmPassword) {
    redirect("/employee/settings/password?error=validation");
  }

  // Strong password check
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
    redirect("/employee/settings/password?error=weak");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) {
    redirect("/employee/settings/password?error=user");
  }

  const currentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentValid) {
    redirect("/employee/settings/password?error=current");
  }

  if (currentPassword === password) {
    redirect("/employee/settings/password?error=same");
  }

  await prisma.user.update({ 
    where: { id: session.user.id }, 
    data: { 
      passwordHash: await hashPassword(password),
      mustChangePassword: false,
      passwordChanged: true,
      passwordChangedAt: new Date(),
    } 
  });
  
  await clearPasswordChangeRequirement(session.user.id);
  
  await writeAuditLog({
    actorUserId: session.user.id,
    action: "PASSWORD_CHANGED",
    entity: "user",
    entityId: session.user.id,
    metadata: { self: true, via: "employee_settings" },
  }).catch(() => {});

  revalidatePath("/employee/settings/password");
  redirect("/employee/dashboard?passwordChanged=1");
}

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const params = await searchParams;
  const required = await isPasswordChangeRequired(session.user.id);

  const errorMessages: Record<string, string> = {
    "1": "تأكد أن كلمة المرور 8 أحرف على الأقل وأن التأكيد مطابق.",
    "missing": "جميع الحقول مطلوبة: الحالية، الجديدة، والتأكيد.",
    "validation": "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتطابق التأكيد.",
    "weak": "كلمة المرور يجب أن تحتوي على حرف كبير، صغير، رقم، ورمز.",
    "current": "كلمة المرور الحالية غير صحيحة.",
    "same": "كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية.",
    "user": "المستخدم غير موجود.",
  };

  const errorKey = params.error || "";
  const errorText = errorMessages[errorKey] || (errorKey ? "حدث خطأ أثناء تغيير كلمة المرور." : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>تغيير كلمة المرور</CardTitle>
        <CardDescription>
          {required ? "يجب تغيير كلمة المرور الافتراضية (آخر 4 أرقام من الهوية) قبل استخدام النظام." : "يمكنك تغيير كلمة المرور في أي وقت بعد إدخال الحالية."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {required ? <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">يجب تغيير كلمة المرور الافتراضية قبل استخدام النظام. كلمة المرور الحالية هي آخر 4 أرقام من رقم الهوية.</p> : null}
        {errorText ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorText}</p> : null}
        <form action={changePasswordAction} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">كلمة المرور الحالية</Label>
            <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" placeholder="أدخل كلمة المرور الحالية" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور الجديدة</Label>
            <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="8 أحرف على الأقل، كبير، صغير، رقم، رمز" />
            <p className="text-xs text-muted-foreground">يجب أن تحتوي على حرف كبير، صغير، رقم، ورمز</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" minLength={8} required autoComplete="new-password" placeholder="أعد إدخال الجديدة" />
          </div>
          <Button type="submit">حفظ كلمة المرور الجديدة</Button>
        </form>
        <div className="mt-6 text-xs text-muted-foreground rounded-lg bg-slate-50 p-3 dark:bg-slate-900/50">
          <strong>ملاحظة:</strong> إذا نسيت كلمة المرور يرجى مراجعة إدارة الموارد البشرية. لا يوجد خيار نسيت كلمة المرور.
        </div>
      </CardContent>
    </Card>
  );
}
