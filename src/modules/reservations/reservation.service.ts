import { mockDb, pushCapped, type ReservationRecord } from "../../data/mockDb.js";
import { newId, newSecretToken, safeEqual, sha256 } from "../../utils/secure.js";
import { ApiError } from "../../utils/apiError.js";
import type { ReservationStatusType } from "../../constants/index.js";

export class ReservationService {
  static async getAll(filters?: {
    date?: string;
    status?: ReservationStatusType;
  }): Promise<ReservationRecord[]> {
    let list = [...mockDb.reservations];

    if (filters?.date) {
      list = list.filter((r) => r.date === filters.date);
    }

    if (filters?.status) {
      list = list.filter((r) => r.status === filters.status);
    }

    return list.sort((a, b) => new Date(`${b.date} ${b.time}`).getTime() - new Date(`${a.date} ${a.time}`).getTime());
  }

  static async getById(id: string): Promise<ReservationRecord> {
    const res = mockDb.reservations.find((r) => r.id === id);
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
    pushCapped(mockDb.reservations, record);
    return { record, cancelToken };
  }

  static async updateStatus(
    id: string,
    status: ReservationStatusType
  ): Promise<ReservationRecord> {
    const res = await this.getById(id);
    res.status = status;
    res.updatedAt = new Date().toISOString();
    return res;
  }

  /**
   * Guest cancellation. Needs BOTH the reservation id and the secret token from the
   * booking response. Every failure looks the same, so ids cannot be probed.
   */
  static async cancelWithToken(id: string, token: string): Promise<ReservationRecord> {
    const res = mockDb.reservations.find((r) => r.id === id);
    const ok = !!res && !!res.cancelTokenHash && safeEqual(sha256(token), res.cancelTokenHash);
    if (!res || !ok || res.status === "cancelled" || res.status === "completed") {
      throw ApiError.notFound("Reservation not found or it can no longer be cancelled");
    }
    return this.updateStatus(id, "cancelled");
  }
}
