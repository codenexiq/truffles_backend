import { z } from "zod";
import { RESERVATION_STATUS } from "../../../constants/index.js";
import { dateField } from "../../../utils/sanitize.js";

const status = z.enum([
  RESERVATION_STATUS.PENDING,
  RESERVATION_STATUS.CONFIRMED,
  RESERVATION_STATUS.CANCELLED,
  RESERVATION_STATUS.COMPLETED,
]);

/** Query string of GET /reservations. Everything is optional; paging and sorting have safe defaults. */
export const listReservationsSchema = z.object({
  query: z.object({
    status: status.optional(),
    date: dateField.optional(),
    from: dateField.optional(),
    to: dateField.optional(),
    q: z.string().trim().max(80).optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(["newest", "date_asc", "date_desc"]).default("newest"),
  }),
});

export const reservationIdSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
});

export const updateStatusSchema = z.object({
  params: z.object({ id: z.string().min(1).max(80) }),
  body: z.object({ status }),
});
