import { mockDb, pushCapped, type NewsletterSubscriberRecord } from "../../data/mockDb.js";
import { newId, safeEqual, signEmailToken } from "../../utils/secure.js";

export class NewsletterService {
  /**
   * Always succeeds from the caller's point of view, whether or not the address was
   * already subscribed, so the form cannot be used to find out who is on the list.
   */
  static async subscribe(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = mockDb.subscribers.find((s) => s.email === normalizedEmail);
    if (existing) {
      existing.isActive = true;
      return;
    }
    const subscriber: NewsletterSubscriberRecord = {
      id: newId("sub"),
      email: normalizedEmail,
      subscribedAt: new Date().toISOString(),
      isActive: true,
    };
    pushCapped(mockDb.subscribers, subscriber);
  }

  /** Token for the unsubscribe link that will go in newsletter emails. */
  static unsubscribeToken(email: string) {
    return signEmailToken(email, "newsletter-unsubscribe");
  }

  /** Same quiet result for a wrong token or an unknown address. */
  static async unsubscribe(email: string, token: string): Promise<void> {
    const valid = safeEqual(token, this.unsubscribeToken(email));
    if (!valid) return;
    const subscriber = mockDb.subscribers.find((s) => s.email === email.toLowerCase().trim());
    if (subscriber) subscriber.isActive = false;
  }

  static async getAll(): Promise<NewsletterSubscriberRecord[]> {
    return [...mockDb.subscribers];
  }
}

