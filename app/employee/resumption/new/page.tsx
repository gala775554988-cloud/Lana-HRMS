"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarCheck2, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function NewResumptionRequestPage() {
  const router = useRouter();
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [resumptionType, setResumptionType] = useState("AFTER_LEAVE");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!returnDate) {
      setError("يرجى تحديد تاريخ المباشرة الفعلية للعمل.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/hr/my-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "resumption",
          returnDate,
          resumptionType,
          reason,
          notes
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || "تعذر تقديم طلب المباشرة");
      }
      router.push("/employee/resumption");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ في الاتصال بالخادم");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="rounded-xl">
          <Link href="/employee/resumption"><ArrowRight className="h-5 w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-black">تقديم طلب مباشرة عمل بعد الإجازة</h1>
          <p className="text-xs font-semibold text-muted-foreground">توثيق تاريخ عودتك للعمل وبدء سريان مسير الرواتب والموافقات</p>
        </div>
      </div>

      <Card className="rounded-3xl border border-slate-200/80 shadow-lg dark:border-slate-800">
        <CardHeader className="bg-slate-50/70 border-b pb-4 dark:bg-slate-900/50">
          <CardTitle className="text-base font-extrabold flex items-center gap-2 text-teal-800 dark:text-teal-300">
            <CalendarCheck2 className="h-5 w-5" />
            <span>بيانات المباشرة الفعلية</span>
          </CardTitle>
          <CardDescription className="text-xs">تأكد من إدخال التاريخ الدقيق الذي باشرت فيه مهامك في مقر العمل أو الموقع التشغيلي</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold text-xs dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                ⚠️ {error}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="returnDate" className="font-extrabold text-sm">١. تاريخ المباشرة الفعلية للعمل *</Label>
              <Input
                id="returnDate"
                type="date"
                required
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="h-11 rounded-2xl font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resumptionType" className="font-extrabold text-sm">٢. نوع الإجازة أو المهمة السابقة *</Label>
              <select
                id="resumptionType"
                value={resumptionType}
                onChange={(e) => setResumptionType(e.target.value)}
                className="flex h-11 w-full rounded-2xl border border-input bg-background px-3.5 py-2 text-sm font-bold shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value="AFTER_LEAVE">بعد إجازة سنوية / اعتيادية</option>
                <option value="AFTER_SICK">بعد إجازة مرضية</option>
                <option value="AFTER_MISSION">بعد انتداب / مهمة عمل رسمية</option>
                <option value="OTHER">أخرى</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="font-extrabold text-sm">٣. مرجع العودة أو رقم طلب الإجازة السابق (اختياري)</Label>
              <Input
                id="reason"
                type="text"
                placeholder="مثال: عودة بعد انتهاء طلب إجازة سنوية رقم #1042..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-11 rounded-2xl font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="font-extrabold text-sm">٤. ملاحظات إضافية حول العودة للمشرف أو شؤون الموظفين (اختياري)</Label>
              <Textarea
                id="notes"
                placeholder="أدخل أي تفاصيل أو شروحات إضافية هنا..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-2xl min-h-[100px] font-medium"
              />
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <Button type="button" variant="outline" asChild className="rounded-2xl h-11 px-6 font-bold">
                <Link href="/employee/resumption">إلغاء</Link>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-black rounded-2xl h-11 px-8 shadow-lg shadow-teal-600/25"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <CalendarCheck2 className="h-4 w-4 me-2" />}
                <span>إرسال طلب المباشرة للاعتماد</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
