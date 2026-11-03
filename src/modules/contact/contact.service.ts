import { mockDb, pushCapped, type ContactInquiryRecord } from "../../data/mockDb.js";
import { newId } from "../../utils/secure.js";
import { ApiError } from "../../utils/apiError.js";

export class ContactService {
  static async create(
    data: Omit<ContactInquiryRecord, "id" | "isRead" | "createdAt">
  ): Promise<ContactInquiryRecord> {
    const inquiry: ContactInquiryRecord = {
      ...data,
      id: newId("inq"),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    pushCapped(mockDb.contactInquiries, inquiry);
    return inquiry;
  }

  static async getAll(): Promise<ContactInquiryRecord[]> {
    return [...mockDb.contactInquiries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  static async markAsRead(id: string): Promise<ContactInquiryRecord> {
    const inquiry = mockDb.contactInquiries.find((i) => i.id === id);
    if (!inquiry) {
      throw ApiError.notFound(`Inquiry with ID '${id}' not found`);
    }
    inquiry.isRead = true;
    return inquiry;
  }
}

