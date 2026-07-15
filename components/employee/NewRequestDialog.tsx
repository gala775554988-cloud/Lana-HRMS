"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { REQUEST_TYPE_CONFIG, getRequestTypeConfig } from "@/lib/employee/request-form-config";

const SELECT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [typeCode, setTypeCode] = useState(REQUEST_TYPE_CONFIG[0].code);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(() => getRequestTypeConfig(typeCode) ?? REQUEST_TYPE_CONFIG[0], [typeCode]);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/hr/my-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeCode.toLowerCase(), ...values }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message || data?.message || "تعذر إرسال الطلب");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-requests"] });
      setValues({});
      setError(null);
      onOpenChange(false);
    },
    onError: (err: Error) => setError(err.message),
  });

  function selectType(code: string) {
    setTypeCode(code);
    setValues({});
    setError(null);
  }

  function updateField(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    for (const field of config.fields) {
      if (field.required && !values[field.name]) {
        setError(`حقل "${field.label}" مطلوب`);
        return;
      }
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>طلب جديد</DialogTitle>
          <DialogClose onClick={() => onOpenChange(false)} />
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>نوع الطلب</Label>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPE_CONFIG.map((item) => (
                <Button
                  key={item.code}
                  type="button"
                  size="sm"
                  variant={typeCode === item.code ? "default" : "outline"}
                  onClick={() => selectType(item.code)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {config.fields.map((field) => (
              <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label htmlFor={field.name}>
                  {field.label}{field.required ? <span className="text-rose-600"> *</span> : null}
                </Label>
                {field.kind === "textarea" ? (
                  <Textarea
                    id={field.name}
                    value={values[field.name] ?? ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                  />
                ) : field.kind === "select" ? (
                  <select
                    id={field.name}
                    className={SELECT_CLASS}
                    value={values[field.name] ?? ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                  >
                    <option value="" disabled>اختر...</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={field.name}
                    type={field.kind}
                    value={values[field.name] ?? ""}
                    onChange={(e) => updateField(field.name, e.target.value)}
                    placeholder={field.placeholder}
                  />
                )}
              </div>
            ))}
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
