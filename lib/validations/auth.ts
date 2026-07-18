import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^a-zA-Z0-9]/, "Password must include a symbol.");

export const loginSchema = z.object({
  identifier: z
    .string()
    .min(2, "Enter your username or national ID.")
    .max(64, "Identifier is too long.")
    .trim(),
  password: z.string().min(1, "Password is required."),
  deviceId: z.string().optional(),
  // Validated separately in loginAction/authorize (not via zod) so a missing
  // or failed Turnstile check surfaces its own dedicated Arabic message
  // instead of a generic field-validation error. Nullable because the
  // client's initial widget state is null (no token yet), not undefined --
  // without .nullable() a plain .optional() rejects an explicit null with a
  // raw untranslated Zod error instead of ever reaching the Turnstile check.
  turnstileToken: z.string().nullable().optional()
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(2, "Enter your username or national ID.").trim()
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32, "Reset token is invalid."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password.")
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const emailVerificationSchema = z.object({
  token: z.string().min(32, "Verification token is invalid.")
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
