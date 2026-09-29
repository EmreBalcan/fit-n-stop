import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { members, reservations } from "../../../db/schema";

const CAPACITY = 25;
const SLOTS = ["06.00 – 08.00", "08.00 – 10.00", "10.00 – 12.00", "12.00 – 14.00", "14.00 – 16.00", "16.00 – 18.00", "18.00 – 20.00", "20.00 – 22.00"];

function istanbulNow() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function slotStart(slot: string) {
  const match = slot.match(/^(\d{2})\.(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1;
}

function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date); }

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? istanbulNow().date;
  const memberId = Number(url.searchParams.get("memberId"));
  if (!validDate(date)) return Response.json({ error: "Geçerli bir tarih seçin." }, { status: 400 });
  const rows = await getDb().select({ id: reservations.id, memberId: reservations.memberId, date: reservations.date, timeSlot: reservations.timeSlot, fullName: members.fullName, phone: members.phone, email: members.email, tcLast4: members.tcLast4 }).from(reservations).innerJoin(members, eq(reservations.memberId, members.id)).where(eq(reservations.date, date)).orderBy(asc(reservations.timeSlot), asc(members.fullName));
  const counts = Object.fromEntries(SLOTS.map((slot) => [slot, rows.filter((row) => row.timeSlot === slot).length]));
  const reservation = memberId ? rows.find((row) => row.memberId === memberId) ?? null : null;
  return Response.json({ date, capacity: CAPACITY, slots: SLOTS, counts, reservation, reservations: rows });
}

export async function POST(request: Request) {
  const { memberId, date, timeSlot } = await request.json() as { memberId?: number; date?: string; timeSlot?: string };
  if (!memberId || !date || !validDate(date) || !timeSlot || !SLOTS.includes(timeSlot)) return Response.json({ error: "Randevu bilgileri eksik veya geçersiz." }, { status: 400 });
  const now = istanbulNow();
  if (date < now.date) return Response.json({ error: "Geçmiş bir güne randevu alınamaz." }, { status: 400 });
  if (date === now.date && slotStart(timeSlot) < now.minutes) return Response.json({ error: "Başlangıç saati geçmiş bir seans seçilemez." }, { status: 400 });
  const [member] = await getDb().select({ id: members.id, startDate: members.startDate, endDate: members.endDate, status: members.status }).from(members).where(eq(members.id, memberId)).limit(1);
  if (!member) return Response.json({ error: "Üye bulunamadı." }, { status: 404 });
  if (member.status !== "active" || date < member.startDate || date > member.endDate) return Response.json({ error: "Seçilen tarih aktif üyelik süresinin dışında." }, { status: 400 });
  const [occupancy] = await getDb().select({ count: sql<number>`count(*)` }).from(reservations).where(and(eq(reservations.date, date), eq(reservations.timeSlot, timeSlot)));
  const [existing] = await getDb().select().from(reservations).where(and(eq(reservations.memberId, memberId), eq(reservations.date, date))).limit(1);
  if ((!existing || existing.timeSlot !== timeSlot) && Number(occupancy?.count ?? 0) >= CAPACITY) return Response.json({ error: "Bu seans dolu." }, { status: 409 });
  await getDb().delete(reservations).where(and(eq(reservations.memberId, memberId), eq(reservations.date, date)));
  const [reservation] = await getDb().insert(reservations).values({ memberId, date, timeSlot, createdAt: new Date().toISOString() }).returning();
  return Response.json({ reservation });
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const memberId = Number(url.searchParams.get("memberId"));
  const date = url.searchParams.get("date") ?? "";
  if (!memberId || !validDate(date)) return Response.json({ error: "Randevu bilgileri eksik." }, { status: 400 });
  await getDb().delete(reservations).where(and(eq(reservations.memberId, memberId), eq(reservations.date, date)));
  return Response.json({ success: true });
}
