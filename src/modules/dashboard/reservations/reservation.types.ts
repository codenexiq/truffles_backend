import type { ReservationStatusType } from "../../../constants/index.js";

/**
 * A reservation as the dashboard sees it. The guest's secret cancel-token hash is NOT part of this type and
 * is never selected from the database, so it cannot leak through this API.
 */
export interface Reservation {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** YYYY-MM-DD */
  date: string;
  /** As the guest chose it, e.g. "7:30 PM" */
  time: string;
  guests: number;
  occasion?: string;
  specialRequests?: string;
  status: ReservationStatusType;
  createdAt: string;
  updatedAt: string;
}

export type ReservationSort = "newest" | "date_asc" | "date_desc";

export interface ReservationQuery {
  status?: ReservationStatusType;
  /** Exactly this day (YYYY-MM-DD) */
  date?: string;
  /** From / to this day, inclusive */
  from?: string;
  to?: string;
  /** Searches name, email and phone */
  q?: string;
  page: number;
  limit: number;
  sort: ReservationSort;
}

export interface ReservationStats {
  total: number;
  byStatus: Record<ReservationStatusType, number>;
  /** Reservations for today (not cancelled) and the guests they bring */
  today: { reservations: number; guests: number };
  /** Pending or confirmed bookings for the next 7 days, today included */
  upcomingWeek: number;
}
