'use client';

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/hrms/file-upload";
import Link from "next/link";

export default function SettingsPage() {
  const [logoUrl, setLogoUrl] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const t = {
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

  const handleLogoUploaded = async (url: string) => {
    setLogoUrl(url);
    await saveLogoToServer(url);
  };

  const saveLogoToServer = async (url: string) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        setSavedMessage(t.saved);
        setTimeout(() => setSavedMessage(""), 2500);
      }
    } catch (e) {
      console.error("Failed to save logo");
    } finally {
      setIsSaving(false);
    }
  };

  const saveManualUrl = async () => {
    if (!logoUrl.trim()) return;
    await saveLogoToServer(logoUrl.trim());
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
                <FileUpload onUploaded={handleLogoUploaded} />
              </div>
              
              <div className="text-sm">
                <div className="font-medium mb-1">{t.currentLogo}</div>
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Company logo" 
                      className="h-12 w-auto border rounded bg-white p-1 max-w-[140px] object-contain" 
                    />
                  ) : (
                    <img 
                      src="/uploads/default-logo.png" 
                      alt="Company logo" 
                      className="h-12 w-auto border rounded bg-white p-1" 
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://placehold.co/120x48?text=LOGO" }} 
                    />
                  )}
                  <span className="text-xs text-muted-foreground">Default or last uploaded</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <label className="text-sm font-medium block mb-1.5">{t.logoUrl}</label>
            <div className="flex gap-2">
              <Input 
                placeholder="https://.../logo.png" 
                value={logoUrl} 
                onChange={(e) => setLogoUrl(e.target.value)} 
                className="flex-1" 
              />
              <Button 
                variant="outline" 
                onClick={saveManualUrl}
                disabled={isSaving || !logoUrl.trim()}
              >
                {t.saveBranding}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">You can also paste a direct URL to the logo.</p>
          </div>

          {savedMessage && (
            <div className="pt-3 border-t text-xs text-emerald-600 font-medium">
              {savedMessage}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-center text-muted-foreground">
        <Link href="/settings" className="underline">Advanced settings</Link> &nbsp; • &nbsp; 
        Settings are stored in the database (AppSetting).
      </div>
    </section>
  );
}

