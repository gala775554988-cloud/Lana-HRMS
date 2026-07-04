'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { HrmsModule } from "@/config/hrms";
import { createModuleRecord, updateModuleRecord } from "@/lib/hrms/actions";
import { buildModuleSchema } from "@/lib/validations/hrms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export function ModuleForm({ resource, dictionary, initialValues, recordId, locale = "en" }: { resource: HrmsModule; dictionary: Dictionary; initialValues?: Record<string, unknown>; recordId?: string; locale?: Locale }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(buildModuleSchema(resource)), defaultValues: Object.fromEntries(resource.fields.map((field) => [field.name, initialValues?.[field.name] ?? (field.type === "boolean" ? false : "")])) });

  function onSubmit(values: Record<string, unknown>) {
    setMessage(null);
    startTransition(async () => {
      const result = recordId ? await updateModuleRecord({ resourceKey: resource.key, id: recordId, values }) : await createModuleRecord({ resourceKey: resource.key, values });
      setMessage(result.message);
      if (result.success) router.refresh();
    });
  }

  const fieldsDict = dictionary.fields as Record<string, string>;
  const getFieldLabel = (name: string, fallback: string) => fieldsDict[name] ?? fallback;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" dir={locale === "ar" ? "rtl" : "ltr"}>
      {message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {resource.fields.map((field) => {
          const error = form.formState.errors[field.name]?.message as string | undefined;
          const label = getFieldLabel(field.name, field.label);
          return (
            <div key={field.name} className={field.type === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2"}>
              <Label htmlFor={field.name}>{label}</Label>
              {field.type === "textarea" ? (
                <textarea id={field.name} className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register(field.name)} />
              ) : field.type === "select" ? (
                <select id={field.name} className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...form.register(field.name)}>
                  <option value="">{dictionary.form.select}</option>
                  {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.type === "boolean" ? (
                <input id={field.name} type="checkbox" className="h-4 w-4" {...form.register(field.name)} />
              ) : (
                <Input id={field.name} type={field.type === "date" ? "date" : field.type === "number" ? "number" : field.type} step={field.type === "number" ? "0.01" : undefined} {...form.register(field.name)} />
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          );
        })}
      </div>
      <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{recordId ? dictionary.form.saveChanges : dictionary.form.createRecord}</Button>
    </form>
  );
}
