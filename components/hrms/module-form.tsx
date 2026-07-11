'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, useCallback } from "react";
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
import { EmployeePhotoUpload } from "./employee-photo-upload";
import { calculateInsuranceDeduction, calculateNetSalary, calculateTotalSalary, salaryProfileFields, salaryProfileLabels } from "@/lib/employee/salary-profile";

export function ModuleForm({ resource, dictionary, initialValues, recordId, locale = "en" }: { resource: HrmsModule; dictionary: Dictionary; initialValues?: Record<string, unknown>; recordId?: string; locale?: Locale }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEmployeeForm = resource.key === "employees";
  const initialFullName = `${String(initialValues?.firstName ?? "")} ${String(initialValues?.lastName ?? "")}`.trim();
  const [fullName, setFullName] = useState(initialFullName);
  const initialSalaryValues = useMemo(
    () => ({
      ...Object.fromEntries(salaryProfileFields.map((field) => [field, initialValues?.[field] ?? ""])),
      salaryDeductInsurance: initialValues?.salaryDeductInsurance === true
    }),
    [initialValues]
  );
  const [salaryValues, setSalaryValues] = useState<Record<string, unknown>>(initialSalaryValues);
  const [costValues, setCostValues] = useState<string[]>(() => {
    const costs = initialValues?.salaryCosts;
    return Array.isArray(costs) && costs.length ? costs.map((cost) => String(cost)) : [""];
  });
  const [customPositionOptions, setCustomPositionOptions] = useState<string[]>(() => {
    const current = typeof initialValues?.positionId === "string" ? initialValues.positionId : "";
    const field = resource.fields.find((item) => item.name === "positionId");
    return current && !field?.options?.includes(current) ? [current] : [];
  });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(buildModuleSchema(resource)), defaultValues: Object.fromEntries(resource.fields.map((field) => [field.name, initialValues?.[field.name] ?? (field.type === "boolean" ? false : "")])) });

  const onSubmit = useCallback((values: Record<string, unknown>) => {
    setMessage(null);
    startTransition(async () => {
      try {
        const nameParts = fullName.trim().split(/\s+/).filter(Boolean);
        const submitValues = isEmployeeForm ? {
          ...values,
          firstName: nameParts[0] ?? "",
          lastName: nameParts.slice(1).join(" ") || nameParts[0] || "",
          ...salaryValues,
          salaryCosts: costValues.filter((cost) => cost !== "")
        } : values;
        if (isEmployeeForm && selectedPhotoFile) {
          const formData = new FormData();
          formData.append("file", selectedPhotoFile);
          const uploadResponse = await fetch("/api/uploads", { method: "POST", body: formData });
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({ message: "فشل رفع الصورة" }));
            throw new Error(errorData.message || "فشل رفع الصورة");
          }
          const uploadData = await uploadResponse.json();
          if (!uploadData.url) throw new Error(uploadData.message || "فشل رفع الصورة");
          submitValues.profilePhotoUrl = uploadData.url;
        } else if (isEmployeeForm && photoRemoved) {
          submitValues.profilePhotoUrl = "";
        }
        const result = recordId ? await updateModuleRecord({ resourceKey: resource.key, id: recordId, values: submitValues }) : await createModuleRecord({ resourceKey: resource.key, values: submitValues });
        if (result.success) {
          setSelectedPhotoFile(null);
          setPhotoRemoved(false);
          setMessage({ text: result.message, type: 'success' });
          router.refresh();
        } else {
          const errorMsg = result.message || (result as any).error?.message || "فشل في حفظ البيانات";
          setMessage({ text: errorMsg, type: 'error' });
        }
      } catch (error: any) {
        setMessage({ text: error?.message || "حدث خطأ غير متوقع", type: 'error' });
      }
    });
  }, [costValues, fullName, isEmployeeForm, photoRemoved, recordId, resource.key, router, salaryValues, selectedPhotoFile]);

  const fieldsDict = dictionary.fields as Record<string, string>;
  const getFieldLabel = (name: string, fallback: string) => fieldsDict[name] ?? fallback;
  const salaryCalculationInput = {
    ...Object.fromEntries(salaryProfileFields.map((field) => [field, Number(salaryValues[field] || 0)])),
    salaryDeductInsurance: Boolean(salaryValues.salaryDeductInsurance)
  };
  const derivedNetSalary = calculateNetSalary(salaryCalculationInput as any);
  const insuranceDeduction = calculateInsuranceDeduction(salaryCalculationInput as any);
  const totalSalary = calculateTotalSalary(salaryCalculationInput as any);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" dir={locale === "ar" ? "rtl" : "ltr"}>
      {message && (
        <Alert className={message.type === 'success' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'}>
          <div className="flex items-start gap-2">
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />}
            <AlertDescription className={message.type === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}>{message.text}</AlertDescription>
          </div>
        </Alert>
      )}
      {isEmployeeForm ? (
        <div className="space-y-2">
          <Label>{getFieldLabel("profilePhotoUrl", "الصورة الشخصية")}</Label>
          <EmployeePhotoUpload
            employeeId={recordId}
            currentPhoto={String(form.watch("profilePhotoUrl") || "")}
            large
            dictionary={dictionary}
            autoUpload={false}
            onFileSelected={(file) => { setSelectedPhotoFile(file); setPhotoRemoved(false); }}
            onRemoved={() => { setSelectedPhotoFile(null); setPhotoRemoved(true); form.setValue("profilePhotoUrl", "", { shouldDirty: true }); }}
          />
          <input type="hidden" {...form.register("profilePhotoUrl")} />
        </div>
      ) : null}

      {isEmployeeForm ? (
        <div className="space-y-2">
          <Label htmlFor="fullName">{locale === "ar" ? "الاسم الكامل" : "Full Name"}<span className="text-destructive mr-1">*</span></Label>
          <Input id="fullName" value={fullName} onChange={(event) => {
            const value = event.target.value;
            setFullName(value);
            const parts = value.trim().split(/\s+/).filter(Boolean);
            form.setValue("firstName", parts[0] ?? "", { shouldDirty: true });
            form.setValue("lastName", parts.slice(1).join(" ") || parts[0] || "", { shouldDirty: true });
          }} required />
          <input type="hidden" {...form.register("firstName")} />
          <input type="hidden" {...form.register("lastName")} />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {resource.fields.filter((field) => !(isEmployeeForm && ["profilePhotoUrl", "firstName", "lastName"].includes(field.name))).map((field) => {
          const error = form.formState.errors[field.name]?.message as string | undefined;
          const label = getFieldLabel(field.name, field.label);
          return (
            <div key={field.name} className={field.type === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2"}>
              <Label htmlFor={field.name}>{label}{field.required && <span className="text-destructive mr-1">*</span>}</Label>
              {isEmployeeForm && field.name === "positionId" ? (
                <div className="space-y-2">
                  <select id={field.name} className={`h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${error ? 'border-destructive' : 'border-input'}`} {...form.register(field.name)}>
                    <option value="">{dictionary.form.select}</option>
                    {[...(field.options ?? []), ...customPositionOptions].map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={() => {
                    const title = window.prompt("إضافة منصب جديد");
                    if (title?.trim()) {
                      setCustomPositionOptions((current) => Array.from(new Set([...current, title.trim()])));
                      form.setValue(field.name, title.trim(), { shouldDirty: true });
                    }
                  }}>إضافة منصب جديد</Button>
                </div>
              ) : field.type === "textarea" ? (
                <textarea id={field.name} className={`min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm ${error ? 'border-destructive' : 'border-input'}`} {...form.register(field.name)} />
              ) : field.type === "select" ? (
                <select id={field.name} className={`h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${error ? 'border-destructive' : 'border-input'}`} {...form.register(field.name)}>
                  <option value="">{dictionary.form.select}</option>
                  {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.type === "boolean" ? (
                <input id={field.name} type="checkbox" className="h-4 w-4" {...form.register(field.name)} />
              ) : (
                <Input id={field.name} type={field.type === "date" ? "date" : field.type === "number" ? "number" : field.type} step={field.type === "number" ? "0.01" : undefined} className={error ? 'border-destructive' : ''} {...form.register(field.name)} />
              )}
              {error ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{error}</p> : null}
            </div>
          );
        })}
      </div>

      {isEmployeeForm ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
          <p>تفاصيل الراتب تتم مزامنتها تلقائياً من Odoo</p>
          <p className="text-xs mt-1">اضغط على زر <strong>الراتب الإجمالي</strong> في ملف الحساب لعرض التفاصيل المتزامنة مع Odoo</p>
        </div>
      ) : null}

      <Button type="submit" disabled={isPending}>{isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{recordId ? dictionary.form.saveChanges : dictionary.form.createRecord}</Button>
    </form>
  );
}
