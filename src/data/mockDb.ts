import type { ReservationStatusType, OrderStatusType } from "../constants/index.js";

export interface MenuItemRecord {
  id: string;
  name: string;
  description: string;
  price: number;
  category: "starters" | "mains" | "desserts" | "beverages" | "specials" | "kids" | "sides";
  tags: string[];
  isAvailable: boolean;
  isPopular?: boolean;
  isNew?: boolean;
  allergens?: string[];
  calories?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  guests: number;
  specialRequests?: string;
  occasion?: string;
  status: ReservationStatusType;
  /** SHA-256 of the secret the guest received when booking. Lets the guest (only) cancel. */
  cancelTokenHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItemRecord {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderRecord {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tableNumber?: number;
  orderType: "dine-in" | "takeout" | "delivery";
  items: OrderItemRecord[];
  totalAmount: number;
  status: OrderStatusType;
  specialInstructions?: string;
  /** SHA-256 of the secret the customer received when ordering. Lets the customer (only) view the order. */
  accessTokenHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInquiryRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NewsletterSubscriberRecord {
  id: string;
  email: string;
  subscribedAt: string;
  isActive: boolean;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  image?: string;
  price?: number;
  isFeatured: boolean;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
  isApproved: boolean;
}

/**
 * Append with a ceiling. Public forms write into memory, so without a limit
 * anyone could fill the server's RAM. When full, the oldest entry is dropped.
 */
export function pushCapped<T>(list: T[], item: T, max = 5000): T {
  list.push(item);
  while (list.length > max) list.shift();
  return item;
}

// In-Memory Database store with pre-seeded restaurant data
export const mockDb = {
  menu: [
    {
      id: "menu-1",
      name: "Truffle Arancini",
      description: "Crispy Italian rice balls infused with black winter truffle and melted fontina cheese.",
      price: 16.5,
      category: "starters",
      tags: ["Vegetarian", "Chef Special"],
      isAvailable: true,
      isPopular: true,
      isNew: false,
      allergens: ["Dairy", "Gluten"],
      calories: 420,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "menu-2",
      name: "Wild Truffle Tagliatelle",
      description: "Handmade egg pasta with fresh black truffle shavings, aged parmesan, and cultured Normandy butter.",
      price: 28.0,
      category: "mains",
      tags: ["Signature", "House Handmade"],
      isAvailable: true,
      isPopular: true,
      isNew: false,
      allergens: ["Gluten", "Dairy", "Egg"],
      calories: 680,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "menu-3",
      name: "Dark Chocolate Truffle Torte",
      description: "Valrhona 72% dark chocolate ganache topped with sea salt caramel and hazelnut praline.",
      price: 14.0,
      category: "desserts",
      tags: ["Gluten-Free", "Popular"],
      isAvailable: true,
      isPopular: true,
      isNew: false,
      allergens: ["Dairy", "Nuts"],
      calories: 450,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as MenuItemRecord[],

  reservations: [
    {
      id: "res-1",
      name: "Sophia Martinez",
      email: "sophia@example.com",
      phone: "+1 555-019-2834",
      date: "2026-11-10",
      time: "7:00 PM",
      guests: 2,
      occasion: "Anniversary",
      specialRequests: "Window booth preferred",
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ] as ReservationRecord[],

  orders: [] as OrderRecord[],
  contactInquiries: [] as ContactInquiryRecord[],
  subscribers: [
    {
      id: "sub-1",
      email: "guest@example.com",
      subscribedAt: new Date().toISOString(),
      isActive: true,
    },
  ] as NewsletterSubscriberRecord[],

  events: [
    {
      id: "event-1",
      title: "Wine & Truffle Tasting Gala",
      description: "An exclusive 5-course tasting menu paired with prestigious Tuscan and Piedmontese wines.",
      date: "2026-11-20",
      time: "6:30 PM",
      price: 125,
      isFeatured: true,
      createdAt: new Date().toISOString(),
    },
  ] as EventRecord[],

  reviews: [
    {
      id: "rev-1",
      name: "Alexander Reed",
      rating: 5,
      comment: "The Wild Truffle Tagliatelle was sublime. Impeccable service and unforgettable dining ambience.",
      date: "2026-10-28",
      isApproved: true,
    },
  ] as ReviewRecord[],
};

