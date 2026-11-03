import { mockDb, pushCapped, type OrderRecord, type OrderItemRecord } from "../../data/mockDb.js";
import { newId, newSecretToken, safeEqual, sha256 } from "../../utils/secure.js";
import { ApiError } from "../../utils/apiError.js";
import type { OrderStatusType } from "../../constants/index.js";

export class OrderService {
  static async getAll(filters?: { status?: OrderStatusType }): Promise<OrderRecord[]> {
    let list = [...mockDb.orders];
    if (filters?.status) {
      list = list.filter((o) => o.status === filters.status);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Strips the token hash: it must never leave the server. */
  static toView(o: OrderRecord): Omit<OrderRecord, "accessTokenHash"> {
    const { accessTokenHash: _omit, ...rest } = o;
    void _omit;
    return rest;
  }

  /**
   * Customer lookup. Needs the order id AND the secret token from the order response.
   * A wrong id and a wrong token give the identical answer, so ids cannot be probed.
   */
  static async getForCustomer(id: string, token: string | undefined): Promise<OrderRecord> {
    const order = mockDb.orders.find((o) => o.id === id);
    if (!order || !token || !order.accessTokenHash || !safeEqual(sha256(token), order.accessTokenHash)) {
      throw ApiError.notFound("Order not found");
    }
    return order;
  }

  static async getById(id: string): Promise<OrderRecord> {
    const order = mockDb.orders.find((o) => o.id === id);
    if (!order) {
      throw ApiError.notFound("Order not found");
    }
    return order;
  }

  static async create(payload: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    orderType: "dine-in" | "takeout" | "delivery";
    tableNumber?: number;
    items: { menuItemId: string; quantity: number }[];
    specialInstructions?: string;
  }): Promise<{ order: OrderRecord; accessToken: string }> {
    const populatedItems: OrderItemRecord[] = [];
    let total = 0;

    for (const item of payload.items) {
      const menuItem = mockDb.menu.find((m) => m.id === item.menuItemId);
      if (!menuItem) {
        throw ApiError.badRequest("One of the items in your order does not exist");
      }
      if (!menuItem.isAvailable) {
        throw ApiError.badRequest(`Dish '${menuItem.name}' is currently unavailable`);
      }

      populatedItems.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
      });

      total += menuItem.price * item.quantity;
    }

    const accessToken = newSecretToken();
    const newOrder: OrderRecord = {
      id: newId("order"),
      accessTokenHash: sha256(accessToken),
      customerName: payload.customerName,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
      orderType: payload.orderType,
      tableNumber: payload.tableNumber,
      items: populatedItems,
      totalAmount: Math.round(total * 100) / 100,
      status: "pending",
      specialInstructions: payload.specialInstructions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    pushCapped(mockDb.orders, newOrder);
    return { order: newOrder, accessToken };
  }

  static async updateStatus(id: string, status: OrderStatusType): Promise<OrderRecord> {
    const order = await this.getById(id);
    order.status = status;
    order.updatedAt = new Date().toISOString();
    return order;
  }
}

