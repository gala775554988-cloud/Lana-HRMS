import { revalidatePath } from "next/cache";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAppSetting, setAppSetting } from "@/lib/settings";
import { LogoUploadField } from "@/components/hrms/logo-upload-field";
import { SettingsFormClient } from "@/components/hrms/settings-form-client";
import { SidebarColorSliderClient } from "@/components/hrms/sidebar-color-slider";
import { ThemeModeCard } from "@/components/hrms/theme-mode-card";
import type { ToastState } from "@/components/ui/toast-message";

function scalarSetting(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) return String((value as { value?: unknown }).value ?? fallback);
  return fallback;
}

function boolSetting(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value?: unknown }).value;
    if (typeof inner === "boolean") return inner;
  }
  return fallback;
}

async function saveSystemSettings(_prevState: ToastState, formData: FormData): Promise<ToastState> {
  "use server";
  const entries = [
    ["company.name", formData.get("companyName"), "Company name"],
    ["company.logo", { url: String(formData.get("logoUrl") ?? "") }, "Company logo URL"],
    ["company.currency", formData.get("currency"), "Default currency"],
    ["company.timezone", formData.get("timezone"), "Default timezone"],
    ["company.theme", formData.get("theme"), "Default theme"],
    ["company.crNumber", formData.get("crNumber"), "Commercial registration number"],
    ["company.taxId", formData.get("taxId"), "Tax identification number"],
    ["company.address", formData.get("address"), "Company address"],
    ["integration.smtp", formData.get("smtp"), "SMTP configuration"],
    ["integration.sms", formData.get("sms"), "SMS provider configuration"],
    ["integration.whatsapp", formData.get("whatsapp"), "WhatsApp provider configuration"],
    ["integration.apiKeys", formData.get("apiKeys"), "External API keys configuration"],
    ["integration.odoo.enabled", formData.get("odooEnabled") === "on", "Odoo sync enabled"],
    ["integration.sms.enabled", formData.get("smsEnabled") === "on", "SMS sending enabled"],
    ["integration.whatsapp.enabled", formData.get("whatsappEnabled") === "on", "WhatsApp sending enabled"],
  ] as const;

  try {
    for (const [key, rawValue, description] of entries) {
      const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
      await setAppSetting(key, value, description);
    }
    revalidatePath("/");
    revalidatePath("/settings");
    return { success: true, message: "تم حفظ الإعدادات بنجاح" };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "فشل حفظ الإعدادات" };
  }
}

export async function SystemSettingsBody() {
  const [companyName, logo, currency, timezone, theme, crNumber, taxId, address, smtp, sms, whatsapp, apiKeys, odooEnabled, smsEnabled, whatsappEnabled] = await Promise.all([
    getAppSetting("company.name", ""),
    getAppSetting("company.logo", { url: "" }),
    getAppSetting("company.currency", "SAR"),
    getAppSetting("company.timezone", "Asia/Riyadh"),
    getAppSetting("company.theme", "corporate"),
    getAppSetting("company.crNumber", ""),
    getAppSetting("company.taxId", ""),
    getAppSetting("company.address", ""),
    getAppSetting("integration.smtp", ""),
    getAppSetting("integration.sms", ""),
    getAppSetting("integration.whatsapp", ""),
    getAppSetting("integration.apiKeys", ""),
    getAppSetting("integration.odoo.enabled"),
    getAppSetting("integration.sms.enabled"),
    getAppSetting("integration.whatsapp.enabled"),
  ]);
  const logoUrl = logo && typeof logo === "object" && "url" in logo ? String((logo as { url?: unknown }).url ?? "") : scalarSetting(logo);

  return (
    <div className="space-y-6">
      <ThemeModeCard />
      <SidebarColorSliderClient />
      <SettingsFormClient action={saveSystemSettings}>
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
              <span className="font-medium">شعار الشركة</span>
              <LogoUploadField name="logoUrl" defaultValue={logoUrl} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">العملة</span>
              <Input name="currency" defaultValue={scalarSetting(currency, "SAR")} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">المنطقة الزمنية</span>
              <Input name="timezone" defaultValue={scalarSetting(timezone, "Asia/Riyadh")} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">الثيم الافتراضي</span>
              <Input name="theme" defaultValue={scalarSetting(theme, "corporate")} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">السجل التجاري (CR)</span>
              <Input name="crNumber" defaultValue={scalarSetting(crNumber)} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">الرقم الضريبي</span>
              <Input name="taxId" defaultValue={scalarSetting(taxId)} />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium">العنوان</span>
              <Input name="address" defaultValue={scalarSetting(address)} />
            </label>
          </CardContent>
        </Card>

        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>تفعيل الميزات</CardTitle>
            <CardDescription>تحكم بتشغيل أو إيقاف عمليات المزامنة والإرسال الخارجية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
              <span>
                <span className="block font-medium">مزامنة Odoo</span>
                <span className="block text-xs text-muted-foreground">إيقافها يمنع أي عملية مزامنة فعلية مع Odoo فوراً.</span>
              </span>
              <input type="checkbox" name="odooEnabled" defaultChecked={boolSetting(odooEnabled, true)} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm opacity-70">
              <span>
                <span className="block font-medium">إرسال SMS</span>
                <span className="block text-xs text-muted-foreground">لا يوجد مزود إرسال فعلي متصل بعد — هذا المفتاح مجرد إعداد أولي.</span>
              </span>
              <input type="checkbox" name="smsEnabled" defaultChecked={boolSetting(smsEnabled, false)} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm opacity-70">
              <span>
                <span className="block font-medium">إرسال واتساب</span>
                <span className="block text-xs text-muted-foreground">لا يوجد مزود إرسال فعلي متصل بعد — هذا المفتاح مجرد إعداد أولي.</span>
              </span>
              <input type="checkbox" name="whatsappEnabled" defaultChecked={boolSetting(whatsappEnabled, false)} className="h-4 w-4" />
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
          </CardContent>
        </Card>
        </div>
      </SettingsFormClient>
    </div>
  );
}
