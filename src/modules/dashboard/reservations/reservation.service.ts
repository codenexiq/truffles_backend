import { ApiError } from "../../../utils/apiError.js";
import { logger } from "../../../utils/logger.js";
import type { ReservationStatusType } from "../../../constants/index.js";
import { dashboardReservationRepository as reservationRepository } from "./reservation.repository.js";
import type { Reservation, ReservationQuery, ReservationStats } from "./reservation.types.js";

/** Today in Pakistan time (UTC+5), as YYYY-MM-DD. The restaurant works on this clock, whatever the server's is. */
const pktDay = (offsetDays = 0) => new Date(Date.now() + 5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);

/**
 * A booking can only move along sensible paths. This stops, for example, a cancelled table being
 * "completed" by a stray click, while still letting staff fix a mistake (cancelled -> pending).
 */
const ALLOWED: Record<ReservationStatusType, ReservationStatusType[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "pending"],
  completed: [],
  cancelled: ["pending"],
};

export class DashboardReservationService {
  static async list(query: ReservationQuery) {
    return reservationRepository.list(query);
  }

  static async getById(id: string): Promise<Reservation> {
    const found = await reservationRepository.getById(id);
    if (!found) throw ApiError.notFound("Reservation not found");
    return found;
  }

  static async updateStatus(
    id: string,
    status: ReservationStatusType,
    actor: { id: string; email: string }
  ): Promise<Reservation> {
    const current = await this.getById(id);
    if (current.status === status) return current; // nothing to do
    if (!ALLOWED[current.status].includes(status)) {
      throw ApiError.conflict(`A ${current.status} reservation cannot be changed to ${status}`);
    }
    const updated = await reservationRepository.updateStatus(id, status, new Date().toISOString(), { source: "staff", staffId: actor.id });
    if (!updated) throw ApiError.notFound("Reservation not found");
    logger.info(`Reservation ${id}: ${current.status} -> ${status} (by ${actor.email})`);
    return updated;
  }

  static async history(id: string) {
    await this.getById(id); // 404 for an unknown reservation
    return reservationRepository.history(id);
  }

  static async stats(): Promise<ReservationStats> {
    return reservationRepository.stats(pktDay(0), pktDay(6));
  }
}
