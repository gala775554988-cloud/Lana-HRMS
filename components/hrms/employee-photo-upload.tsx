'use client';

import { useState, useTransition } from "react";
import { Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmployeePhotoUploadProps {
  employeeId?: string;
  currentPhoto?: string;
  onUploaded?: (url: string) => void;
  dictionary?: any;
}

export function EmployeePhotoUpload({ 
  employeeId, 
  currentPhoto, 
  onUploaded,
  dictionary 
}: EmployeePhotoUploadProps) {
  const [url, setUrl] = useState(currentPhoto || "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const t = dictionary?.upload || {
    photo: "Upload photo",
    upload: "Upload",
    uploading: "Uploading…",
    uploaded: "Uploaded successfully",
    error: "Upload failed",
    selectFile: "Select file"
  };

  async function handleUpload(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/uploads", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.url) {
          setUrl(data.url);
          setMessage(t.uploaded);
          onUploaded?.(data.url);
          
          // Optionally update employee record
          if (employeeId) {
            await fetch(`/api/hr/employees/${employeeId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ profilePhotoUrl: data.url }),
            });
          }
        } else {
          setMessage(data.message || t.error);
        }
      } catch (err) {
        setMessage(t.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? (
          <img 
            src={url} 
            alt="Employee photo" 
            className="h-14 w-14 rounded-full object-cover border ring-1 ring-offset-2 ring-slate-100"
          />
        ) : (
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <form action={handleUpload} className="flex-1">
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              name="file" 
              accept="image/*" 
              required 
              className="text-sm file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-100 file:text-xs file:font-medium" 
            />
            <Button 
              type="submit" 
              size="sm" 
              disabled={isPending}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {isPending ? t.uploading : t.upload}
            </Button>
          </div>
        </form>
      </div>

      {message && (
        <p className={`text-xs ${message.includes("success") ? "text-emerald-600" : "text-red-500"}`}>
          {message}
        </p>
      )}
      
      {url && <p className="text-[10px] text-muted-foreground truncate">{url}</p>}
    </div>
  );
}
