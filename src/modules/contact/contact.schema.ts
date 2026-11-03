import { z } from "zod";
import { emailField, phoneField, text } from "../../utils/sanitize.js";

export const contactInquirySchema = z.object({
  body: z.object({
    name: text(2, 80, "Name must be at least 2 characters"),
    email: emailField,
    phone: phoneField.optional(),
    subject: text(3, 120, "Subject must be at least 3 characters"),
    message: text(10, 2000, "Message must be at least 10 characters"),
  }),
});
