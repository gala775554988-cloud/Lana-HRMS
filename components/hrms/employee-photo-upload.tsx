'use client';

import { ChangeEvent, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmployeePhotoUploadProps {
  employeeId?: string;
  currentPhoto?: string;
  onUploaded?: (url: string) => void;
  onRemoved?: () => void;
  dictionary?: any;
  large?: boolean;
}

export function EmployeePhotoUpload({
  employeeId,
  currentPhoto,
  onUploaded,
  onRemoved,
  dictionary,
  large = false
}: EmployeePhotoUploadProps) {
  const [url, setUrl] = useState(currentPhoto || "");
  const [preview, setPreview] = useState(currentPhoto || "");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUrl(currentPhoto || "");
    setPreview(currentPhoto || "");
  }, [currentPhoto]);

  const t = dictionary?.upload || {
    photo: "رفع صورة",
    upload: "رفع صورة",
    uploading: "جاري الرفع…",
    uploaded: "تم الرفع بنجاح",
    error: "فشل الرفع",
    selectFile: "اختر ملف"
  };

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setMessage(null);
    setFile(nextFile);
    if (!nextFile) return;
    const objectUrl = URL.createObjectURL(nextFile);
    setPreview(objectUrl);
  }

  async function persistEmployeePhoto(nextUrl: string | null) {
    if (!employeeId) return;
    await fetch(`/api/hr/employees/${employeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profilePhotoUrl: nextUrl ?? "" })
    });
  }

  async function handleUpload() {
    if (!file) {
      inputRef.current?.click();
      return;
    }
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      try {
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setUrl(data.url);
          setPreview(data.url);
          setFile(null);
          setMessage(t.uploaded);
          onUploaded?.(data.url);
          await persistEmployeePhoto(data.url);
        } else {
          setMessage(data.message || t.error);
        }
      } catch {
        setMessage(t.error);
      }
    });
  }

  function handleRemove() {
    setUrl("");
    setPreview("");
    setFile(null);
    setMessage(null);
    if (inputRef.current) inputRef.current.value = "";
    onRemoved?.();
    startTransition(async () => {
      await persistEmployeePhoto(null).catch(() => null);
    });
  }

  const imageClassName = large
    ? "h-36 w-36 rounded-2xl sm:h-44 sm:w-44"
    : "h-14 w-14 rounded-xl";

  return (
    <div className={large ? "rounded-2xl border bg-muted/30 p-4" : "space-y-2"}>
      <div className={large ? "flex flex-col items-center gap-4 text-center" : "flex items-center gap-3"}>
        {preview ? (
          <img src={preview} alt="Employee photo" className={`${imageClassName} border object-cover shadow-sm ring-1 ring-slate-100`} />
        ) : (
          <div className={`${imageClassName} flex items-center justify-center border bg-background text-muted-foreground shadow-sm`}>
            <User className={large ? "h-14 w-14" : "h-6 w-6"} />
          </div>
        )}

        <div className={large ? "w-full space-y-3" : "flex-1 space-y-2"}>
          <input ref={inputRef} type="file" name="file" accept="image/*" onChange={handleSelect} className="hidden" />
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-1.5">
              <ImagePlus className="h-3.5 w-3.5" />
              {url || preview ? "تغيير الصورة" : t.selectFile}
            </Button>
            <Button type="button" size="sm" disabled={isPending || !file} onClick={handleUpload} className="gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              {isPending ? t.uploading : t.upload}
            </Button>
            {(url || preview) ? (
              <Button type="button" variant="destructive" size="sm" disabled={isPending} onClick={handleRemove} className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                حذف الصورة
              </Button>
            ) : null}
          </div>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
          {url ? <p className="truncate text-[10px] text-muted-foreground">{url}</p> : null}
        </div>
      </div>
    </div>
  );
}
