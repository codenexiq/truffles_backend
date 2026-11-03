import { z } from "zod";
import { emailField } from "../../utils/sanitize.js";

export const subscribeNewsletterSchema = z.object({
  body: z.object({ email: emailField }),
});

/** Unsubscribing needs the signed token that belongs in the unsubscribe link of each email. */
export const unsubscribeNewsletterSchema = z.object({
  body: z.object({ email: emailField, token: z.string().min(20).max(200) }),
});
