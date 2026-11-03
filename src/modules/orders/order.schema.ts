import { z } from "zod";
import { ORDER_STATUS } from "../../constants/index.js";
import { emailField, optionalText, phoneField, text } from "../../utils/sanitize.js";

export const createOrderSchema = z.object({
  body: z.object({
    customerName: text(2, 80, "Customer name required"),
    customerEmail: emailField,
    customerPhone: phoneField,
    orderType: z.enum(["dine-in", "takeout", "delivery"]),
    tableNumber: z.coerce.number().int().min(1).max(500).optional(),
    items: z
      .array(
        z.object({
          menuItemId: z.string().min(1, "Menu item ID required").max(80),
          quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(50, "Quantity is too large"),
        })
      )
      .min(1, "Order must have at least one item")
      .max(50, "Too many items in one order"),
    specialInstructions: optionalText(500),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Order ID required").max(80),
  }),
  body: z.object({
    status: z.enum([
      ORDER_STATUS.PENDING,
      ORDER_STATUS.PREPARING,
      ORDER_STATUS.READY,
      ORDER_STATUS.DELIVERED,
      ORDER_STATUS.CANCELLED,
    ]),
  }),
});
