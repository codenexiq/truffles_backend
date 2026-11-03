import { mockDb, type MenuItemRecord } from "../../data/mockDb.js";
import { newId } from "../../utils/secure.js";
import { pushCapped } from "../../data/mockDb.js";
import { ApiError } from "../../utils/apiError.js";

export class MenuService {
  static async getAll(filters?: {
    category?: string;
    search?: string;
    availableOnly?: boolean;
  }): Promise<MenuItemRecord[]> {
    let items = [...mockDb.menu];

    if (filters?.category) {
      items = items.filter((item) => item.category === filters.category);
    }

    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      );
    }

    if (filters?.availableOnly) {
      items = items.filter((item) => item.isAvailable);
    }

    return items;
  }

  static async getById(id: string): Promise<MenuItemRecord> {
    const item = mockDb.menu.find((i) => i.id === id);
    if (!item) {
      throw ApiError.notFound(`Menu item with ID '${id}' not found`);
    }
    return item;
  }

  static async create(
    data: Omit<MenuItemRecord, "id" | "createdAt" | "updatedAt">
  ): Promise<MenuItemRecord> {
    const newItem: MenuItemRecord = {
      ...data,
      id: newId("menu"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    pushCapped(mockDb.menu, newItem);
    return newItem;
  }

  static async update(
    id: string,
    data: Partial<Omit<MenuItemRecord, "id" | "createdAt" | "updatedAt">>
  ): Promise<MenuItemRecord> {
    const index = mockDb.menu.findIndex((i) => i.id === id);
    if (index === -1) {
      throw ApiError.notFound(`Menu item with ID '${id}' not found`);
    }

    const updated = {
      ...mockDb.menu[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };

    mockDb.menu[index] = updated;
    return updated;
  }

  static async delete(id: string): Promise<void> {
    const index = mockDb.menu.findIndex((i) => i.id === id);
    if (index === -1) {
      throw ApiError.notFound(`Menu item with ID '${id}' not found`);
    }
    mockDb.menu.splice(index, 1);
  }
}

