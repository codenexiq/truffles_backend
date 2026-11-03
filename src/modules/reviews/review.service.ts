import { mockDb, pushCapped, type ReviewRecord } from "../../data/mockDb.js";
import { newId } from "../../utils/secure.js";
import { ApiError } from "../../utils/apiError.js";

export class ReviewService {
  static async getApproved(): Promise<ReviewRecord[]> {
    return mockDb.reviews.filter((r) => r.isApproved);
  }

  static async getAll(): Promise<ReviewRecord[]> {
    return [...mockDb.reviews];
  }

  static async create(
    data: Omit<ReviewRecord, "id" | "date" | "isApproved">
  ): Promise<ReviewRecord> {
    const newReview: ReviewRecord = {
      ...data,
      id: newId("rev"),
      date: new Date().toISOString().split("T")[0],
      isApproved: false, // Held for moderation: nothing a visitor writes is published until staff approve it
    };
    pushCapped(mockDb.reviews, newReview);
    return newReview;
  }

  static async setApproval(id: string, isApproved: boolean): Promise<ReviewRecord> {
    const review = mockDb.reviews.find((r) => r.id === id);
    if (!review) {
      throw ApiError.notFound(`Review with ID '${id}' not found`);
    }
    review.isApproved = isApproved;
    return review;
  }
}

