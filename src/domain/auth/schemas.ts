import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("validation.emailInvalid"),
  password: z.string().min(1, "validation.passwordRequired"),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().email("validation.emailInvalid"),
  name: z.string().trim().min(1, "validation.nameRequired").max(100),
  password: z.string().min(8, "validation.passwordMinLength"),
  role: z.enum(["owner", "admin", "manager", "cashier"]),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const changePasswordSchema = z
  .object({
    confirmPassword: z.string().min(1, "validation.passwordRequired"),
    currentPassword: z.string().min(1, "validation.passwordRequired"),
    newPassword: z.string().min(8, "validation.passwordMinLength"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
