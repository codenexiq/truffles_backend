import type { ReservationRecord } from "../../data/mockDb.js";
import { reservationRepository } from "./reservation.repository.js";
import { newId, newSecretToken, safeEqual, sha256 } from "../../utils/secure.js";
import { ApiError } from "../../utils/apiError.js";
import type { ReservationStatusType } from "../../constants/index.js";
import type { StatusActor } from "./statusHistory.js";

export class ReservationService {
  static async getAll(filters?: {
    date?: string;
    status?: ReservationStatusType;
  }): Promise<ReservationRecord[]> {
    return reservationRepository.list(filters);
  }

  static async getById(id: string): Promise<ReservationRecord> {
    const res = await reservationRepository.getById(id);
    if (!res) {
      throw ApiError.notFound(`Reservation with ID '${id}' not found`);
    }
    return res;
  }

  /** Strips the token hash: it must never leave the server. */
  static toStaffView(r: ReservationRecord): Omit<ReservationRecord, "cancelTokenHash"> {
    const { cancelTokenHash: _omit, ...rest } = r;
    void _omit;
    return rest;
  }

  /** Returns the record plus the plain cancel token, which exists only in this one response. */
  static async create(
    data: Omit<ReservationRecord, "id" | "status" | "createdAt" | "updatedAt" | "cancelTokenHash">
  ): Promise<{ record: ReservationRecord; cancelToken: string }> {
    const cancelToken = newSecretToken();
    const record: ReservationRecord = {
      ...data,
      id: newId("res"),
      status: "pending",
      cancelTokenHash: sha256(cancelToken),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await reservationRepository.insert(record);
    return { record, cancelToken };
  }

  static async updateStatus(
    id: string,
    status: ReservationStatusType,
    actor: StatusActor = { source: "staff" }
  ): Promise<ReservationRecord> {
    const updated = await reservationRepository.updateStatus(id, status, new Date().toISOString(), actor);
    if (!updated) {
      throw ApiError.notFound(`Reservation with ID '${id}' not found`);
    }
    return updated;
  }

  /**
   * Guest cancellation. Needs BOTH the reservation id and the secret token from the
   * booking response. Every failure looks the same, so ids cannot be probed.
   */
  static async cancelWithToken(id: string, token: string): Promise<ReservationRecord> {
    const res = await reservationRepository.getById(id);
    const ok = !!res && !!res.cancelTokenHash && safeEqual(sha256(token), res.cancelTokenHash);
    if (!res || !ok || res.status === "cancelled" || res.status === "completed") {
      throw ApiError.notFound("Reservation not found or it can no longer be cancelled");
    }
    return this.updateStatus(id, "cancelled", { source: "guest" });
  }
}
