import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings } from "lucide-react";
import { getAppSetting, setAppSetting } from "@/lib/settings";

function scalarSetting(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return String((value as { value?: unknown }).value ?? fallback);
  return fallback;
}

async function saveSystemSettings(formData: FormData) {
  "use server";
  const entries = [
    ["company.name", formData.get("companyName"), "Company name"],
    ["company.logo", { url: String(formData.get("logoUrl") ?? "") }, "Company logo URL"],
    ["company.currency", formData.get("currency"), "Default currency"],
    ["company.timezone", formData.get("timezone"), "Default timezone"],
    ["company.theme", formData.get("theme"), "Default theme"],
    ["integration.smtp", formData.get("smtp"), "SMTP configuration"],
    ["integration.sms", formData.get("sms"), "SMS provider configuration"],
    ["integration.whatsapp", formData.get("whatsapp"), "WhatsApp provider configuration"],
    ["integration.apiKeys", formData.get("apiKeys"), "External API keys configuration"],
  ] as const;

  for (const [key, rawValue, description] of entries) {
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    await setAppSetting(key, value, description);
  }
  revalidatePath("/");
  revalidatePath("/system-settings");
}

export default async function SystemSettingsPage() {
  const [companyName, logo, currency, timezone, theme, smtp, sms, whatsapp, apiKeys] = await Promise.all([
    getAppSetting("company.name", ""),
    getAppSetting("company.logo", { url: "" }),
    getAppSetting("company.currency", "SAR"),
    getAppSetting("company.timezone", "Asia/Riyadh"),
    getAppSetting("company.theme", "corporate"),
    getAppSetting("integration.smtp", ""),
    getAppSetting("integration.sms", ""),
    getAppSetting("integration.whatsapp", ""),
    getAppSetting("integration.apiKeys", ""),
  ]);
  const logoUrl = logo && typeof logo === "object" && "url" in logo ? String((logo as { url?: unknown }).url ?? "") : scalarSetting(logo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
          <Settings className="h-8 w-8" />
          إعدادات النظام العامة
        </h1>
        <p className="text-muted-foreground mt-2">بيانات الشركة، الشعار، العملة، المنطقة الزمنية، وقنوات التكامل.</p>
      </div>

      <form action={saveSystemSettings} className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>بيانات الشركة</CardTitle>
            <CardDescription>تُقرأ هذه القيم من جدول AppSetting وتُحفظ مباشرة في قاعدة البيانات.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">اسم الشركة</span>
              <Input name="companyName" defaultValue={scalarSetting(companyName)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">رابط الشعار</span>
              <Input name="logoUrl" defaultValue={logoUrl} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">العملة</span>
              <Input name="currency" defaultValue={scalarSetting(currency, "SAR")} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">المنطقة الزمنية</span>
              <Input name="timezone" defaultValue={scalarSetting(timezone, "Asia/Riyadh")} />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">الثيم الافتراضي</span>
              <Input name="theme" defaultValue={scalarSetting(theme, "corporate")} />
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>قنوات الإرسال والتكامل</CardTitle>
            <CardDescription>احفظ إعدادات المزودين بصيغة نصية أو JSON حسب المزود المستخدم.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="space-y-2 text-sm block">
              <span className="font-medium">SMTP</span>
              <textarea name="smtp" defaultValue={scalarSetting(smtp)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="space-y-2 text-sm block">
              <span className="font-medium">SMS</span>
              <textarea name="sms" defaultValue={scalarSetting(sms)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="space-y-2 text-sm block">
              <span className="font-medium">WhatsApp</span>
              <textarea name="whatsapp" defaultValue={scalarSetting(whatsapp)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </label>
            <label className="space-y-2 text-sm block">
              <span className="font-medium">API Keys</span>
              <textarea name="apiKeys" defaultValue={scalarSetting(apiKeys)} className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" />
            </label>
            <Button type="submit" className="w-full">حفظ الإعدادات</Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
