import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getRequestDictionary } from "@/lib/i18n-server";
import { FileUpload } from "@/components/hrms/file-upload";
import Link from "next/link";

export default async function SettingsPage() {
  const { dictionary } = await getRequestDictionary();
  const t = (dictionary as any).settings || {
    title: "Company Settings",
    branding: "Branding",
    companyLogo: "Company Logo",
    companyLogoDesc: "Upload a logo that will appear in the header and reports.",
    uploadLogo: "Upload Logo",
    currentLogo: "Current Logo",
    logoUrl: "Logo URL",
    saveBranding: "Save Branding",
    saved: "Settings saved successfully."
  };

  return (
    <section className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground mt-1">Manage branding, integrations and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.branding}</CardTitle>
          <CardDescription>{t.companyLogoDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 block">{t.companyLogo}</label>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="flex-1">
                <FileUpload />
              </div>
              
              <div className="text-sm">
                <div className="font-medium mb-1">{t.currentLogo}</div>
                <div className="flex items-center gap-2">
                  <img 
                    src="/uploads/default-logo.png" 
                    alt="Company logo" 
                    className="h-12 w-auto border rounded bg-white p-1" 
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/120x48?text=LOGO" }} 
                  />
                  <span className="text-xs text-muted-foreground">Default or last uploaded</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-sm font-medium block mb-1.5">{t.logoUrl}</label>
            <div className="flex gap-2">
              <Input placeholder="https://.../logo.png" className="flex-1" />
              <Button variant="outline">{t.saveBranding}</Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">You can also paste a direct URL to the logo.</p>
          </div>

          <div className="pt-3 border-t text-xs text-muted-foreground">
            {t.saved}
          </div>
        </CardContent>
      </Card>

      <div className="text-xs text-center text-muted-foreground">
        <Link href="/settings" className="underline">Advanced settings</Link> &nbsp; • &nbsp; 
        Settings are stored in the database (AppSetting).
      </div>
    </section>
  );
}
