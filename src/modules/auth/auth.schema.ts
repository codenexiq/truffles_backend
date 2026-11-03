import { z } from "zod";
import { emailField, strongPassword, text } from "../../utils/sanitize.js";

export const loginSchema = z.object({
  body: z.object({
    email: emailField,
    // Login only checks length (a policy here would reveal the rules to attackers).
    password: z.string({ error: "Password is required" }).min(1, "Password is required").max(128, "Invalid credentials"),
  }),
});

export const registerStaffSchema = z.object({
  body: z.object({
    name: text(2, 80),
    email: emailField,
    password: strongPassword,
    role: z.enum(["admin", "manager", "staff"]).default("staff"),
  }),
});
