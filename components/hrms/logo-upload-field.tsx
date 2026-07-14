"use client";

import { useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

export function LogoUploadField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [url, setUrl] = useState(defaultValue);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({ success: false }));
      if (result.success && result.url) {
        setUrl(result.url);
      } else {
        setError(result.message || "فشل رفع الشعار");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل رفع الشعار");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        {url ? (
          <img src={url} alt="شعار الشركة" className="h-14 w-14 rounded-md border bg-white object-contain p-1" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground">لا يوجد</div>
        )}
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" />
            {isUploading ? "جارٍ الرفع..." : "رفع شعار جديد"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isUploading} />
        </label>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
