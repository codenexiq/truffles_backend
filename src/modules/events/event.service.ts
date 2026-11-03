import { mockDb, type EventRecord } from "../../data/mockDb.js";
import { newId } from "../../utils/secure.js";
import { pushCapped } from "../../data/mockDb.js";
import { ApiError } from "../../utils/apiError.js";

export class EventService {
  static async getAll(): Promise<EventRecord[]> {
    return [...mockDb.events].sort(
      (a, b) => new Date(`${a.date} ${a.time}`).getTime() - new Date(`${b.date} ${b.time}`).getTime()
    );
  }

  static async getById(id: string): Promise<EventRecord> {
    const event = mockDb.events.find((e) => e.id === id);
    if (!event) {
      throw ApiError.notFound(`Event with ID '${id}' not found`);
    }
    return event;
  }

  static async create(
    data: Omit<EventRecord, "id" | "createdAt">
  ): Promise<EventRecord> {
    const newEvent: EventRecord = {
      ...data,
      id: newId("event"),
      createdAt: new Date().toISOString(),
    };
    pushCapped(mockDb.events, newEvent);
    return newEvent;
  }

  static async delete(id: string): Promise<void> {
    const index = mockDb.events.findIndex((e) => e.id === id);
    if (index === -1) {
      throw ApiError.notFound(`Event with ID '${id}' not found`);
    }
    mockDb.events.splice(index, 1);
  }
}

