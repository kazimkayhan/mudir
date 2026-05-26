import { z } from "zod";

export const licenseStatusSchema = z.object({
  daysRemaining: z.number().nullable().optional(),
  email: z.string().nullable().optional(),
  expired: z.boolean(),
  expiresAt: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  valid: z.boolean(),
});

export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

export const DEV_LICENSE_KEY = "MUDIR-DEV-LOCAL-NOT-FOR-RESALE";
