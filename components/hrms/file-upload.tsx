'use client';

import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FileUploadProps {
  onUploaded?: (url: string) => void;
  label?: string;
}

export function FileUpload({ onUploaded, label = "Upload" }: FileUploadProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function upload(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Upload failed" }));
          setMessage(errorData.message || "Upload failed");
          return;
        }

        const result = await response.json();
        if (result.url) {
          setMessage("Uploaded: " + result.url);
          onUploaded?.(result.url);
        } else {
          setMessage(result.message || "Upload failed");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Upload failed");
      }
    });
  }

  return (
    <form action={upload} className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center">
      <Input type="file" name="file" required />
      <Button type="submit" disabled={isPending}>
        <Upload className="mr-2 h-4 w-4" /> {label}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
