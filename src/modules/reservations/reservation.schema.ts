import { z } from "zod";
import { RESERVATION_STATUS } from "../../constants/index.js";
import { dateField, emailField, optionalText, phoneField, text } from "../../utils/sanitize.js";

/** Today in Pakistan time (UTC+5), as YYYY-MM-DD. */
const todayPkt = () => new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);

export const createReservationSchema = z.object({
  body: z.object({
    name: text(2, 80, "Name must be at least 2 characters"),
    email: emailField,
    phone: phoneField,
    date: dateField
      .refine((d) => d >= todayPkt(), "Date cannot be in the past")
      .refine((d) => d <= new Date(Date.now() + 366 * 86400 * 1000).toISOString().slice(0, 10), "Please book within the next year"),
    time: text(1, 20, "Time is required"),
    guests: z.coerce.number().int().min(1, "At least 1 guest required").max(30, "For parties larger than 30, please call us directly"),
    occasion: optionalText(60),
    specialRequests: optionalText(1000),
  }),
});

export const cancelReservationSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ token: z.string().min(20).max(200) }),
});

export const updateReservationStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Reservation ID is required").max(80),
  }),
  body: z.object({
    status: z.enum([
      RESERVATION_STATUS.PENDING,
      RESERVATION_STATUS.CONFIRMED,
      RESERVATION_STATUS.CANCELLED,
      RESERVATION_STATUS.COMPLETED,
    ]),
  }),
});
