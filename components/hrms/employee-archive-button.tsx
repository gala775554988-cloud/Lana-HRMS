"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  employeeId: string;
  status: string;
  locale?: string;
}

export function EmployeeArchiveButton({ employeeId, status, locale = "ar" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isArchived = status === "INACTIVE" || status === "TERMINATED";

  const handleArchive = async () => {
    const isAr = locale === "ar";
    const reason = isArchived ? "" : prompt(isAr ? "سبب الأرشفة (اختياري):" : "Archive reason (optional):") || "";
    // If user cancels prompt when archiving, reason will be null? Actually prompt returns null if cancelled, we check
    if (!isArchived && reason === null) return;

    setLoading(true);
    try {
      const res = await fetch("/api/employees/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, archiveReason: reason, unarchive: isArchived }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        router.refresh();
      } else {
        alert("خطأ: " + json.message);
      }
    } catch (e) {
      alert("خطأ في الأرشفة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isArchived ? "outline" : "destructive"}
      size="sm"
      onClick={handleArchive}
      disabled={loading}
      className="gap-2"
    >
      {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
      {isArchived ? (locale === "ar" ? "إلغاء الأرشفة" : "Unarchive") : (locale === "ar" ? "أرشفة الموظف" : "Archive Employee")}
    </Button>
  );
}
