import { z } from "zod";
import type { HrmsModule } from "@/config/hrms";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10),
  search: z.string().optional().default("")
});

export function buildModuleSchema(resource: HrmsModule) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of resource.fields) {
    let schema: z.ZodTypeAny;
    if (field.type === "number") schema = z.coerce.number();
    else if (field.type === "boolean") schema = z.coerce.boolean().default(false);
    else if (field.type === "email") schema = z.string().email("Enter a valid email address.");
    else if (field.type === "date") schema = z.string().min(1, field.label + " is required.");
    else if (field.type === "select" && field.options?.length && field.name !== "positionId") schema = z.enum(field.options as [string, ...string[]]);
    else if (field.type === "select") schema = z.string();
    else schema = z.string();

    if (!field.required && field.type !== "boolean") {
      schema = z.preprocess((value) => value === "" ? undefined : value, schema.optional());
    }

    if (field.required && field.type !== "number" && field.type !== "boolean") {
      schema = (schema as z.ZodString).min?.(1, field.label + " is required.") ?? schema;
    }

    shape[field.name] = schema;
  }

  return z.object(shape);
}

export const moduleMutationSchema = z.object({
  moduleKey: z.string().min(1),
  id: z.string().optional(),
  values: z.record(z.unknown())
});
