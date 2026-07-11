"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ForceChangePasswordForm({ dictionary }: { dictionary: any }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("جميع الحقول مطلوبة");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("كلمة المرور الجديدة وتأكيدها غير متطابقين");
      return;
    }

    if (newPassword.length < 8) {
      setMessage("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
      return;
    }

    if (newPassword === currentPassword) {
      setMessage("كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/force-change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        const json = await res.json();
        if (json.success) {
          // Success - redirect to dashboard
          router.push("/");
          router.refresh();
        } else {
          setMessage(json.message || "فشل تغيير كلمة المرور");
        }
      } catch (err) {
        setMessage("حدث خطأ أثناء تغيير كلمة المرور");
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {message && (
        <Alert variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="currentPassword">كلمة المرور الحالية (آخر 4 أرقام من الهوية)</Label>
        <div className="relative">
          <Input
            id="currentPassword"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-11 px-9"
            placeholder="مثال: 9068"
            required
          />
          <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-3">
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
        <div className="relative">
          <Input
            id="newPassword"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-11 px-9"
            placeholder="8 أحرف على الأقل، حرف كبير، صغير، رقم، رمز"
            required
          />
          <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-3">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">يجب أن تحتوي على حرف كبير، صغير، رقم، ورمز، 8 أحرف على الأقل</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-11 px-9"
            placeholder="أعد إدخال كلمة المرور الجديدة"
            required
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-3">
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button type="submit" className="w-full h-12 text-base font-bold" disabled={isPending}>
        {isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
        تغيير كلمة المرور والدخول للنظام
      </Button>

      <div className="text-center text-xs text-muted-foreground">
        إذا نسيت كلمة المرور يرجى مراجعة إدارة الموارد البشرية
      </div>
    </form>
  );
}
