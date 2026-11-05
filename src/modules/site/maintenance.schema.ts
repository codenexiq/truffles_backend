import { z } from "zod";
import { optionalText, text } from "../../utils/sanitize.js";

export const updateMaintenanceSchema = z.object({
  body: z.object({
    enabled: z.boolean({ error: "Say whether maintenance mode is on or off" }),
    title: text(3, 80, "Add a short heading (at least 3 characters)"),
    message: text(5, 400, "Add a short message for visitors (at least 5 characters)"),
    eta: optionalText(60).transform((v) => v ?? null),
  }),
});
