import type { ReservationRecord } from "../../../data/mockDb.js";
import type { ReservationStatusType } from "../../../constants/index.js";

/** Pakistan-time calendar day, n days from today (YYYY-MM-DD). */
const dayOffset = (n: number) => new Date(Date.now() + 5 * 3600 * 1000 + n * 86_400_000).toISOString().slice(0, 10);

/** Fake bookings for trying the dashboard locally. Only used when there is no database and NODE_ENV is not production. */
export function buildDemoReservations(): ReservationRecord[] {
  const people = [
    ["Ayesha Khan", "ayesha.k@example.com", "0300-1112233"],
    ["Hamza Raza", "hamza.r@example.com", "0321-4445566"],
    ["Sana Malik", "sana.m@example.com", "0333-7778899"],
    ["Bilal Ahmed", "bilal.a@example.com", "0345-2223344"],
    ["Zara Sheikh", "zara.s@example.com", "0301-5556677"],
    ["Usman Tariq", "usman.t@example.com", "0322-8889900"],
    ["Mariam Noor", "mariam.n@example.com", "0334-1230987"],
    ["Farhan Ali", "farhan.a@example.com", "0346-6543210"],
    ["Hira Siddiqui", "hira.s@example.com", "0302-1357913"],
    ["Omar Farooq", "omar.f@example.com", "0323-2468024"],
    ["Nida Hussain", "nida.h@example.com", "0335-9876543"],
    ["Kamran Javed", "kamran.j@example.com", "0347-1928374"],
  ];
  const times = ["12:30 PM", "1:00 PM", "7:00 PM", "7:30 PM", "8:00 PM", "8:30 PM", "9:00 PM"];
  const occasions = ["Birthday", "Anniversary", undefined, "Date Night", undefined, "Celebration", undefined];
  const notes = ["Window table please", undefined, "One guest is vegetarian", undefined, "Allergic to nuts", undefined];
  const statuses: ReservationStatusType[] = [
    "pending", "confirmed", "pending", "completed", "confirmed", "cancelled",
    "pending", "confirmed", "completed", "pending", "confirmed", "pending",
  ];
  const offsets = [0, 0, 1, -3, 2, -1, 0, 3, -6, 1, 4, 5];

  return people.map(([name, email, phone], i) => {
    const created = new Date(Date.now() - (i + 1) * 5 * 3600_000).toISOString();
    return {
      id: `res_demo_${String(i + 1).padStart(2, "0")}`,
      name,
      email,
      phone,
      date: dayOffset(offsets[i]),
      time: times[i % times.length],
      guests: 2 + ((i * 3) % 9),
      occasion: occasions[i % occasions.length],
      specialRequests: notes[i % notes.length],
      status: statuses[i],
      createdAt: created,
      updatedAt: created,
    };
  });
}
