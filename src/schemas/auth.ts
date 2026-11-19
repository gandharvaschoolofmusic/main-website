import { z } from "zod";

export const SendOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid mobile number")
    .max(20, "Mobile number is too long"),
  purpose: z.enum(["LOGIN", "SIGNUP"]),
});

export type SendOtpInput = z.infer<typeof SendOtpSchema>;

export const OtpLoginSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid mobile number"),
  code: z
    .string()
    .trim()
    .length(6, "Please enter the complete 6-digit OTP"),
});

export type OtpLoginInput = z.infer<typeof OtpLoginSchema>;

export const SignupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be under 80 characters"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid mobile number"),
  otpCode: z
    .string()
    .trim()
    .length(6, "Please verify your mobile number with the 6-digit OTP code"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  role: z.literal("TEACHER", {
    message: "Direct registration is available only to teachers. Students can book a free trial.",
  }),
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone is required")
    .default("UTC"),
  instruments: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable(),
  experience: z.coerce.number().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.role === "TEACHER") {
    let parsedInstruments: string[] = [];
    if (typeof data.instruments === "string") {
      try {
        const parsed = JSON.parse(data.instruments);
        if (Array.isArray(parsed)) {
          parsedInstruments = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        } else if (data.instruments.trim()) {
          parsedInstruments = data.instruments.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } catch {
        parsedInstruments = data.instruments.split(",").map((s) => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(data.instruments)) {
      parsedInstruments = data.instruments.map(String).map((s) => s.trim()).filter(Boolean);
    }

    if (parsedInstruments.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select at least one instrument or musical discipline.",
        path: ["instruments"],
      });
    }

    if (
      data.experience === undefined ||
      data.experience === null ||
      isNaN(data.experience) ||
      data.experience < 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please enter your years of teaching experience (0 or more).",
        path: ["experience"],
      });
    } else if (data.experience > 70) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Teaching experience cannot exceed 70 years.",
        path: ["experience"],
      });
    }
  }
});

export type SignupInput = z.infer<typeof SignupSchema>;

export const LoginSchema = z
  .object({
    identifier: z.string().trim().optional(),
    email: z.string().trim().optional(),
    password: z.string().min(1, "Password is required"),
  })
  .transform((data) => ({
    identifier: (data.identifier || data.email || "").trim(),
    password: data.password,
  }))
  .refine((data) => data.identifier.length > 0, {
    message: "Please enter your email or mobile phone number",
    path: ["identifier"],
  });

export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;

export const ResendVerificationEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .toLowerCase(),
});

export type ResendVerificationEmailInput = z.infer<
  typeof ResendVerificationEmailSchema
>;
